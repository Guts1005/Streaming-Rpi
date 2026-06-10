#!/usr/bin/env python3
"""
Bidirectional LiveKit audio bridge for the Raspberry Pi.

Publishes the Pi's default USB/default microphone into the LiveKit room and
plays remote browser microphone audio through the Pi's default audio output.
"""

import argparse
import asyncio
import json
import logging
import os
import signal
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
import sounddevice as sd
from livekit import api, rtc

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None


SAMPLE_RATE = 48000
CHANNELS = 1
SAMPLES_PER_CHANNEL = 480  # 10 ms at 48 kHz


def make_token(api_key: str, api_secret: str, room: str, identity: str, name: str) -> str:
    grants = api.VideoGrants(
        room_join=True,
        room=room,
        can_subscribe=True,
        can_publish=True,
        can_publish_data=True,
    )
    return (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(name)
        .with_grants(grants)
        .to_jwt()
    )


def fetch_token(token_url: str, identity: str, name: str) -> str:
    separator = "&" if "?" in token_url else "?"
    url = f"{token_url}{separator}{urlencode({'identity': identity, 'name': name})}"
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    token = payload.get("token")
    if not token:
        raise SystemExit(f"Token endpoint did not return token: {payload}")
    return token


async def play_remote_audio(track: rtc.Track, participant: rtc.RemoteParticipant, output: sd.RawOutputStream) -> None:
    logging.info("playing remote audio from %s", participant.identity or participant.sid)
    stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
    async for event in stream:
        output.write(bytes(event.frame.data))


async def publish_pi_microphone(
    room: rtc.Room,
    input_device: Optional[str],
    stop_event: asyncio.Event,
) -> None:
    source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)
    track = rtc.LocalAudioTrack.create_audio_track("pi-microphone", source)
    options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    await room.local_participant.publish_track(track, options)

    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=8)
    loop = asyncio.get_running_loop()

    def enqueue(payload: bytes) -> None:
        if queue.full():
            return
        queue.put_nowait(payload)

    def callback(indata, frames, time_info, status) -> None:
        del time_info
        if status:
            logging.debug("input status: %s", status)
        payload = bytes(indata)
        loop.call_soon_threadsafe(enqueue, payload)

    logging.info("publishing Pi microphone from input device: %s", input_device or "system default")
    with sd.RawInputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
        blocksize=SAMPLES_PER_CHANNEL,
        device=input_device,
        callback=callback,
    ):
        while not stop_event.is_set():
            payload = await queue.get()
            if not payload:
                continue

            frame = rtc.AudioFrame.create(SAMPLE_RATE, CHANNELS, SAMPLES_PER_CHANNEL)
            frame_data = np.frombuffer(frame.data, dtype=np.int16)
            input_data = np.frombuffer(payload, dtype=np.int16)
            samples = min(len(frame_data), len(input_data))
            frame_data[:samples] = input_data[:samples]
            if samples < len(frame_data):
                frame_data[samples:] = 0
            await source.capture_frame(frame)


async def run(args: argparse.Namespace) -> None:
    if load_dotenv:
        load_dotenv(args.env_file)

    livekit_url = args.url or os.getenv("LIVEKIT_URL")
    token_url = args.token_url or os.getenv("LIVEKIT_TOKEN_URL")
    api_key = args.api_key or os.getenv("LIVEKIT_API_KEY")
    api_secret = args.api_secret or os.getenv("LIVEKIT_API_SECRET")
    room_name = args.room or os.getenv("LIVEKIT_ROOM") or os.getenv("ROOM_NAME") or "helmet-live"

    if not livekit_url:
        raise SystemExit("Missing LIVEKIT_URL")

    identity = args.identity or "helmet-audio"
    if token_url:
        token = fetch_token(token_url, identity, args.name)
    elif api_key and api_secret:
        token = make_token(api_key, api_secret, room_name, identity, args.name)
    else:
        raise SystemExit("Missing LIVEKIT_TOKEN_URL or LIVEKIT_API_KEY/LIVEKIT_API_SECRET")
    room = rtc.Room()
    stop_event = asyncio.Event()
    tasks: set[asyncio.Task[None]] = set()

    output = sd.RawOutputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
        device=args.output_device,
        blocksize=0,
    )

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        del publication
        if participant.identity == identity:
            return
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        task = asyncio.create_task(play_remote_audio(track, participant, output))
        tasks.add(task)
        task.add_done_callback(tasks.discard)

    @room.on("disconnected")
    def on_disconnected(reason: Optional[str] = None) -> None:
        logging.info("disconnected from LiveKit: %s", reason)
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    logging.info("default sounddevice devices: %s", sd.default.device)
    output.start()

    try:
        logging.info("connecting to %s room=%s identity=%s", livekit_url, room_name, identity)
        await room.connect(livekit_url, token)
        mic_task = asyncio.create_task(publish_pi_microphone(room, args.input_device, stop_event))
        tasks.add(mic_task)
        mic_task.add_done_callback(tasks.discard)
        logging.info("audio bridge connected; Pi mic is publishing and remote audio will play locally")
        await stop_event.wait()
    finally:
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        await room.disconnect()
        output.stop()
        output.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish Pi mic and play browser talkback via LiveKit.")
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--url")
    parser.add_argument("--token-url")
    parser.add_argument("--api-key")
    parser.add_argument("--api-secret")
    parser.add_argument("--room")
    parser.add_argument("--identity", default="helmet-audio")
    parser.add_argument("--name", default="Helmet Audio Bridge")
    parser.add_argument("--input-device", help="Optional sounddevice input device index/name")
    parser.add_argument("--output-device", help="Optional sounddevice output device index/name")
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    parsed = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if parsed.debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    asyncio.run(run(parsed))
