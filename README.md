<div align="center">

# 🪖 Smart Vision Edge / Smart Helmet (`Streaming-Rpi`)

### Industrial-Grade Edge Video Streaming, BLE Tracking & AI Safety System for Raspberry Pi

[![GitHub Stars](https://img.shields.io/github/stars/Guts1005/Streaming-Rpi?style=for-the-badge&logo=star&color=ffd700)](https://github.com/Guts1005/Streaming-Rpi/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Guts1005/Streaming-Rpi?style=for-the-badge&logo=git&color=58a6ff)](https://github.com/Guts1005/Streaming-Rpi/network/members)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-4%20%2F%205-A22846?style=for-the-badge&logo=raspberrypi&logoColor=white)](https://raspberrypi.org)
[![SRS](https://img.shields.io/badge/Streaming-SRS%205-red?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/ossrs/srs)
[![License: MIT](https://img.shields.io/badge/License-MIT-3DA639?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Sub-300ms Glass-to-Glass Latency · Two-Way Audio Talkback · Offline-First Auto Sync · Headless QR Wi-Fi · BLE Beacons · Google Gemini AI</b>
</p>

⭐ **If you find this project useful for IoT, robotics, or edge video streaming, please star the repository!**

</div>

---

## Key Features

- **Ultra-Low Latency Live Streaming**: Ingests hardware-encoded H.264 video into a local **SRS (Simple Realtime Server)** container and streams HTTP-FLV feeds to the web dashboard with sub-second latency using `mpegts.js`.
- **Two-Way Audio Talkback**: Browser-to-Pi real-time push-to-talk capability enabling remote experts to communicate directly with on-site workers through the helmet's speaker.
- **Offline-First & Auto-Chunked Recording**: Hardware GPIO button triggers local video and photo capture. Video streams are automatically segmented into 5-minute chunks (~46MB) via `ffmpeg` to prevent file corruption and comply with cloud API size limits.
- **Automated Offline Sync**: Automatically syncs locally captured videos, snapshots, and accompanying BLE beacon telemetry sequentially to the cloud once network connectivity is restored.
- **Headless Wi-Fi QR Provisioning**: Automatically launches a camera-based QR scanner on boot if no internet connection is detected, allowing instant Wi-Fi setup in the field without monitor, keyboard, or mouse.
- **BLE Beacon Location Tracking**: Continuously scans nearby Bluetooth Low Energy (BLE) beacons, logging exact worker transitions between zones and generating site-wise CSV reports.
- **AI Safety Command Center**: Integrated with **Google Gemini AI** to inspect recorded footage, transcribe audio, detect PPE violations (helmets, safety vests, harnesses), and generate automated incident reports.
- **Multi-Tenant Fleet Management**: Full Next.js cloud dashboard (`source/`) with Master Data Management (Companies, Customers, Sites, Devices) and interactive beacon timeline filtering.

---

## System Architecture

```
                       ┌─────────────────────────────────────────────────────────┐
                       │                     Raspberry Pi                        │
                       │                                                         │
  Camera (CSI/USB) ───►│  rpicam-vid / ffmpeg ──► SRS Server (Docker :8082)      │
                       │                               │                         │
  USB Mic / Speaker ◄──┼── WebRTC / ALSA Audio ◄───────┤ (HTTP-FLV / Live)       │
                       │                               ▼                         │
  GPIO Buttons ───────►│  gpio_offline_capture.py ──► Nginx Reverse Proxy (:80)  │
                       │                               ▲                         │
  BLE Beacons ────────►│  ble_locator.py               │ (REST API / Media)      │
                       │          ▼                    │                         │
                       │  Flask Backend (init.py :5001)┘                         │
                       └───────────────────────┬─────────────────────────────────┘
                                               │ Cloudflare Tunnel
                                               ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │             Cloud Dashboard (Next.js / Vercel)          │
                       │                                                         │
                       │  • Live View (mpegts.js FLV Player)                     │
                       │  • Two-Way Audio Talkback                               │
                       │  • Interactive Beacon Timelines                         │
                       │  • AI Safety Analysis (Google Gemini API)               │
                       │  • Device & Site Fleet Management (PostgreSQL)          │
                       └─────────────────────────────────────────────────────────┘
```

---

## Hardware & GPIO Pinout

### Recommended Hardware
- **Single Board Computer**: Raspberry Pi 4B (4GB+) or Raspberry Pi 5.
- **Camera**: Raspberry Pi Camera Module (v2 / v3 CSI), IMX219 sensor, or standard USB UVC webcam (e.g. Logitech C920).
- **Audio**: USB Microphone and 3.5mm/USB speaker or amplifier.
- **Storage**: High-end MicroSD card (Class 10, U3, 32GB+).
- **Power**: Official Raspberry Pi 15W / 27W USB-C power supply or 5V 3A battery pack.

### GPIO Mapping

| GPIO Pin | Physical Pin | Function | Hardware Component | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 6** | Pin 31 | Video Recording | Push Button (Active Low) | Press to Start / Stop local recording |
| **GPIO 13** | Pin 33 | Snapshot Capture | Push Button (Active Low) | Press to capture immediate photo |
| **GPIO 19** | Pin 35 | Status / Wi-Fi LED | Indicator LED (Active High) | Blinks during QR scan; Solid when live |
| **GPIO 26** | Pin 37 | Recording LED | Indicator LED (Active High) | Solid during recording; Blinks on photo |
| **GND** | Pin 39 | Ground | Common Ground | Pull-down / button return |

---

## Repository Structure

```
.
├── init.py                      # Core edge Flask backend (APIs, media management, stream endpoints)
├── uploader.py                  # Cloud media and beacon telemetry upload service
├── ble_locator.py               # Background BLE scanner for RSSI-based beacon zone tracking
├── setup_pi.sh                  # Turnkey, automated Raspberry Pi installation script
├── updater.sh                   # Startup network check and auto-updater script
├── requirements.txt             # Python dependencies for the edge backend
├── source/                      # Modern Next.js (v16) Cloud Management Dashboard
│   ├── app/                     # App Router pages and API routes
│   │   ├── page.tsx             # Main live streaming & monitoring dashboard
│   │   └── api/device/[...path] # Edge device proxy route
│   ├── components/              # UI screens (SafetyScreen, TranscriptsScreen, BeaconLocationsScreen)
│   └── package.json             # Frontend dependencies
├── tools/                       # Systemd service unit files and system helpers
│   ├── publish_srs.sh           # Hardware H.264/FFmpeg pipeline publishing RTMP to SRS
│   ├── gpio_offline_capture.py  # GPIO button monitoring and offline recording daemon
│   ├── srs-publisher.service    # Systemd service: Live video publisher
│   ├── smart-helmet-backend.service # Systemd service: Flask API backend
│   ├── gpio-offline-capture.service # Systemd service: GPIO button listener
│   ├── wifi-qr-connect.service  # Systemd service: Boot-time WiFi QR scanner
│   └── nginx.conf               # Local Nginx reverse proxy configuration
├── templates/                   # Local Flask fallback templates
└── PROJECT_MEMORY.md            # Active engineering state, architecture, and change log
```

---

## Installation & Setup

### 1. Raspberry Pi (Edge Device)

#### Option A: Automated Installation (Recommended)
On a fresh Raspberry Pi OS (64-bit) installation with network access:

```bash
cd ~
git clone https://github.com/Guts1005/Streaming-Rpi.git hm_releases
cd hm_releases
bash setup_pi.sh
```

The script will interactively configure your camera module (PiCam / IMX219 / USB) and microphone, install Docker and Nginx, configure Python virtual environments, and register all required `systemd` services.

#### Option B: Manual Service Management
If configuring manually, install the system dependencies and enable the services:

```bash
# Install system packages
sudo apt update
sudo apt install -y python3-venv python3-pip libzbar0 libcamera-dev libcap-dev ffmpeg python3-rpi.gpio libasound2-dev portaudio19-dev docker.io nginx

# Set up virtual environment
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install -r requirements.txt

# Start SRS Container
sudo docker run -d --restart always --name srs -p 1935:1935 -p 1985:1985 -p 8082:8080 ossrs/srs:5

# Enable services
sudo cp tools/*.service /etc/systemd/system/
sudo cp tools/nginx.conf /etc/nginx/sites-available/default
sudo systemctl daemon-reload
sudo systemctl enable --now nginx srs-publisher gpio-offline-capture smart-helmet-backend
```

Check service health:
```bash
sudo systemctl status srs-publisher gpio-offline-capture smart-helmet-backend
```

---

### 2. Cloud Dashboard (`source/`)

The web dashboard is built using Next.js 16 with React 19.

#### Local Development
```bash
cd source
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Environment Variables (`source/.env.local`)
```env
POSTGRES_URL=your_postgresql_database_url
POSTGRES_URL_NON_POOLING=your_postgresql_direct_url
GEMINI_API_KEY=your_google_gemini_api_key
DEVICE_API_BASE=https://your-cloudflare-tunnel-url.com
```

#### Production Deployment (Vercel)
```bash
cd source
npm run build
vercel --prod --yes
```

---

## Operating Modes & Workflows

### 1. Headless Wi-Fi Provisioning
If the Raspberry Pi boots in a field location without known Wi-Fi networks:
1. `wifi-qr-connect.service` triggers automatically.
2. Status LED (`GPIO 19`) blinks to indicate scanning mode.
3. Hold a standard Wi-Fi QR code in front of the helmet camera:
   ```text
   WIFI:T:WPA;S:YourSSID;P:YourPassword;;
   ```
4. Once scanned, the Pi connects to the Wi-Fi network and starts streaming services automatically.

### 2. Offline Captures & Syncing
When working in dead zones or shielded industrial basements:
- Press **GPIO 6** to start recording directly to internal storage.
- The stream auto-segments into 5-minute `.mp4` chunks with matched `.json` beacon telemetry.
- When internet connectivity is detected, `gpio_offline_capture.py` calls `/api/sync_offline` to sequentially upload media to the cloud backend without dropping beacon metadata or overloading system RAM.

### 3. AI Safety Inspection
- Synced or locally selected `.mp4` files can be inspected directly on the dashboard's **Safety Command Center**.
- Google Gemini evaluates video frames against site safety protocols, surfacing timestamped violations (e.g. missing PPE, hazardous zones) and generating exportable reports.

---

## Important Architectural Notes

- **Camera Hardware Exclusivity**: On Linux/Raspberry Pi OS, camera capture devices (`libcamera` / `/dev/video0`) cannot be accessed by multiple processes concurrently. When local recording starts, the system automatically pauses the SRS publisher to grant exclusive hardware access, resuming the live stream when recording finishes.
- **Deprecated Technologies**: **LiveKit and Ngrok are completely deprecated**. All video streams run on SRS HTTP-FLV, and remote access is managed via Cloudflare Tunnels (`cloudflared`).
- **Secret Safety**: Do not commit `.env`, SSL certificates (`cert.pem`, `key.pem`), or authentication tokens into version control.

---

## ⭐ Star History

If you're building with Raspberry Pi, video streaming, or IoT edge systems, drop a star on the repo to support continuous development!

<div align="center">
  <a href="https://star-history.com/#Guts1005/Streaming-Rpi&Date">
    <img src="https://api.star-history.com/svg?repos=Guts1005/Streaming-Rpi&type=Date&theme=dark" alt="Star History Chart" width="75%">
  </a>
</div>

---

## Contributing & Community

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Guts1005/Streaming-Rpi/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.