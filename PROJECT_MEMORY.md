# Smart Helmet Project Context & Memory

This document serves as a permanent, locally stored memory bank for the AI assistant and the development team. 
**CRITICAL RULE:** Any AI agent working on this repository MUST update this file whenever a change is made (added, modified, or removed). 

## 1. The "Compression Plan" (Auto-Chunking)
- **The Problem:** The Centrix cloud API (`https://centrix.co.in/v_api/upload`) has a strict **50MB upload limit**.
- **The Solution (Implemented):** Implemented **Real-Time Auto-Chunking** using `ffmpeg`.
- **How it works:** The raw hardware H.264 stream from `rpicam-vid` (720p, 24fps, 1.1Mbps) is piped directly into `ffmpeg`. `ffmpeg` copies the video stream (`-c:v copy`) and segments it into exactly **5-minute chunks** (`-f segment -segment_time 300`). This guarantees no chunk ever exceeds the 50MB limit, creating ~46MB files. 
- **Timestamps:** The chunks are dynamically named with exactly perfectly formatted timestamps (`video_YYYYMMDD_HHMMSS.mp4`) using `strftime`, which natively aligns with the beacon timestamps.

## 2. Beacon Data Pipeline & Site IDs
- **The Problem:** The web dashboard's Location List wasn't able to group videos/images by `site_id` because the data was missing.
- **The Bug:** `ble_locator.py` scanned beacons and knew the `site_id`, but dropped it when posting to the local Pi backend. Therefore, `init.py` and `uploader.py` uploaded the videos without any `site_id`.
- **The Solution (Implemented):** 
  - `ble_locator.py` now explicitly passes `site_id`, `beacon_mac`, and `location_name` to the local backend.
  - `init.py` intercepts this and writes the full payload into `gps_YYYYMMDD_HHMMSS_chunk000.json`.
  - Both video and image cloud upload functions in `uploader.py` now explicitly extract `site_id` and inject it into the `data["site_id"]` form-data payload sent to Centrix.

## 3. UI & Site-Wise CSV Filtering (Mentor Task)
- **Dynamic Live Beacons UI:** Replaced the static "Location List" on the Live Stream dashboard with a dynamic "Current Location" widget. It pulls `deviceStatus.gps.location_name` from the Pi (`/api/status`) and updates the UI instantly when the worker walks near a new beacon.
- **Site-Wise CSV Downloads:** The "Location Report" and "Master Report" buttons on the Next.js dashboard now automatically attach the `?site_id=` parameter. The Pi's `init.py` backend (`/api/beacons/logs` and `/api/beacons/master_logs`) intercepts this, uses Python's `csv` module to filter the file in-memory, and returns only the rows for that specific site.
- **Filename Start & Stop Time:** `uploader.py` now parses the exact chunk start time from the `ffmpeg`-generated filename, captures the chunk end time from the file's modification time, and physically renames the file to `video_START_to_STOP.mp4` on the Pi's filesystem just before uploading it to Centrix.
- **UI Tweaks:** Fixed the dashboard logo text being cut off by changing `.brand-image` from `object-fit: cover` to `object-fit: contain` in `globals.css`.

## 4. Core Technical Architecture
- **Hardware:** Raspberry Pi 
- **Video Capture:** `rpicam-vid` (hardware H.264, 720p 24fps) piped to `ffmpeg` for ALSA audio mixing.
- **Cloud Backend:** Centrix (`centrix.co.in`) handles media storage. Vercel PostgreSQL handles device/beacon configuration.
- **Single Source of Truth:** We rely on the Centrix API as the single source of truth for media counts to prevent database split-brain.
- **Offline Resiliency**: 
  - If the Pi is offline, the dashboard provides a "🔗 Sync Local Folder" button using the **File System Access API**.
  - This allows users to link their PC's Downloads folder directly to the dashboard to process downloaded `.mp4` helmet videos entirely via the browser using the **Gemini File Upload API**.
- **Updates:** `updater.sh` handles auto-pulling the latest GitHub commits on reboot if internet is available.

## 5. Removed or Reverted Features
*(None currently - record any reverted architecture here to avoid repeating mistakes)*

## 6. AI Safety Command Center
- **Gemini Flash 1.5 Integration:** A new dashboard page (`SafetyScreen.tsx`) has been built that allows users to select a video and run it through the Gemini Flash API to detect safety violations (missing helmets, vests, lanyards, etc.).
- **UI Architecture:** Videos are split into **Locally Synced Videos** (selected via the File System Access API or manual file picker) and **Helmet Videos** (fetched from the Pi via Cloudflare proxy).
- **Hazard Video Player:** The player dynamically extracts timestamps from the AI report and jumps to the exact second a violation occurred.
- **Bug Fix (Auto-Resume Loop):** To prevent local videos from auto-resuming every time the dashboard polled for a status update, the `URL.createObjectURL` generation was extracted out of the render loop and wrapped in a `useRef` cache map. This prevents React from recreating the `src` string, which stops the player's `useEffect` from resetting the timeline and triggering `.play()` unexpectedly.
