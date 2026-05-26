# Smart Helmet Interface Handoff For Codex

Use this file as the starting context for a new Codex session focused on the interface work.

## Project Goal

This repository is the first prototype for a Raspberry Pi smart helmet camera system.

Immediate V1 goal:

1. Stream live camera footage from the Raspberry Pi.
2. View that livestream from another system, usually a PC/host on the same local network.
3. Keep the Pi lightweight so future AI/object detection can run on the PC/host, not on the Pi.

The Raspberry Pi should mainly be:

- Camera acquisition device.
- GPIO/LED controller.
- Lightweight local-network streamer.
- Optional local recording/upload controller.

The PC/host should later become:

- Viewer UI.
- AI/object detection runtime.
- Overlay renderer.
- Event/control coordinator.

## Current Repository Shape

Important files:

- `main.py`: QR-based WiFi provisioning flow. Uses Picamera2, OpenCV, pyzbar, nmcli, and a GPIO LED. After successful WiFi setup it launches `init.py`.
- `init.py`: active camera/web runtime. Runs Flask on port `5001`, serves the MJPEG stream, records H.264 video, records optional USB audio, tracks browser GPS, manages media, uploads media, and exposes health/control APIs.
- `templates/index.html`: current web interface template. Treat this as the example template and starting point for interface work.
- `uploader.py`: cloud upload client for video/image files and GPS metadata.
- `tools/host_mjpeg_viewer.py`: PC/host OpenCV viewer for the existing MJPEG stream.
- `tools/start_rtsp_stream.sh`: future RTSP/H.264 helper for Raspberry Pi.
- `V1_STREAMING_PLAN.md`: architecture and prototype streaming plan.
- `requirements.txt`: Pi/runtime Python dependencies.
- `requirements-host.txt`: PC/host viewer dependency.
- `graphify-out/`: generated knowledge graph artifacts.

Current Graphify result:

- `graphify-out/graph.json`: machine-readable graph, 153 nodes, 197 edges, 16 communities.
- `graphify-out/GRAPH_REPORT.md`: readable structural report.
- `graphify-out/graph.html`: interactive graph visualization.
- `graphify-out/GRAPH_TREE.html`: file/tree oriented graph.
- `graphify-out/hm_releases-main-callflow.html`: call-flow visualization.

Note: Graphify full semantic LLM extraction was not available because no Graphify LLM API key was configured. The graph is still useful because it captures the extracted code structure and relationships.

## What Has Already Been Done

The current V1 work chose option 1: validate the existing Flask MJPEG stream first, then prepare for RTSP later.

Done:

- Deep project analysis.
- Graphify code graph generated.
- Added stream observability to `init.py`.
- Added `/api/health`.
- Added `/api/stream_info`.
- Added MJPEG no-cache response headers.
- Added configurable `MJPEG_QUALITY`.
- Added frame metadata counters: latest frame time, frame count, latest frame size.
- Added PC viewer script: `tools/host_mjpeg_viewer.py`.
- Added RTSP helper script: `tools/start_rtsp_stream.sh`.
- Added `V1_STREAMING_PLAN.md`.
- Added dependency manifests.
- Python syntax validation passed for changed Python files.

Still pending:

- Runtime test on the actual Raspberry Pi camera.
- Runtime test from PC using `tools/host_mjpeg_viewer.py`.
- Dependency setup for the existing uploader test in the local Windows Python environment.
- Interface refinement.

## Current Runtime Flow

```text
User starts main.py
  -> camera opens for QR scanning
  -> LED indicates provisioning status
  -> QR provides WiFi credentials
  -> nmcli switches WiFi
  -> main.py execs init.py

init.py
  -> starts Flask on 0.0.0.0:5001
  -> starts UDP discovery on 5002
  -> starts camera_worker thread
  -> Picamera2 captures lores frames
  -> OpenCV encodes JPEG
  -> /video_feed streams MJPEG frames
  -> browser UI controls record/photo/upload/media
  -> browser geolocation posts to /api/update_gps
```

## API Endpoints Useful For Interface Work

Existing:

- `GET /`: renders `templates/index.html`.
- `GET /video_feed`: MJPEG livestream.
- `GET /api/start_record`: starts video recording.
- `POST /api/stop_record`: stops video recording.
- `POST /api/toggle_audio`: toggles audio capture.
- `GET /api/capture_photo`: saves current frame as photo.
- `POST /api/update_gps`: receives browser GPS data.
- `GET /api/status`: recording, storage, audio, GPS, active chunks.
- `POST /api/rename_file`: rename one media file.
- `POST /api/rename_batch`: rename a video session/chunks.
- `GET /api/list_media`: list videos/images/chunks.
- `GET /api/get_gps_data/<filename>`: get GPS track for media.
- `POST /api/upload_cloud`: upload video.
- `POST /api/upload_image`: upload image.
- `POST /api/batch_upload`: upload chunks for a session.
- `GET /api/download/<filename>`: download media.
- `POST /api/delete_file`: delete media.
- `POST /api/delete_batch`: delete session/chunks.
- `POST /api/shutdown`: shutdown Pi.
- `GET /api/list_logs`: list log files.
- `GET /api/download_log/<filename>`: download log file.

New:

- `GET /api/health`: overall runtime/device/stream health.
- `GET /api/stream_info`: MJPEG-specific stream details and host URLs.

## Interface Work Instructions For Codex

