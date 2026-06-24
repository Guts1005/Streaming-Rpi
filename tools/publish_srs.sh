#!/bin/bash
# Streams the Raspberry Pi camera to local SRS RTMP ingest

# Delay to let camera drivers initialize
sleep 5

echo "Starting SRS video stream..."
rpicam-vid \
  --width 1280 \
  --height 720 \
  --framerate 15 \
  --bitrate 1500000 \
  --codec h264 \
  --inline \
  --nopreview \
  --timeout 0 \
  -o - \
| ffmpeg \
  -y \
  -thread_queue_size 1024 -f h264 \
  -i - \
  -thread_queue_size 1024 -f alsa \
  -i plughw:3,0 \
  -c:v copy \
  -c:a aac -ar 44100 -b:a 128k \
  -f flv \
  "rtmp://localhost/live/livestream"
