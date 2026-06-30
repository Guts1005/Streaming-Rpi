#!/bin/bash
# Streams the camera to local SRS RTMP ingest

# Source environment variables if they exist
ENV_FILE="/home/$USER/Desktop/Projects/Streaming-Rpi/hm_releases/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Fallbacks
CAMERA_TYPE=${CAMERA_TYPE:-picam}
CAMERA_DEVICE=${CAMERA_DEVICE:-/dev/video0}
AUDIO_DEVICE=${AUDIO_DEVICE:-plughw:3,0}

# Convert 'hw:' to 'plughw:' for better ffmpeg compatibility if needed
if [[ "$AUDIO_DEVICE" == hw:* ]]; then
    AUDIO_DEVICE="plug${AUDIO_DEVICE}"
fi

# Delay to let camera drivers initialize
sleep 5

echo "Starting SRS video stream with Camera: $CAMERA_TYPE, Mic: $AUDIO_DEVICE"

if [ "$CAMERA_TYPE" == "usb" ]; then
    # USB Camera Stream
    ffmpeg \
      -y \
      -thread_queue_size 1024 -f v4l2 -video_size 1280x720 -framerate 15 -i "$CAMERA_DEVICE" \
      -thread_queue_size 1024 -f alsa -i "$AUDIO_DEVICE" \
      -c:v libx264 -preset veryfast -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p \
      -c:a aac -ar 44100 -b:a 128k \
      -f flv "rtmp://localhost/live/livestream"
else
    # PiCam Stream (libcamera)
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
      -thread_queue_size 1024 -f h264 -i - \
      -thread_queue_size 1024 -f alsa -i "$AUDIO_DEVICE" \
      -c:v copy \
      -c:a aac -ar 44100 -b:a 128k \
      -f flv "rtmp://localhost/live/livestream"
fi