The interface should be adjusted around the existing example template in `templates/index.html`. Do not discard the current template and rebuild from scratch unless explicitly asked.

Interface goals:

- Make the livestream the first thing the user sees.
- Keep controls simple: record/stop, audio toggle, capture photo, shutdown.
- Show stream health clearly using `/api/health` and `/api/stream_info`.
- Show connection details such as Pi IP, stream URL, frame availability, and last frame age.
- Keep media management usable: list media, preview, upload, rename, delete, download link.
- Keep GPS status visible but secondary to the video stream.
- Prepare for future AI overlays without implementing AI yet.

Design direction:

- Use `templates/index.html` as the visual and structural baseline.
- Preserve existing endpoint names and JavaScript behavior unless a change is required.
- Favor a practical operator dashboard over a marketing page.
- No landing page.
- No heavy decorative hero.
- No nested card-heavy layout.
- The first viewport should contain the live feed, status strip, and primary controls.
- Make mobile layout the primary target because the current UI is Pi/operator friendly.
- Also make desktop/PC viewing pleasant because the livestream will be watched from a host system.
- Keep the UI responsive and avoid text overflow in buttons/cards.
- Avoid adding large external frontend frameworks unless the team explicitly approves it.
- Leaflet is already used for GPS preview maps and may stay.
- Keep UI dependencies minimal because the Pi runtime should remain simple.

Suggested interface sections:

1. Live View
   - MJPEG image from `/video_feed`.
   - Recording indicator and timer.
   - Audio indicator.
   - Stream status from `/api/stream_info`.

2. Device Status
   - Online/warming/error.
   - Device ID.
   - Hostname/IP.
   - Storage free.
   - Last frame age.
   - Recording state.

3. Controls
   - Record/stop.
   - Audio toggle.
   - Capture photo.
   - Shutdown with confirmation.

4. Media
   - Current recording session/chunks.
   - Saved videos/images.
   - Upload, rename, delete, copy/download link.

5. GPS/Map
   - Current GPS state.
   - GPS track shown inside media preview.

6. Future AI Placeholder
   - Add only a small inactive status area such as "AI: external host not connected".
   - Do not implement detection, tracking, or overlays yet.
   - Leave clean DOM hooks/classes for future overlay rendering on the host.

Recommended frontend approach:

- Continue with server-rendered HTML plus vanilla JavaScript for now.
- Refactor the current long inline script only if necessary and in small steps.
- If splitting files, use `static/` for CSS/JS and keep Flask static serving standard.
- Prefer small functions around API calls and rendering.
- Keep the live stream as a simple `<img src="/video_feed">` for MJPEG V1.
- Later RTSP will not play natively in browsers; the host interface may need WebRTC, MSE, or a transcoded preview later. Do not solve that in this V1 interface pass.

## How To Use Graphify With Codex

In a new Codex session, tell Codex to inspect these files first:

```text
graphify-out/GRAPH_REPORT.md
graphify-out/graph.json
graphify-out/GRAPH_TREE.html
graphify-out/hm_releases-main-callflow.html
V1_STREAMING_PLAN.md
TEAM_INTERFACE_HANDOFF.md
```

Suggested prompt for the teammate:

```text
Read TEAM_INTERFACE_HANDOFF.md first.
Then inspect graphify-out/GRAPH_REPORT.md and graphify-out/hm_releases-main-callflow.html to understand the current project structure.
Use graphify-out/graph.json as the AI-readable knowledge graph.
Focus only on the interface in templates/index.html unless you need small backend support for already-existing endpoints.
Do not implement AI inference yet.
Do not replace the MJPEG V1 architecture.
Preserve existing endpoints and current media/recording behavior.
Use the existing template as the example style and adapt it into a cleaner operator dashboard.
```

If the Graphify skill is available in that Codex session, useful commands are:

```text
/graphify query "interface stream health media controls GPS" --budget 2500
/graphify query "camera_worker video_feed status endpoints" --budget 2500
/graphify path "video_feed" "camera_worker"
/graphify explain "init.py"
/graphify explain "templates/index.html"
```

If the CLI is available instead of the skill:

```bash
graphify query "interface stream health media controls GPS" --graph graphify-out/graph.json --budget 2500
graphify query "camera_worker video_feed status endpoints" --graph graphify-out/graph.json --budget 2500
graphify path "video_feed" "camera_worker" --graph graphify-out/graph.json
graphify explain "init.py" --graph graphify-out/graph.json
```

Use `graphify-out/graph.html`, `GRAPH_TREE.html`, and `hm_releases-main-callflow.html` visually in a browser when reasoning about file relationships and execution flow.

## Practical Local Testing

Pi:

```bash
python3 main.py
```

Direct runtime, bypassing QR provisioning:

```bash
python3 init.py
```

PC:

```bash
pip install -r requirements-host.txt
python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/video_feed
```

Health checks:

```bash
curl http://<pi-ip>:5001/api/health
curl http://<pi-ip>:5001/api/stream_info
```

## Guardrails

- Do not run heavy AI inference on the Raspberry Pi.
- Do not remove recording/upload/media features while working on the interface.
- Do not hard-switch to RTSP-only yet; MJPEG is the V1 browser validation path.
- Do not break mobile use.
- Do not introduce a frontend build system unless there is a strong reason.
- Do not commit certificates, recordings, media files, logs, or API secrets.
- Treat `Unused/` as reference material, not active runtime, unless the team decides to revive a module.

