---
name: rpi-smart-helmet-streaming
description: Build, configure, and operate a low-latency Raspberry Pi live-streaming smart helmet with SRS (Simple Realtime Server), HTTP-FLV, WebRTC two-way talkback, BLE beacon location tracking, and offline GPIO recording.
---

# Raspberry Pi Smart Helmet: Low-Latency Streaming & Edge IoT Harness

Use this skill when developing, debugging, or deploying real-time video streaming, WebRTC two-way talkback, BLE indoor tracking, or offline-resilient sensor capture on ARM Linux devices (Raspberry Pi 4B and 5).

---

## 1. System Architecture & Topology

The system splits video ingestion, client playback, and reverse audio to achieve sub-second latency on resource-constrained ARM hardware without heavy cloud mesh costs.

```
+---------------------------------------------------------------------------+
|                           Raspberry Pi 4B / 5                             |
|                                                                           |
|  [CSI/USB Camera] ---> rpicam-vid (H.264 720p@24fps)                      |
|                                |                                          |
|  [USB Mic hw:3,0] ---> ffmpeg (AAC mixing) ---> RTMP (localhost:1935)     |
|                                                      |                    |
|                                                      v                    |
|  [Pi Speaker] <--- webrtc_audio_player <--- [ SRS Streaming Engine ]     |
|                         (WebRTC Ingress)    (Docker / Native Daemon)      |
|                                                      |                    |
+------------------------------------------------------|--------------------+
                                                       | HTTP-FLV (:8080)
                                                       v
+---------------------------------------------------------------------------+
|                          Web / Mobile Client                              |
|                                                                           |
|  - Video: Next.js + mpegts.js (Subscribes to HTTP-FLV stream)             |
|  - Talkback: Browser Mic ---> WebRTC audio stream published to SRS        |
|  - Location: Real-time RSSI beacon pins mapped onto interactive timeline   |
|  - AI Inspection: Gemini Flash PPE detection with timestamp seeking       |
+---------------------------------------------------------------------------+
```

### Core Architecture Principles
* **Video Egress (Pi to Browser):** Uses SRS (Simple Realtime Server) exporting HTTP-FLV consumed by `mpegts.js`. This eliminates WebRTC SDP signaling overhead for broad viewer fan-out while keeping latency under 800ms.
* **Audio Ingress (Browser to Pi Speaker):** Uses WebRTC audio publishing directly into SRS. A background script (`webrtc_audio_player.py`) subscribes to the audio room and routes sound to the physical 3.5mm jack or USB speaker.
* **Network Isolation:** Vercel cloud deployments cannot reach local LAN IP addresses (`192.168.x.x`). A public gateway (Cloudflare Tunnel or static IP) must route `/api/device/*` calls to the Pi's Flask API. When testing locally, run the frontend on the same subnet.

---

## 2. Hardware Constraints & Radio Contention

### The BLE / Wi-Fi Radio Contention Trap
* **The Root Cause:** The Raspberry Pi 4B and Pi 5 use a single combo chip (Cypress CYW43455) for both 2.4/5GHz Wi-Fi and Bluetooth 5.0. 
* **The Symptom:** When running background BLE beacon scans (`ble_locator.py`) using active discovery, the Wi-Fi link drops frames, causing HTTP-FLV video stuttering and WebRTC socket disconnections.
* **The Fix:**
  1. Set the BLE scanner to passive scanning mode where possible.
  2. Implement an inquiry scan window and throttle BLE polling intervals (e.g. scan for 800ms, sleep for 2200ms) instead of continuous scanning loops.
  3. Where high-throughput video is non-negotiable, run Wi-Fi strictly on 5GHz channels to minimize time-division collisions with 2.4GHz Bluetooth.

### Camera Pipeline Configurations
* **CSI Camera (Pi Camera v2 / IMX219):**
  * Requires enabling camera overlays in `/boot/firmware/config.txt` (or `/boot/config.txt` on older OS).
  * Video pipeline must use `rpicam-vid` with hardware encoding:
    ```bash
    rpicam-vid -t 0 --inline --width 1280 --height 720 --framerate 24 --bitrate 1100000 -o - | \
    ffmpeg -re -f h264 -i - -f alsa -ar 16000 -ac 1 -i hw:3,0 \
      -c:v copy -c:a aac -b:a 64k \
      -f flv rtmp://127.0.0.1:1935/live/helmet
    ```
* **USB Webcams (UVC standard):**
  * Auto-detect `/dev/video*` devices. Use V4L2 directly via `ffmpeg -f v4l2 -input_format mjpeg -video_size 1280x720 -i /dev/video0`.

---

## 3. Storage Auto-Chunking & Offline Resiliency

