# Smart Helmet Project Context & Memory

This document serves as a permanent, locally stored memory bank for the AI assistant and the development team. 
**CRITICAL RULE:** Any AI agent working on this repository MUST update this file whenever a change is made (added, modified, or removed). 

## 1. The "Compression Plan" (Auto-Chunking)
- **The Problem:** The Centrix cloud API (`https://centrix.co.in/v_api/upload`) has a strict **50MB upload limit**.
- **The Solution (Implemented):** Implemented **Real-Time Auto-Chunking** using `ffmpeg`.
- **How it works:** The raw hardware H.264 stream from `rpicam-vid` (720p, 24fps, 1.1Mbps) is piped directly into `ffmpeg`. `ffmpeg` copies the video stream (`-c:v copy`) and segments it into exactly **5-minute chunks** (`-f segment -segment_time 300`). This guarantees no chunk ever exceeds the 50MB limit, creating ~46MB files. 
- **Timestamps:** The chunks are dynamically named with exactly perfectly formatted timestamps (`video_YYYYMMDD_HHMMSS.mp4`) using `strftime`, which natively aligns with the beacon timestamps.

## 2. Beacon Data Pipeline & Site IDs
- **Audio Output:** Pi runs `webrtc_audio_player.py` to play talkback audio from the browser through the Pi speaker.
- **BLE Scanner:** `ble_locator.py` runs an async loop checking RSSI and updating `/api/update_gps`.
- **GPS Logger**: A daemon thread `gps_logger_worker` runs continuously while `is_recording_active = True`. It scans the `RECORD_FOLDER` for the latest `video_*.mp4` created by `ffmpeg` and appends current GPS/BLE locations to the corresponding `gps_*.json` file. This allows robust GPS alignment even when the camera is locked by `rpicam-vid`.
- **The Bug:** `ble_locator.py` scanned beacons and knew the `site_id`, but dropped it when posting to the local Pi backend. Therefore, `init.py` and `uploader.py` uploaded the videos without any `site_id`.
- **The Solution (Implemented):** 
  - `ble_locator.py` now explicitly passes `site_id`, `beacon_mac`, and `location_name` to the local backend.
  - `init.py` intercepts this and writes the full payload into `gps_YYYYMMDD_HHMMSS_chunk000.json`.
  - Both video and image cloud upload functions in `uploader.py` now explicitly extract `site_id` and inject it into the `data["site_id"]` form-data payload sent to Centrix.

## 3. UI & Site-Wise CSV Filtering (Mentor Task)
- **Dynamic Live Beacons UI:** Replaced the static "Location List" on the Live Stream dashboard with a dynamic "Current Location" widget. It pulls `deviceStatus.gps.location_name` from the Pi (`/api/status`) and updates the UI instantly when the worker walks near a new beacon.
- **Site-Wise CSV Downloads:** The "Location Report" and "Master Report" buttons on the Next.js dashboard now automatically attach the `?site_id=` parameter. The Pi's `init.py` backend (`/api/beacons/logs` and `/api/beacons/master_logs`) intercepts this, uses Python's `csv` module to filter the file in-memory, and returns only the rows for that specific site.
- **Filename Start & Stop Time:** `init.py` handles renaming local files to include exact durations (e.g. `_to_HHMMSS`). It ensures `.mp4`, `.json`, and `.csv` files are renamed identically in a centralized manner before uploads to avoid orphaning beacon metadata.
- **UI Tweaks:** Fixed the dashboard logo text being cut off by changing `.brand-image` from `object-fit: cover` to `object-fit: contain` in `globals.css`.

## 3.5 Offline Beacon Sync & Site ID Video Segregation
- **Bulletproof Video Naming:** `init.py` now deeply validates the associated `gps_...json` logs when finalizing a chunk for upload, dynamically discovers the `site_id`, and prefixes the finalized video and JSON names (e.g., `site_{site_id}_uploaded...`). This completely robust approach prevents "Premature Site ID" bugs and correctly feeds into the cloud database for video segregation.
- **Offline Background Sync:** The background service `gpio_offline_capture.py` no longer uploads raw files directly (which abandoned offline beacon JSON). It now pings a robust, purely sequential `/api/sync_offline` endpoint in `init.py`. This ensures perfect offline sync of videos *and* their beacon locations without spiking Pi RAM/CPU limits through massive parallel threads.
- **UI Robustness:** All dashboard screens (Beacon Locations, Safety, Video to Text) now support relaxed regex checks to properly accept these `site_...` prefixes without breaking timeline parsing or media galleries.

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
- **Gemini Flash 1.5 Integration:** A new dashboard page that allows users to select a video and run it through the Gemini Flash API to detect safety violations (missing helmets, vests, lanyards, etc.).
- **Video Trimming & Export:** A new "Auto-cut" feature allows users to filter by safety violations and download cropped clips showing only the violation times, but the user rejected this implementation and requested timeline filtering instead.
- **Beacon Locations Page:** A dedicated tab that aggregates recorded videos by their detected beacon location, showing analytics like safety alerts per video in that specific location.
- **UI Architecture:** Videos are split into **Locally Synced Videos** (selected via the File System Access API or manual file picker) and **Helmet Videos** (fetched from the Pi via Cloudflare proxy).
- **Hazard Video Player:** The player dynamically extracts timestamps from the AI report and jumps to the exact second a violation occurred.
- **Video Auto-Resume Fix**: Resolved an issue where dashboard polling (e.g., helmet offline status checks) caused parent re-renders. The inline `URL.createObjectURL` was previously generating new strings on every render, causing the `<video>` element to reload and auto-play. We fixed this by caching the blob URL in a `useRef`.
- **UI Enhancements**: Added an expandable/collapsible toggle ("Show/Hide") to the Violations list. Split local synced videos and helmet videos into distinct UI sections, maintaining consistency with `TranscriptsScreen.tsx`.
- **Local File Uploads**: Both `TranscriptsScreen` and `SafetyScreen` now allow users to upload ANY `.mp4` video (not strictly prefixed with `video_`, `uploaded_`, etc.) to support custom demo videos for mentors.
- **Session Expiration Fix**: Fixed a bug on the main dashboard (`page.tsx`) where an expired session token caused the `fetch('/api/auth/session')` to fail without redirecting the user to `/login`. This left the `currentUser` as `null` and made the project/device selector appear completely empty, giving the illusion that the database was disconnected. Unauthenticated users are now forcefully redirected to `/login`.

## 7. Interactive Beacon Timeline & Filtering
- **Horizontal Timeline UI**: We entirely replaced the old "pill badge" location list for recorded videos with a sleek, horizontal track timeline matching the new mockup. It features visual pins, exact absolute timestamps (e.g., `10:15:24 AM`), semantic Location Names, and Zone IDs.
- **Video Navigation**: A "Filter" dropdown allows managers to filter the timeline by "All Zones" or specific beacons. For recorded videos, selecting a zone automatically seeks the `<video>` element to the first timestamp the helmet entered that physical location. We also added **Next/Previous** buttons to quickly jump between occurrences of the selected zone.
- **Live Stream Tracking Simplified**: We removed the complex horizontal timeline from the Live Stream view. Instead, the Live Stream now exclusively uses the dynamic "Current Location" box, which reliably pulls `deviceStatus.gps` and compares it to the cloud database to show the current zone.
- **Device Connections Sync**: Fixed a bug where the "Beacons" tab in the Device Connections modal failed to show names/coordinates for already-paired beacons. The modal now ingests the cloud `masterBeacons` database and cross-references scanned MAC addresses to correctly pre-fill location names and coordinates.

