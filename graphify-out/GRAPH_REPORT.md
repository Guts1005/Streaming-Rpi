# Graph Report - hm_releases-main  (2026-05-26)

## Corpus Check
- 18 files · ~13,471 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 222 nodes · 272 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]

## God Nodes (most connected - your core abstractions)
1. `main()` - 14 edges
2. `Camera` - 12 edges
3. `Smart Helmet Interface Handoff For Codex` - 10 edges
4. `Smart Helmet Camera System v27.1` - 9 edges
5. `AudioRecorder` - 8 edges
6. `VideoRecorder` - 8 edges
7. `Prototype V1 Streaming Plan` - 7 edges
8. `LedController` - 6 edges
9. `extract_timestamp()` - 5 edges
10. `run()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (18 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (31): 1. Clone/Pull from Git, 2. Run the System, Check Logs, code:bash (cd ~/Desktop/Projects/hm_releases/), code:bash (python3 main.py), code:python (DEVICE_ID = "smart_hm_02"  # Change to your device ID), code:block4 (POST: https://centrix.co.in/v_api/upload), code:bash (openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert) (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (19): api_upload_cloud(), batch_upload(), camera_worker(), delete_batch(), extract_timestamp(), _find_existing_gps_json_for_video(), get_gps_data(), get_lan_addresses() (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (15): countdown(), draw_overlay(), get_current_ssid(), has_ipv4(), init_camera_like_main(), launch_main_py(), LedController, main() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (4): AudioRecorder, Segmentation loop for "with audio" scenario. Each chunk is recorded         unti, Stop recording. If any partial segment is still open, close it out,         reco, VideoRecorder

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (6): Camera, Ensure the pipeline is in video mode with rotation and running., Restore the preview mode after any capture/recording., Update camera controls in real-time.         Maps slider values (0–100) → (0.0–1, Starts the preview with a 180-degree rotated image., Capture still image with rotation and restore preview afterwards.

### Community 5 - "Community 5"
Cohesion: 0.38
Nodes (6): _extract_times_from_filename(), Cloud Upload Module for Smart Helmet Uploads: video file + start_location + stop, Extract start/end time from names like:       video_20251225_211046_chunk000.mp4, Upload video and location payload to cloud.      Args:       video_path: absolut, upload_image_to_cloud(), upload_to_cloud()

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (19): API Endpoints Useful For Interface Work, code:text (User starts main.py), code:text (graphify-out/GRAPH_REPORT.md), code:text (Read TEAM_INTERFACE_HANDOFF.md first.), code:text (/graphify query "interface stream health media controls GPS"), code:bash (graphify query "interface stream health media controls GPS" ), code:bash (python3 main.py), code:bash (python3 init.py) (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (15): code:bash (python3 main.py), code:bash (pip install -r requirements-host.txt), code:bash (python tools/host_mjpeg_viewer.py --discover), code:bash (python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001), code:bash (sudo apt update), code:bash (RTSP_URL=rtsp://127.0.0.1:8554/pi-cam tools/start_rtsp_strea), code:bash (ffplay rtsp://<pi-ip>:8554/pi-cam), code:python (cap = cv2.VideoCapture("rtsp://<pi-ip>:8554/pi-cam")) (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (10): code:text (Local implementation progress: 100%), code:bash (python -m py_compile init.py uploader.py tools/host_mjpeg_vi), code:bash (python3 init.py), code:bash (python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001), code:bash (python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/), code:text (http://<pi-ip>:5001/), Commands Run Locally, Commands To Run On The Raspberry Pi (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.70
Nodes (4): read(), test_host_and_rtsp_helpers_exist(), test_init_py_has_v1_stream_health_routes(), test_stream_metadata_state_is_tracked()

### Community 15 - "Community 15"
Cohesion: 0.80
Nodes (4): check_mjpeg(), main(), read_json(), read_url()

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): discover(), main(), open_stream()

## Knowledge Gaps
- **51 isolated node(s):** `generate_certs.sh script`, `start_rtsp_stream.sh script`, `Core Files (REQUIRED)`, `DO NOT Push to Git`, `code:bash (cd ~/Desktop/Projects/hm_releases/)` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `generate_certs.sh script`, `Supported:     1) WIFI:T:WPA;S:MySSID;P:MyPass;;     2) {"ssid":"MySSID","pass`, `Cloud Upload Module for Smart Helmet Uploads: video file + start_location + stop` to the rest of the system?**
  _63 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 7` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._