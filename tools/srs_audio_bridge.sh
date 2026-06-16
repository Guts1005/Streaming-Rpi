#!/bin/bash
# Plays the browser's WebRTC audio talkback stream (via SRS RTMP) on the Raspberry Pi speaker

echo "Starting SRS Audio Bridge..."

# We use ffplay to pull the RTMP stream continuously.
# -nodisp: No video display
# -fflags nobuffer -flags low_delay: Optimize for ultra-low latency audio
# -f flv: Force FLV container format (RTMP output)

export SDL_AUDIODRIVER="alsa"
export AUDIODEV="plughw:3,0"

while true; do
  ffplay -nodisp -fflags nobuffer -flags low_delay -f flv "rtmp://localhost/live/talkback"
  # Sleep briefly to prevent tight loops if SRS is restarting
  sleep 2
done
