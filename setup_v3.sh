#!/usr/bin/env bash

# setup_v3.sh
# Automated Setup Script for Smart Helmet (V3 Architecture)

set -e

echo "==================================================="
echo "  Smart Helmet (V3) Automated Setup"
echo "==================================================="

echo ""
echo "--- 1. Camera Configuration ---"
echo "Which camera are you using?"
echo "  1) Standard Raspberry Pi Camera Module"
echo "  2) IMX219 (Requires specific config)"
read -p "Enter choice (1 or 2): " CAMERA_CHOICE

echo ""
echo "--- 2. Credentials Configuration ---"
GITHUB_PAT="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"

# Hardcoded Cloudflare Tunnel Token
CLOUDFLARE_TOKEN="eyJhIjoiZTQ1ZWJiNjBlYjliYmEzYjBlNDgwMjM4NDFlMGU0MTQiLCJ0IjoiYTNiNGQzNDUtNDI1ZS00YzY1LTk0ODYtMTFmNGU5MTUxYjI5IiwicyI6Ill6STRPVGN5TlRRdE9XSTRaaTAwWmpBd0xUaGxNR0V0T0RCalpqUXhZemd3TXpCbCJ9"

# Hardcoded LiveKit credentials for the current project
LIVEKIT_URL="wss://livetalk-d5nzj1c9.livekit.cloud"
LIVEKIT_API_KEY="APIjeAWn3PdYy2Z"
LIVEKIT_API_SECRET="IKVjLIWh3kFed5uO8qefQa60vrNeWjxi9SRNNA5JlT9C"

echo ""
echo "Starting automated installation... This will take several minutes."
echo "==================================================="

# 4. System update and dependencies
echo "[1/9] Updating system and installing dependencies..."
sudo apt update
sudo apt install -y python3-venv python3-pip libzbar0 libcamera-dev libcap-dev ffmpeg python3-rpi.gpio libasound2-dev portaudio19-dev git rpicam-apps curl wget nginx docker.io python3-numpy python3-opencv

# 5. Clone Repository
echo "[2/9] Cloning repository..."
mkdir -p ~/Desktop/Projects/Streaming-Rpi
cd ~/Desktop/Projects/Streaming-Rpi

# We use the PAT to clone without prompting for passwords
if [ ! -d "hm_releases" ]; then
    git clone https://Guts1005:${GITHUB_PAT}@github.com/Guts1005/Streaming-Rpi.git hm_releases
fi

cd hm_releases

echo "Initializing recordings directory to fix permissions..."
mkdir -p recordings
sudo chmod 777 recordings

# 6. Generate .env file
echo "[3/9] Generating .env file..."
cat <<EOF > .env
LIVEKIT_URL=${LIVEKIT_URL}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
EOF

# 7. Fix permissions and Windows line endings
echo "[4/9] Fixing file permissions and line endings..."
sed -i 's/\r$//' *.sh tools/*.sh 2>/dev/null || true
chmod +x *.sh tools/*.sh

# 8. Virtual Environment & PIP
echo "[5/9] Setting up Python virtual environment..."
python3 -m venv --system-site-packages venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if [ -f requirements-livekit-audio.txt ]; then
    pip install -r requirements-livekit-audio.txt
fi

# 9. Configure Nginx and SRS
echo "[6/9] Configuring Nginx and SRS Server..."
sudo cp tools/nginx.conf /etc/nginx/sites-available/default
sudo systemctl restart nginx
sudo systemctl enable nginx

# Run SRS as a Docker container (restarts automatically)
echo "Pulling and running SRS Docker container..."
sudo docker ps -q --filter "name=srs" | grep -q . && sudo docker stop srs && sudo docker rm srs || true
sudo docker run -d --restart always --name srs -p 1935:1935 -p 1985:1985 -p 8082:8080 ossrs/srs:5

# 10. Configure Cloudflared
echo "[7/9] Installing and configuring Cloudflare Tunnel..."
if [ -n "$CLOUDFLARE_TOKEN" ]; then
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i cloudflared.deb
    sudo cloudflared service install "$CLOUDFLARE_TOKEN" || echo "Cloudflared might already be installed."
    rm cloudflared.deb
else
    echo "Skipping Cloudflare installation (No token provided)."
fi

# 11. Configure Camera Boot options
echo "[8/9] Configuring camera settings in /boot/firmware/config.txt..."
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

# 12. Setup Autostart and Services
echo "[9/9] Configuring Autostart and Systemd Services..."

# Create systemd service for init.py so it runs completely headless
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

# Copy all new tools services
for service in tools/*.service; do
    if [ -f "$service" ]; then
        sudo cp "$service" /etc/systemd/system/
        service_name=$(basename "$service")
        
        # Disable deprecated services if they exist
        if [ "$service_name" == "srs-audio-bridge.service" ] || [ "$service_name" == "livekit-publisher.service" ]; then
            sudo systemctl disable "$service_name" 2>/dev/null || true
            continue
        fi

        sudo systemctl enable "$service_name"
    fi
done

sudo systemctl daemon-reload
sudo systemctl enable smart-helmet-backend.service

# Cleanup old gui autostart if it exists
rm -f ~/.config/autostart/hm-updater.desktop

echo "==================================================="
echo "  V3 Setup Complete! "
echo "==================================================="
echo "Your Raspberry Pi is now 100% turnkey."
echo "The backend, video streaming, LiveKit talkback, and GPIO buttons"
echo "will start automatically on every boot!"
echo ""
echo "Please reboot your Raspberry Pi for all changes to take effect."
echo "Command: sudo reboot"
