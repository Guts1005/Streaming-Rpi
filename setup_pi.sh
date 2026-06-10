#!/usr/bin/env bash

# setup_pi.sh
# Automated Setup Script for Smart Helmet / Streaming-Rpi

set -e

echo "==================================================="
echo "  Smart Helmet (Streaming-Rpi) Automated Setup"
echo "==================================================="

# 1. Ask for Interactive Configuration first so user can walk away
echo ""
echo "--- 1. Camera Configuration ---"
echo "Which camera are you using?"
echo "  1) Standard Raspberry Pi Camera Module"
echo "  2) IMX219 (Requires specific config)"
read -p "Enter choice (1 or 2): " CAMERA_CHOICE

echo ""
echo "--- 2. Environment Variables ---"
echo "Setting up LiveKit and Github credentials..."
LK_URL="wss://streaming-rpi-2jtqu2qo.livekit.cloud"
LK_KEY="APIA9ZvbR8nPx9p"
LK_SECRET="Eg0Z0JTjwZlo1fYZb8OEe8O8pWQ4HHNEQHiQbM6MfRgB"
LK_ROOM="helmet-live"
GITHUB_PAT="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"

echo ""
echo "Starting automated installation... This will take a few minutes."
echo "==================================================="

# 2. System update and dependencies
echo "[1/7] Updating system and installing dependencies..."
sudo apt update
sudo apt install -y python3-venv python3-pip libzbar0 libcamera-dev libcap-dev ffmpeg python3-rpi.gpio libasound2-dev portaudio19-dev git rpicam-apps

# 3. Clone Repository
echo "[2/7] Cloning repository..."
mkdir -p ~/Desktop/Projects/Streaming-Rpi
cd ~/Desktop/Projects/Streaming-Rpi

# We use the PAT to clone without prompting for passwords
if [ ! -d "hm_releases" ]; then
    git clone https://Guts1005:${GITHUB_PAT}@github.com/Guts1005/Streaming-Rpi.git hm_releases
fi

cd hm_releases

# 4. Generate .env file
echo "[3/7] Generating .env file..."
cat <<EOF > .env
LIVEKIT_URL=$LK_URL
LIVEKIT_API_KEY=$LK_KEY
LIVEKIT_API_SECRET=$LK_SECRET
LIVEKIT_ROOM=$LK_ROOM
EOF

# 5. File permissions
echo "[4/7] Setting file permissions..."
chmod +x updater.sh
chmod +x generate_certs.sh || true
chmod +x tools/start_rtsp_stream.sh || true
chmod +x tools/publish_livekit.sh || true

# 6. Virtual Environment & PIP
echo "[5/7] Setting up Python virtual environment..."
python3 -m venv --system-site-packages venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
[ -f requirements-host.txt ] && pip install -r requirements-host.txt
[ -f requirements-livekit-audio.txt ] && pip install -r requirements-livekit-audio.txt

# 7. Configure Camera Boot options
echo "[6/7] Configuring camera settings in /boot/firmware/config.txt..."
CONFIG_FILE="/boot/firmware/config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="/boot/config.txt" # Fallback for older Pi OS versions
fi

if [ "$CAMERA_CHOICE" == "2" ]; then
    echo "Applying IMX219 configuration..."
    sudo sed -i 's/^camera_auto_detect=1/camera_auto_detect=0/' "$CONFIG_FILE"
    # Ensure dtoverlay=imx219 exists
    if ! grep -q "^dtoverlay=imx219" "$CONFIG_FILE"; then
        echo "dtoverlay=imx219" | sudo tee -a "$CONFIG_FILE" > /dev/null
    fi
else
    echo "Standard camera selected. Ensuring auto_detect is on..."
    sudo sed -i 's/^camera_auto_detect=0/camera_auto_detect=1/' "$CONFIG_FILE"
    sudo sed -i 's/^dtoverlay=imx219/#dtoverlay=imx219/' "$CONFIG_FILE"
fi

# 8. Setup Autostart and Services
echo "[7/7] Configuring Autostart and Systemd Services..."

# Desktop autostart
mkdir -p ~/.config/autostart
rm -f ~/.config/autostart/hm_releases.desktop

cat <<EOF > ~/.config/autostart/hm-updater.desktop
[Desktop Entry]
Type=Application
Name=HM Releases Updater
Exec=lxterminal -e "/home/$USER/Desktop/Projects/Streaming-Rpi/hm_releases/updater.sh"
Terminal=false
Comment=Force update code from GitHub and run main.py on boot
X-GNOME-Autostart-enabled=true
EOF

# Note: Any .service files found in the tools/ directory will be registered with systemd
for service in tools/*.service; do
    if [ -f "$service" ]; then
        sudo cp "$service" /etc/systemd/system/
        service_name=$(basename "$service")
        sudo systemctl daemon-reload
        sudo systemctl enable "$service_name"
    fi
done

echo "==================================================="
echo "  Setup Complete! "
echo "==================================================="
echo "Please reboot your Raspberry Pi for all changes and camera configurations to take effect."
echo "Command: sudo reboot"
