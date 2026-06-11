# Raspberry Pi to Vercel Live Streaming Logic

## Goal
Raspberry Pi camera + mic stream live audio/video to:

https://helmet-live-viewer.vercel.app/

The Vercel app does not directly read the Pi camera. The Pi publishes media to LiveKit, and the Vercel site subscribes to that LiveKit room.

## Main Architecture

Raspberry Pi -> camera/audio publisher -> LiveKit Cloud room -> Vercel Next.js frontend -> browser viewer

Browser microphone -> LiveKit room -> Raspberry Pi audio bridge -> Pi default speaker/audio output

## LiveKit Role

LiveKit is the real-time media layer.

The Pi publishes:
- Camera video
- Pi microphone audio

The browser subscribes:
- Receives Pi video
- Receives Pi mic audio

The browser can also publish:
- User microphone audio for talkback

The Pi subscribes:
- Receives browser microphone audio
- Plays it through the Pi default audio output

## LiveKit Config Needed

Vercel environment variables:

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR_LIVEKIT_PROJECT.livekit.cloud
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
LIVEKIT_ROOM=helmet-live
DEVICE_API_BASE=http://PUBLIC_OR_TUNNELED_PI_API_URL
```

Pi environment/config needs:

```env
LIVEKIT_URL=wss://YOUR_LIVEKIT_PROJECT.livekit.cloud
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
LIVEKIT_ROOM=helmet-live
```

## Vercel Frontend Logic

The site calls:

```txt
/api/token
```

This route creates a LiveKit access token using:

```txt
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_ROOM
```

The token grants:

```txt
canSubscribe: true
canPublish: true
canPublishData: true
```

The frontend then connects to:

```txt
NEXT_PUBLIC_LIVEKIT_URL
```

and joins room:

```txt
helmet-live
```

The LiveKit video component subscribes to the Pi participant video/audio tracks.

## Pi Video Publishing Logic

The Pi runs a systemd service:

```txt
livekit-publisher.service
```

It starts:

```bash
/home/trc/publish_livekit.sh
```

That script captures camera video using Raspberry Pi camera tools.

Current camera command should use:

```bash
rpicam-vid
```

not old:

```bash
libcamera-vid
```

Example camera pipeline:

```bash
rpicam-vid \
  --width 1280 \
  --height 720 \
  --framerate 24 \
  --codec h264 \
  --inline \
  --nopreview \
  --timeout 0 \
  -o - \
| ffmpeg \
  -f h264 \
  -i - \
  -c:v copy \
  -f flv \
  "$LIVEKIT_RTMP_URL"
```

If using LiveKit RTMP ingress, the Pi publishes to:

```txt
rtmps://streaming-rpi-2jtqu2qo.rtmp.livekit.cloud/x/4gd6uX93mrPT
```

Ingress ID:

```txt
IN_r4ogFZJpCkmX
```

Important:
- RTMP ingress sends media into the LiveKit room.
- If ingress is inactive, Vercel will show no stream.
- Pi must have internet.
- `livekit-publisher.service` must be running.

## Pi Audio Publishing + Talkback Logic

A separate Pi service handles two-way audio:

```txt
livekit-audio-bridge.service
```

Script:

```txt
tools/livekit_audio_bridge.py
```

It does two jobs:

1. Publishes Pi USB/default mic audio to LiveKit.
2. Subscribes to browser microphone audio and plays it through Pi default speaker.

This is required because RTMP camera publishing alone may not handle full interactive talkback cleanly.

## Browser Talkback Logic

The UI has Toggle Talk mode:

First click:
- asks browser mic permission
- publishes user microphone track to LiveKit
- button shows talking/active state

Second click:
- unpublishes/stops mic track
- Pi stops receiving user audio

The user does not need to hold the button.

## Device API Logic

The Vercel UI also calls Pi Flask APIs for control features.

Backend file:

```txt
init.py
```

Important endpoints include:

```txt
/api/health
/api/stream_info
/api/media
/api/delete_file
/api/capture
/api/start_recording
/api/stop_recording
/api/upload_recordings
/api/upload_snapshots
/api/gemini_analyze
/api/ai_summary
```

Vercel proxy route:

```txt
/app/api/device/[...path]/route.ts
```

It forwards frontend requests to:

```txt
DEVICE_API_BASE
```

Important:
- If `DEVICE_API_BASE` points to `http://192.168.x.x`, it only works on the same LAN.
- For Vercel public access, the Pi API must be exposed using a tunnel/public URL.
- LiveKit video can work globally without exposing Flask.
- Control APIs need public/tunnel access.

## Raspberry Pi Services

Expected systemd services:

```bash
sudo systemctl status livekit-publisher.service
sudo systemctl status livekit-audio-bridge.service
sudo systemctl status gpio-offline-capture.service
sudo systemctl status wifi-qr-connect.service
```

Restart stream:

```bash
sudo systemctl restart livekit-publisher.service
```

Restart audio bridge:

```bash
sudo systemctl restart livekit-audio-bridge.service
```

Check logs:

```bash
journalctl -u livekit-publisher.service -f
journalctl -u livekit-audio-bridge.service -f
```

## Offline / GPIO Logic

If internet is unavailable:
- LiveKit streaming cannot work.
- Pi still supports local recording and snapshot capture.

GPIO controls:

```txt
GPIO6 = start/stop local video recording
GPIO13 = capture photo
GPIO19 = stream/WiFi status LED
GPIO26 = recording/photo LED
```

Local files are stored in:

```txt
recordings/
```

When internet returns:
- uploader syncs videos/images to server.
- uploaded files are renamed to avoid duplicate upload.

## Setup Verification

On Pi:

```bash
rpicam-vid --width 1280 --height 720 --framerate 24 --timeout 5000 --nopreview -o test.h264
```

Check audio input:

```bash
arecord -l
```

Check speaker output:

```bash
aplay -l
```

Check LiveKit publisher:

```bash
sudo systemctl restart livekit-publisher.service
journalctl -u livekit-publisher.service -n 50 --no-pager
```

Check audio bridge:

```bash
sudo systemctl restart livekit-audio-bridge.service
journalctl -u livekit-audio-bridge.service -n 50 --no-pager
```

## Common Failure Points

If Vercel page is black:
- Pi publisher service is stopped.
- LiveKit ingress is inactive.
- Wrong LiveKit room.
- Wrong `NEXT_PUBLIC_LIVEKIT_URL`.
- Token route failing.
- Camera busy because local recording is active.
- Pi has no internet.

If video works but no audio:
- Pi mic not selected correctly.
- Audio bridge service stopped.
- Browser autoplay muted audio.
- LiveKit audio track not subscribed.
- ALSA/default device wrong.

If talkback does not work:
- Browser mic permission blocked.
- Token route lacks `canPublish`.
- Audio bridge not subscribed to browser track.
- Pi speaker output wrong/default muted.

If Vercel buttons do not work:
- `DEVICE_API_BASE` wrong.
- Pi Flask server not running.
- Pi API is private LAN only and Vercel cannot reach it.