### 50MB Cloud Upload Enforcement (Auto-Chunking)
* Cloud ingestion APIs often impose strict request payload limits (e.g. 50MB per file).
* To prevent memory overflows on the Pi, video capture is piped to `ffmpeg` with segmenting enabled:
  ```bash
  ffmpeg -re -f h264 -i - \
    -c:v copy \
    -f segment -segment_time 300 -reset_timestamps 1 -strftime 1 \
    recordings/video_%Y%m%d_%H%M%S.mp4
  ```
* This produces ~46MB files for every 5-minute block.
* A daemon thread (`gps_logger_worker`) monitors the output directory and dynamically matches each `video_YYYYMMDD_HHMMSS.mp4` with a corresponding `gps_YYYYMMDD_HHMMSS.json` metadata record containing beacon site IDs and location tags.

### Zero-Touch QR Wi-Fi Provisioning
* When deploying in remote industrial sites without monitors or keyboards:
* The `wifi-qr-connect.service` runs at boot. It scans the camera feed for standard Wi-Fi QR codes (`WIFI:T:WPA;S:MySSID;P:MyPassword;;`).
* Upon detection, it configures `wpa_supplicant.conf` or NetworkManager via `nmcli` and triggers immediate connection before releasing the camera to `srs-publisher`.

---

## 4. Systemd Daemons & Service Management

The Pi runs four isolated systemd units. Never combine these into a single monolithic script:

| Service Name | Command / Script | Purpose |
|---|---|---|
| `srs.service` | Docker container or native `/usr/local/srs/objs/srs` | RTMP/FLV/WebRTC media broker |
| `srs-publisher.service` | `publish_srs.sh` | Camera capture and ALSA audio mixing |
| `smart-helmet-backend.service` | `init.py` (Flask on port 5000) | REST API, GPS logging, file sync, Gemini calls |
| `gpio-offline-capture.service` | `gpio_offline_capture.py` | Physical helmet button triggers (GPIO 19 status LED) |
| `wifi-qr-connect.service` | `wifi_qr_connect.py` | Boot-time optical Wi-Fi onboarding |

### Service Lifecycle Commands
```bash
# Check streaming status
sudo systemctl status srs-publisher.service

# Inspect live streaming logs
journalctl -u srs-publisher.service -f --no-tail

# Restart backend API
sudo systemctl restart smart-helmet-backend.service
```

---

## 5. Strict Negative Constraints for AI Agents

When modifying this repository or similar embedded streaming projects, agents MUST obey these invariants:

1. **NO Ngrok & NO LiveKit:** 
   * These services are deprecated in this architecture. Do not suggest or restore them. All video must route through the local or hosted SRS instance.
2. **Never Hardcode LAN IP Addresses in Client Bundles:** 
   * Do not assume `192.168.0.240` or any subnet IP will be reachable by remote browsers. Client-side fetch requests must route via `/api/device/*` reverse proxy or configured `DEVICE_API_BASE`.
3. **Never Block on Video Metadata Loading:** 
   * In Next.js/React video screens, always specify `preload="none"` on `<video>` elements. Browsers will exhaust connection pools if they attempt to preload multiple 50MB chunks simultaneously.
4. **Never Put Component Definitions Inside Render Functions:** 
   * Card components (e.g. `SafetyVideoCard`) must remain at top-level module scope. Defining components inside screens causes unmounting and re-mounting on every background device poll, interrupting active video playback.
5. **Atomic File Renaming for Cloud Uploads:** 
   * Video, JSON, and CSV files must be renamed in lockstep with matching timestamp prefixes (`site_{site_id}_uploaded...`) before dispatching to the cloud to prevent orphaned location metadata.

---

## 6. Troubleshooting Runbook

### Video Stream Black Screen / Connection Refused
1. Verify SRS is running: `curl -I http://127.0.0.1:8080/live/helmet.flv`
2. Check ALSA microphone index: run `arecord -l`. If the USB microphone shifted from card 3 to card 2, update `.env` with `ALSA_MIC_DEVICE=hw:2,0`.
3. Check camera lock: `fuser /dev/video0` or `vcgencmd get_camera`.

### Frame Drops & Jittering
1. Check CPU temperature and throttling: `vcgencmd measure_temp` and `vcgencmd get_throttled`.
2. Disable active BLE scanning: `sudo systemctl stop ble-locator.service` to verify if Wi-Fi frame drops cease.
3. Lower video bitrate to 800kbps in `publish_srs.sh`.

### Audio Echo / Talkback Feedback
1. Pi speaker and microphone must have physical acoustic isolation on the helmet.
2. Ensure `webrtc_audio_player.py` does not loop audio back into the ALSA recording device.
