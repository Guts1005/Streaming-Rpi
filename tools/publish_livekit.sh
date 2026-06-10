#!/bin/bash
# publish_livekit.sh
# Streams the Raspberry Pi camera to the LiveKit RTMP ingest

# The RTMP ingest URL provided by the user
RTMP_URL="rtmps://streaming-rpi-2jtqu2qo.rtmp.livekit.cloud/x/4gd6uX93mrPT"

# Delay to let camera drivers initialize
sleep 5

# Capture using libcamera and pipe to ffmpeg to push to RTMP. 
# We use hardware encoding (h264) for low latency and CPU usage.
echo "Starting LiveKit video stream..."
libcamera-vid -t 0 --inline --width 1280 --height 720 --framerate 30 --codec h264 -o - | \
ffmpeg -y -i - -c:v copy -f flv "$RTMP_URL"
