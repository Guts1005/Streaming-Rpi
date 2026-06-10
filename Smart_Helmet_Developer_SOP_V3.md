# Smart Helmet Developer Standard Operating Procedure (SOP) V3

## 1. Overview
This document outlines the standard procedure for setting up, configuring, and maintaining the Smart Helmet (Streaming-Rpi) project on a Raspberry Pi. The system provides real-time video streaming (MJPEG/RTSP), QR-based WiFi provisioning, and media management.

## 2. Prerequisites
### 2.1 Hardware
- Raspberry Pi 4B (Recommended) or Pi 5.
- Raspberry Pi Camera Module (v2 or v3).
- MicroSD Card (16GB+ recommended).
- Power Supply (Official 5V 3A for Pi 4).
- Status LED connected to **GPIO 17** (optional but recommended).

### 2.2 Software
- **OS**: Raspberry Pi OS (64-bit) with Desktop or Lite.
- **Python**: 3.9+ (pre-installed on Raspberry Pi OS).
- **Network**: Internet access required for initial setup and updates.
- **LiveKit Account**: Required for the live dashboard (API Key, Secret, and WebSocket URL).

---

## 3. Initial Setup & Cloning

### 3.1 Clone the Repository
Open a terminal and navigate to the desired parent directory. Use the following command which includes the necessary authentication for the private repository:

```bash
mkdir -p ~/Desktop/Projects/Streaming-Rpi
cd ~/Desktop/Projects/Streaming-Rpi
git clone https://Guts1005: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@github.com/Guts1005/Streaming-Rpi.git hm_releases
cd hm_releases
```

### 3.2 Configure Environment Variables
Create a `.env` file in the project root to store your LiveKit credentials:

```bash
nano .env
```

Add the following content (replace with your actual credentials):

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_ROOM=helmet-live
```

### 3.3 Set File Permissions
**CRITICAL**: You must grant executable permissions to the script files, otherwise you will get a "Permission denied" error when trying to run them.

```bash
chmod +x updater.sh
chmod +x generate_certs.sh
chmod +x tools/start_rtsp_stream.sh
```

---

## 4. Environment & Dependencies

### 4.1 System Dependencies
The project requires several system-level libraries for OpenCV, Camera support, QR decoding, and **Audio playback**. Run the following commands:

```bash
sudo apt update
sudo apt install -y \
    python3-venv \
    python3-pip \
    libzbar0 \
    libcamera-dev \
    libcap-dev \
    ffmpeg \
    python3-rpi.gpio \
    libasound2-dev \
    portaudio19-dev
```

### 4.2 Virtual Environment Setup
**CRITICAL**: The application must run within a virtual environment (`venv`) to avoid dependency conflicts and "pyflask" errors during autostart.

```bash
# Create the virtual environment if it doesn't exist
python3 -m venv --system-site-packages venv

# Activate the venv
source venv/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install project dependencies
pip install -r requirements.txt
pip install -r requirements-host.txt

# Install LiveKit audio dependencies
pip install -r requirements-livekit-audio.txt
```

---

## 5. Automated Updater & Launcher

The `updater.sh` script is the primary entry point for the application. it handles:
1. **Initial Delay**: A 10s wait to let system services initialize.
2. **Network Check Loop**: Pings Google DNS (8.8.8.8) repeatedly (up to 20 times) to wait for an internet connection before proceeding.
3. **GitHub Update**: If the network is found, it force-updates the code and dependencies.
4. **App Launch**: Activates the `venv` and executes `main.py`.

### 5.1 `updater.sh` Source
```bash
#!/usr/bin/env bash
set -euo pipefail

# Initial wait to allow system services to start
sleep 10

REPO_DIR="$HOME/Desktop/Projects/Streaming-Rpi/hm_releases"
cd "$REPO_DIR" || exit 1

# --- NETWORK WAIT LOOP ---
echo "Checking for network connectivity..."
MAX_RETRIES=20
RETRY_COUNT=0
NETWORK_AVAILABLE=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
    echo "Internet available!"
    NETWORK_AVAILABLE=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Network not available (Attempt $RETRY_COUNT/$MAX_RETRIES). Waiting 5s..."
  sleep 5
done

