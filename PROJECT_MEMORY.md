# Smart Helmet Project Context & Memory

This document serves as a permanent, locally stored memory bank for the AI assistant and the development team. 
**CRITICAL RULE:** Any AI agent working on this repository MUST update this file whenever a change is made (added, modified, or removed). 

## 1. The "Compression Plan" (Auto-Chunking)
- **The Problem:** The Centrix cloud API (`https://centrix.co.in/v_api/upload`) has a strict **50MB upload limit**.
- **The Solution (Implemented):** Implemented **Real-Time Auto-Chunking** using `ffmpeg`.
- **How it works:** The raw hardware H.264 stream from `rpicam-vid` (720p, 24fps, 1.5Mbps) is piped directly into `ffmpeg`. `ffmpeg` copies the video stream (`-c:v copy`) and segments it into exactly **4-minute chunks** (`-f segment -segment_time 240`). This guarantees no chunk ever exceeds the 50MB limit. 
- **Timestamps:** The chunks are dynamically named with exactly perfectly formatted timestamps (`video_YYYYMMDD_HHMMSS.mp4`) using `strftime`, which natively aligns with the beacon timestamps.

## 2. Beacon Data Pipeline & Site IDs
- **The Problem:** The web dashboard's Location List wasn't able to group videos/images by `site_id` because the data was missing.
- **The Bug:** `ble_locator.py` scanned beacons and knew the `site_id`, but dropped it when posting to the local Pi backend. Therefore, `init.py` and `uploader.py` uploaded the videos without any `site_id`.
- **The Solution (Implemented):** 
  - `ble_locator.py` now explicitly passes `site_id`, `beacon_mac`, and `location_name` to the local backend.
  - `init.py` intercepts this and writes the full payload into `gps_YYYYMMDD_HHMMSS_chunk000.json`.
  - Both video and image cloud upload functions in `uploader.py` now explicitly extract `site_id` and inject it into the `data["site_id"]` form-data payload sent to Centrix.

## 3. Core Technical Architecture
- **Hardware:** Raspberry Pi 
- **Video Capture:** `rpicam-vid` (hardware H.264, 720p 24fps) piped to `ffmpeg` for ALSA audio mixing.
- **Cloud Backend:** Centrix (`centrix.co.in`) handles media storage. Vercel PostgreSQL handles device/beacon configuration.
- **Single Source of Truth:** We rely on the Centrix API as the single source of truth for media counts to prevent database split-brain.
- **Updates:** `updater.sh` handles auto-pulling the latest GitHub commits on reboot if internet is available.

## 4. Removed or Reverted Features
*(None currently - record any reverted architecture here to avoid repeating mistakes)*
