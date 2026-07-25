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

## 4. Core Technical Architecture
- **Hardware:** Raspberry Pi 
- **Video Capture:** `rpicam-vid` (hardware H.264, 720p 24fps) piped to `ffmpeg` for ALSA audio mixing.
- **Cloud Backend:** Centrix (`centrix.co.in`) handles media storage. Vercel PostgreSQL handles device/beacon configuration.
- **Single Source of Truth:** We rely on the Centrix API as the single source of truth for media counts to prevent database split-brain.
- **Updates:** `updater.sh` handles auto-pulling the latest GitHub commits on reboot if internet is available.

## 5. Removed or Reverted Features
*(None currently - record any reverted architecture here to avoid repeating mistakes)*