if [ "$NETWORK_AVAILABLE" = true ]; then
  echo "Force-updating from GitHub..."
  if [ -d .git ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
  fi

  if [ ! -d "venv" ]; then
    python3 -m venv --system-site-packages venv
  fi

  # shellcheck disable=SC1091
  source venv/bin/activate

  python -m pip install --upgrade pip
  [ -f requirements.txt ] && python -m pip install -r requirements.txt
  [ -f requirements-host.txt ] && python -m pip install -r requirements-host.txt
else
  echo "No internet connection after timeout. Skipping update."
  if [ -d "venv" ]; then
    source venv/bin/activate
  fi
fi

echo "Starting application..."
exec python3 main.py
```

---

## 6. Autostart & Service Configuration

To ensure the Smart Helmet starts automatically on boot and correctly handles both the main app and the LiveKit audio talkback.

### 6.1 Main Updater Autostart
Create `~/.config/autostart/hm-updater.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=HM Releases Updater
Exec=lxterminal -e "/home/trc/Desktop/Projects/Streaming-Rpi/hm_releases/updater.sh"
Terminal=false
Comment=Force update code from GitHub and run main.py on boot
X-GNOME-Autostart-enabled=true
```

### 6.2 LiveKit Video Publisher Autostart
To ensure the LiveKit stream starts automatically, create `~/.config/autostart/publish_livekit.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=LiveKit Publisher
Exec=lxterminal -e "/home/trc/publish_livekit.sh"
Terminal=false
Comment=Start LiveKit video publishing on boot
X-GNOME-Autostart-enabled=true
```

**Note**: Ensure `~/publish_livekit.sh` has executable permissions:
```bash
chmod +x ~/publish_livekit.sh
```

### 6.3 LiveKit Audio Receiver Service
To enable two-way audio (talkback), install the background service:

```bash
# Copy the service file to systemd
sudo cp tools/livekit-audio-receiver.service /etc/systemd/system/

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable livekit-audio-receiver.service
sudo systemctl start livekit-audio-receiver.service
```

---

## 7. Running the Application

### 7.1 Manual Start
To start the application manually for testing:
```bash
cd ~/Desktop/Projects/Streaming-Rpi/hm_releases
source venv/bin/activate
python3 main.py
```

### 7.2 Accessing the Web Interface
Once running, the interface is accessible from any device on the same network:
- **URL**: `http://<raspberry-pi-ip>:5001`
- **Livestream**: `http://<raspberry-pi-ip>:5001/video_feed`

---

## 8. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `Permission denied` | Script not executable | Run `chmod +x updater.sh`. |
| `pyflask` or Module Not Found | Not using `venv` | Ensure you source the venv or use `updater.sh`. |
| `LiveKit` Credentials Error | Missing or wrong `.env` | Verify `.env` file matches your LiveKit dashboard. |
| High Latency / Delay | MJPEG or Network Congestion | Use RTSP/H.264 for video; ensure 5GHz WiFi. |
| Camera Not Found | Connection or Permission | Check ribbon cable; Ensure `libcamera-dev` is installed. |
| QR Not Scanning | Low Light / Focus | Ensure adequate lighting and camera focus. |
| No Internet Update | WiFi not connected | Check WiFi provisioning via QR or `nmcli`. |

---

## 9. Optimization Guide (Fixing Delay)

### 9.1 Network Optimization
- **Use 5GHz WiFi**: Raspberry Pi 4/5 supports 5GHz. It is significantly faster and has lower interference than 2.4GHz.
- **Ethernet**: For maximum stability during development, use an Ethernet cable.

### 9.2 Video Latency (Switching to RTSP)
The default MJPEG stream (`/video_feed`) is high-bandwidth and burns Pi CPU. For low latency (under 500ms), use hardware-accelerated H.264 via RTSP:

1. **Install MediaMTX** on the Pi (acts as the RTSP server).
2. **Run the RTSP Helper**:
   ```bash
   ./tools/start_rtsp_stream.sh
   ```
3. **Viewer Configuration**: In the Vercel dashboard or local player, use the RTSP URL instead of the MJPEG URL.

### 9.3 Audio Latency (LiveKit Optimization)
Two-way communication delay is usually caused by buffer sizes or network jitter.
- **LiveKit Cloud**: Ensure you are using a LiveKit region close to your physical location (e.g., `ap-south-1` for India).
- **Buffer Tuning**: In `tools/livekit_audio_receiver.py`, the `blocksize=0` setting in `sd.RawOutputStream` is already optimized for low latency. Ensure no other heavy processes are running on the Pi.

---
**Prepared By**: Trae AI Assistant
**Date**: 2026-06-04
**Version**: 3.2 (Optimization & Latency Fixes)
