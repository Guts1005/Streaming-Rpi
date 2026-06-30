#!/usr/bin/env bash

# setup_pi.sh
# Automated Setup Script for Smart Helmet / Streaming-Rpi (SRS Architecture)

set -e

echo "==================================================="
echo "  Smart Helmet (Streaming-Rpi) Automated Setup"
echo "==================================================="

echo ""
echo "--- 1. Camera & Audio Auto-Detection ---"
# Detect video devices
VIDEO_DEVS=($(ls /dev/video* 2>/dev/null || true))
if [ ${#VIDEO_DEVS[@]} -eq 0 ]; then
    echo "No /dev/video* devices found. Make sure camera is connected if using USB!"
fi

echo "Which camera are you using?"
echo "  1) Standard Raspberry Pi Camera Module (CSI)"
echo "  2) IMX219 (CSI - Requires specific config)"
idx=3
for dev in "${VIDEO_DEVS[@]}"; do
    echo "  $idx) USB Camera ($dev)"
    idx=$((idx+1))
done

read -p "Enter choice: " CAMERA_CHOICE

CAMERA_TYPE="picam"
CAMERA_DEVICE=""
if [ "$CAMERA_CHOICE" == "1" ]; then
    echo "Selected: Standard Pi Camera"
    CAMERA_TYPE="picam"
elif [ "$CAMERA_CHOICE" == "2" ]; then
    echo "Selected: IMX219 Pi Camera"
    CAMERA_TYPE="picam"
else
    # USB Camera
    sel_idx=$((CAMERA_CHOICE-3))
    if [ $sel_idx -ge 0 ] && [ $sel_idx -lt ${#VIDEO_DEVS[@]} ]; then
        CAMERA_DEVICE="${VIDEO_DEVS[$sel_idx]}"
        CAMERA_TYPE="usb"
        echo "Selected: USB Camera ($CAMERA_DEVICE)"
    else
        echo "Invalid selection, defaulting to Standard Pi Camera"
        CAMERA_CHOICE="1"
        CAMERA_TYPE="picam"
    fi
fi

echo ""
echo "Which microphone are you using?"
echo "  1) Default System/USB Microphone (hw:3,0 or plughw:3,0)"
echo "  2) Other (Type it manually, e.g., hw:1,0)"
read -p "Enter choice (1 or 2): " MIC_CHOICE

AUDIO_DEVICE="hw:3,0"
if [ "$MIC_CHOICE" == "2" ]; then
    read -p "Enter ALSA device name (e.g., hw:1,0): " AUDIO_DEVICE
fi
echo "Selected Audio Device: $AUDIO_DEVICE"

echo ""
echo "--- 2. Environment Variables ---"
GITHUB_PAT="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"

echo ""
echo "Starting automated installation... This will take a few minutes."
echo "==================================================="

echo "[1/9] Updating system and installing dependencies..."
sudo apt update
sudo apt install -y python3-venv python3-pip libzbar0 libcamera-dev libcap-dev ffmpeg python3-rpi.gpio libasound2-dev portaudio19-dev git rpicam-apps curl wget nginx docker.io python3-numpy python3-opencv

echo "[2/9] Cloning repository..."
mkdir -p ~/Desktop/Projects/Streaming-Rpi
cd ~/Desktop/Projects/Streaming-Rpi

if [ ! -d "hm_releases" ]; then
    git clone https://Guts1005:${GITHUB_PAT}@github.com/Guts1005/Streaming-Rpi.git hm_releases
fi

cd hm_releases

echo "Initializing recordings directory to fix permissions..."
mkdir -p recordings
sudo chmod 777 recordings

echo "[3/9] Generating .env file..."
# Preserve existing .env but update/append new variables
if [ -f .env ]; then
    sed -i '/^CAMERA_TYPE=/d' .env
    sed -i '/^CAMERA_DEVICE=/d' .env
    sed -i '/^AUDIO_DEVICE=/d' .env
fi
cat <<EOF >> .env
CAMERA_TYPE=${CAMERA_TYPE}
CAMERA_DEVICE=${CAMERA_DEVICE}
AUDIO_DEVICE=${AUDIO_DEVICE}
EOF

echo "[4/9] Fixing file permissions and line endings..."
sed -i 's/\r$//' *.sh tools/*.sh 2>/dev/null || true
chmod +x *.sh tools/*.sh

echo "[5/9] Setting up Python virtual environment..."
python3 -m venv --system-site-packages venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install --default-timeout=100 --retries=5 -r requirements.txt
[ -f requirements-host.txt ] && pip install --default-timeout=100 --retries=5 -r requirements-host.txt

echo "[6/9] Configuring Nginx and SRS Server..."
sudo cp tools/nginx.conf /etc/nginx/sites-available/default
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "Pulling and running SRS Docker container..."
sudo docker ps -q --filter "name=srs" | grep -q . && sudo docker stop srs && sudo docker rm srs || true
sudo docker run -d --restart always --name srs -p 1935:1935 -p 1985:1985 -p 8082:8080 ossrs/srs:5

# Hardcoded Cloudflare Tunnel Token for Vercel remote access
CLOUDFLARE_TOKEN="eyJhIjoiZTQ1ZWJiNjBlYjliYmEzYjBlNDgwMjM4NDFlMGU0MTQiLCJ0IjoiYTNiNGQzNDUtNDI1ZS00YzY1LTk0ODYtMTFmNGU5MTUxYjI5IiwicyI6Ill6STRPVGN5TlRRdE9XSTRaaTAwWmpBd0xUaGxNR0V0T0RCalpqUXhZemd3TXpCbCJ9"

echo "[7/10] Installing and configuring Cloudflare Tunnel..."
if [ -n "$CLOUDFLARE_TOKEN" ]; then
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i cloudflared.deb
    sudo cloudflared service install "$CLOUDFLARE_TOKEN" || echo "Cloudflared might already be installed."
    rm cloudflared.deb
else
    echo "Skipping Cloudflare installation (No token provided)."
fi

echo "[8/10] Configuring camera settings in /boot/firmware/config.txt..."
CONFIG_FILE="/boot/firmware/config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="/boot/config.txt"
fi

if [ "$CAMERA_CHOICE" == "2" ]; then
    echo "Applying IMX219 configuration..."
    sudo sed -i 's/^camera_auto_detect=1/camera_auto_detect=0/' "$CONFIG_FILE"
    if ! grep -q "^dtoverlay=imx219" "$CONFIG_FILE"; then
        echo "dtoverlay=imx219" | sudo tee -a "$CONFIG_FILE" > /dev/null
    fi
elif [ "$CAMERA_CHOICE" == "1" ]; then
    echo "Standard camera selected. Ensuring auto_detect is on..."
    sudo sed -i 's/^camera_auto_detect=0/camera_auto_detect=1/' "$CONFIG_FILE"
    sudo sed -i 's/^dtoverlay=imx219/#dtoverlay=imx219/' "$CONFIG_FILE"
else
    echo "USB camera selected. No boot config changes required."
fi

echo "[9/10] Configuring Autostart and Systemd Services..."
cat <<EOF | sudo tee /etc/systemd/system/smart-helmet-backend.service > /dev/null
[Unit]
Description=Smart Helmet Flask Backend (init.py)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/Desktop/Projects/Streaming-Rpi/hm_releases
ExecStart=/home/$USER/Desktop/Projects/Streaming-Rpi/hm_releases/venv/bin/python init.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable smart-helmet-backend.service

# Remove deprecated LiveKit services
for dep_srv in srs-audio-bridge.service livekit-publisher.service livekit-audio-receiver.service livekit-audio-bridge.service; do
    sudo systemctl disable "$dep_srv" 2>/dev/null || true
    sudo rm -f "/etc/systemd/system/$dep_srv" || true
done

# Copy new tools services
for service in tools/*.service; do
    if [ -f "$service" ]; then
        service_name=$(basename "$service")
        if [[ "$service_name" == "srs-publisher.service" || "$service_name" == "gpio-offline-capture.service" || "$service_name" == "wifi-qr-connect.service" ]]; then
            sudo cp "$service" /etc/systemd/system/
            sudo systemctl enable "$service_name"
        fi
    fi
done
sudo systemctl daemon-reload

rm -f ~/.config/autostart/hm-updater.desktop || true

echo "==================================================="
echo "  Setup Complete! "
echo "==================================================="
echo "Your Raspberry Pi is now 100% turnkey. The backend, SRS streaming,"
echo "and GPIO buttons will start automatically on every boot!"
echo ""
echo "Camera Type: $CAMERA_TYPE"
echo "Camera Device: $CAMERA_DEVICE"
echo "Audio Device: $AUDIO_DEVICE"
echo ""
echo "Please reboot your Raspberry Pi for all changes to take effect."
echo "Command: sudo reboot"
