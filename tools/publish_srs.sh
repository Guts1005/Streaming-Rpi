#!/bin/bash
# Streams the Raspberry Pi camera to local SRS RTMP ingest

# Delay to let camera drivers initialize
sleep 5

echo "Starting SRS video stream..."
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
  -f alsa \
  -channels 1 \
  -i hw:3,0 \
  -c:v copy \
  -c:a aac -ar 44100 -b:a 128k \
  -f flv \
  "rtmp://localhost/live/livestream"
