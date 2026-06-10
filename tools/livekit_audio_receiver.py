#!/usr/bin/env python3
"""
Subscribe to LiveKit microphone audio and play it on the Pi default speaker.

This process is intentionally separate from the camera publisher so the video
pipeline can keep using rpicam/ffmpeg while audio talkback uses LiveKit RTC.
"""

import argparse
import asyncio
import logging
import os
import signal
from typing import Optional

import sounddevice as sd
from livekit import api, rtc

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - dotenv is optional at runtime.
    load_dotenv = None


SAMPLE_RATE = 48000
CHANNELS = 1


def make_token(api_key: str, api_secret: str, room: str, identity: str, name: str) -> str:
    grants = api.VideoGrants(
        room_join=True,
        room=room,
        can_subscribe=True,
        can_publish=False,
        can_publish_data=True,
    )
    return (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(name)
        .with_grants(grants)
        .to_jwt()
    )


async def play_track(track: rtc.Track, participant: rtc.RemoteParticipant, output: sd.RawOutputStream) -> None:
    logging.info("playing audio from %s", participant.identity or participant.sid)
    stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
    async for event in stream:
        output.write(bytes(event.frame.data))


async def run(args: argparse.Namespace) -> None:
    if load_dotenv:
        load_dotenv(args.env_file)

    livekit_url = args.url or os.getenv("LIVEKIT_URL")
    api_key = args.api_key or os.getenv("LIVEKIT_API_KEY")
    api_secret = args.api_secret or os.getenv("LIVEKIT_API_SECRET")
    room_name = args.room or os.getenv("LIVEKIT_ROOM") or os.getenv("ROOM_NAME") or "helmet-live"

    if not livekit_url or not api_key or not api_secret:
        raise SystemExit("Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET")

    identity = args.identity or "helmet-speaker"
    token = make_token(api_key, api_secret, room_name, identity, args.name)
    room = rtc.Room()
    tasks: set[asyncio.Task[None]] = set()
    stop_event = asyncio.Event()

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

        task = asyncio.create_task(play_track(track, participant, output))
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

    logging.info("using default output device: %s", sd.default.device)
    output.start()

    try:
        logging.info("connecting to %s room=%s identity=%s", livekit_url, room_name, identity)
        await room.connect(livekit_url, token)
        logging.info("connected; waiting for browser microphone audio")
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
    parser = argparse.ArgumentParser(description="Play LiveKit talkback audio through the Pi speaker.")
    parser.add_argument("--env-file", default=".env", help="Path to env file containing LiveKit credentials")
    parser.add_argument("--url", help="LiveKit websocket URL")
    parser.add_argument("--api-key", help="LiveKit API key")
    parser.add_argument("--api-secret", help="LiveKit API secret")
    parser.add_argument("--room", help="LiveKit room name")
    parser.add_argument("--identity", default="helmet-speaker", help="LiveKit participant identity for this Pi process")
    parser.add_argument("--name", default="Helmet Speaker", help="LiveKit participant display name")
    parser.add_argument("--output-device", help="Optional sounddevice output device index/name")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    return parser.parse_args()


if __name__ == "__main__":
    parsed = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if parsed.debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    asyncio.run(run(parsed))
