#!/usr/bin/env bash
set -euo pipefail

# Prototype V1 RTSP helper for Raspberry Pi OS.
# Requires MediaMTX listening on rtsp://127.0.0.1:8554/pi-cam.

WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
FPS="${FPS:-30}"
BITRATE="${BITRATE:-2500000}"
RTSP_URL="${RTSP_URL:-rtsp://127.0.0.1:8554/pi-cam}"

if ! command -v rpicam-vid >/dev/null 2>&1; then
  echo "rpicam-vid not found. Install Raspberry Pi camera apps/libcamera tools first." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it with: sudo apt install ffmpeg" >&2
  exit 1
fi

echo "Starting H.264 RTSP stream:"
echo "  ${WIDTH}x${HEIGHT}@${FPS}"
echo "  bitrate=${BITRATE}"
echo "  url=${RTSP_URL}"

rpicam-vid \
  --width "${WIDTH}" \
  --height "${HEIGHT}" \
  --framerate "${FPS}" \
  --bitrate "${BITRATE}" \
  --codec h264 \
  --inline \
  --nopreview \
  --timeout 0 \
  -o - | ffmpeg \
    -hide_banner \
    -loglevel warning \
    -re \
    -i - \
    -c:v copy \
    -f rtsp \
    -rtsp_transport tcp \
    "${RTSP_URL}"
