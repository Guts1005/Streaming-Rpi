import asyncio
import os
import signal
import sys
import logging
from livekit import rtc, api

logging.basicConfig(level=logging.DEBUG)
sys.stdout.reconfigure(line_buffering=True)
import sounddevice as sd
import numpy as np
from dotenv import load_dotenv

def get_best_output_device():
    try:
        devices = sd.query_devices()
        usb_device = None
        headphones = None
        for idx, d in enumerate(devices):
            if d['max_output_channels'] > 0:
                name = d['name'].lower()
                if "blue" in name or "bta" in name:
                    return idx
                if "usb" in name:
                    usb_device = idx
                if "headphone" in name:
                    headphones = idx
        if usb_device is not None:
            return usb_device
        if headphones is not None:
            return headphones
    except Exception as e:
        print(f"Device query error: {e}")
    return None

# Load from .env file
load_dotenv()

LIVEKIT_URL = os.environ.get("LIVEKIT_URL")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET")
ROOM_NAME = "talkback"

if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    print("Missing LiveKit credentials in .env")
    sys.exit(1)

room = rtc.Room()

async def main():
    print("Connecting to LiveKit...")
    
    # Create token for Pi to listen
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity("raspberry-pi-speaker") \
        .with_name("Pi Speaker") \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=ROOM_NAME,
            can_subscribe=True,
        )).to_jwt()

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        print(f"Participant connected: {participant.identity}")

    @room.on("track_published")
    def on_track_published(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        print(f"Track published: {publication.sid} by {participant.identity}")
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            print("Scheduling force-subscribe...")
            publication.set_subscribed(True)

    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            print(f"Subscribed to audio track from {participant.identity}")
            asyncio.create_task(play_audio(track))

    options = rtc.RoomOptions(auto_subscribe=True)
    await room.connect(LIVEKIT_URL, token, options=options)
    print(f"Connected to LiveKit room: {ROOM_NAME}")

    # Check for already published tracks
    for p_id, participant in room.remote_participants.items():
        print(f"Existing participant in room: {participant.identity}")
        for pub_id, publication in participant.track_publications.items():
            print(f"Found existing track publication: {publication.sid} (Kind: {publication.kind}, Subscribed: {publication.subscribed})")
            if publication.subscribed and publication.kind == rtc.TrackKind.KIND_AUDIO:
                print(f"Already subscribed to track from {participant.identity}")
                asyncio.create_task(play_audio(publication.track))
            elif not publication.subscribed and publication.kind == rtc.TrackKind.KIND_AUDIO:
                print("Track exists but not subscribed. Forcing subscription...")
                publication.set_subscribed(True)

    # Keep alive
    await asyncio.Event().wait()

async def play_audio(track: rtc.RemoteAudioTrack):
    audio_stream = rtc.AudioStream(track)
    
    dev_idx = get_best_output_device()
    print(f"Routing audio to device index: {dev_idx if dev_idx is not None else 'Default'}")
    
    out_stream = None
    loop = asyncio.get_event_loop()
    try:
        async for event in audio_stream:
            if event.frame:
                if out_stream is None:
                    print("Initializing audio stream...")
                    out_stream = sd.RawOutputStream(
                        samplerate=event.frame.sample_rate,
                        channels=event.frame.num_channels,
                        dtype='int16',
                        device=dev_idx
                    )
                    out_stream.start()
                    print("Audio stream started.")

                # Offload blocking write to a thread pool!
                await loop.run_in_executor(None, out_stream.write, bytes(event.frame.data))
    except Exception as e:
        print(f"Error playing audio: {e}")
    finally:
        if out_stream:
            out_stream.stop()
            out_stream.close()
            print("Audio stream closed.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Interrupted")
