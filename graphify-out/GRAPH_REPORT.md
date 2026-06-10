# Graph Report - hm_releases-main  (2026-06-03)

## Corpus Check
- 42 files · ~24,490 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 642 nodes · 798 edges · 62 communities (47 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d8071b05`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `compilerOptions` - 16 edges
3. `Camera` - 14 edges
4. `main()` - 14 edges
5. `main()` - 14 edges
6. `main()` - 14 edges
7. `AudioRecorder` - 10 edges
8. `VideoRecorder` - 10 edges
9. `Codex Handoff: Smart Helmet Dashboard + Vercel Deployment` - 10 edges
10. `Smart Helmet Camera System v27.1` - 10 edges

## Surprising Connections (you probably didn't know these)
- `open_stream()` --references--> `str`  [EXTRACTED]
  Streaming-Rpi/tools/host_mjpeg_viewer.py → tools/host_mjpeg_viewer.py
- `countdown()` --references--> `int`  [EXTRACTED]
  main.py → Streaming-Rpi/main.py

## Import Cycles
- None detected.

## Communities (62 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (31): 1. Clone/Pull from Git, 2. Run the System, Check Logs, code:bash (cd ~/Desktop/Projects/hm_releases/), code:bash (python3 main.py), code:python (DEVICE_ID = "smart_hm_02"  # Change to your device ID), code:block4 (POST: https://centrix.co.in/v_api/upload), code:bash (openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert) (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (25): api_upload_cloud(), batch_upload(), camera_worker(), delete_batch(), extract_timestamp(), _find_existing_gps_json_for_video(), get_gps_data(), get_lan_addresses() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (15): countdown(), draw_overlay(), get_current_ssid(), has_ipv4(), init_camera_like_main(), launch_main_py(), LedController, main() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (4): AudioRecorder, Segmentation loop for "with audio" scenario. Each chunk is recorded         unt, Stop recording. If any partial segment is still open, close it out,         rec, VideoRecorder

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (6): Camera, Ensure the pipeline is in video mode with rotation and running., Restore the preview mode after any capture/recording., Update camera controls in real-time.         Maps slider values (0–100) → (0.0–, Starts the preview with a 180-degree rotated image., Capture still image with rotation and restore preview afterwards.

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (3): get_lan_addresses(), health(), stream_info()

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (19): API Endpoints Useful For Interface Work, code:text (User starts main.py), code:text (graphify-out/GRAPH_REPORT.md), code:text (Read TEAM_INTERFACE_HANDOFF.md first.), code:text (/graphify query "interface stream health media controls GPS"), code:bash (graphify query "interface stream health media controls GPS" ), code:bash (python3 main.py), code:bash (python3 init.py) (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (15): code:bash (python3 main.py), code:bash (pip install -r requirements-host.txt), code:bash (python tools/host_mjpeg_viewer.py --discover), code:bash (python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001), code:bash (sudo apt update), code:bash (RTSP_URL=rtsp://127.0.0.1:8554/pi-cam tools/start_rtsp_strea), code:bash (ffplay rtsp://<pi-ip>:8554/pi-cam), code:python (cap = cv2.VideoCapture("rtsp://<pi-ip>:8554/pi-cam")) (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.39
Nodes (3): FakeResponse, run_image_upload_test(), run_video_upload_test()

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (10): code:text (Local implementation progress: 100%), code:bash (python -m py_compile init.py uploader.py tools/host_mjpeg_vi), code:bash (python3 init.py), code:bash (python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001), code:bash (python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/), code:text (http://<pi-ip>:5001/), Commands Run Locally, Commands To Run On The Raspberry Pi (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.62
Nodes (4): format_timestamp(), get_image_filename(), get_rpi_serial(), get_video_filename()

### Community 12 - "Community 12"
Cohesion: 0.71
Nodes (4): read(), test_host_and_rtsp_helpers_exist(), test_init_py_has_v1_stream_health_routes(), test_stream_metadata_state_is_tracked()

### Community 15 - "Community 15"
Cohesion: 0.76
Nodes (4): check_mjpeg(), main(), read_json(), read_url()

### Community 16 - "Community 16"
Cohesion: 0.39
Nodes (6): float, str, discover(), main(), open_stream(), str

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (24): 1. Clone/Pull from Git, 2. Run the System, Check Logs, Configuration, Controls, Core Files (REQUIRED), Data Sent to Server, Device ID (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (23): dependencies, livekit-client, @livekit/components-react, @livekit/components-styles, livekit-server-sdk, next, react, react-dom (+15 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (25): apiFetch(), apiUrl(), AudioReceiverStatus, DeviceHealth, formatDuration(), GpsState, HelmetDashboard(), InfoRow() (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (17): int, countdown(), draw_overlay(), get_current_ssid(), has_ipv4(), init_camera_like_main(), launch_main_py(), LedController (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (10): Codex Handoff: Smart Helmet Dashboard + Vercel Deployment, Device API Proxy, Device/Pi Endpoints Used By The Dashboard, LiveKit Connection, Recommended Next Steps, Repository, Suggested Workflow For Another Codex, Validation Already Done (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (10): API Endpoints Useful For Interface Work, Current Repository Shape, Current Runtime Flow, Guardrails, How To Use Graphify With Codex, Interface Work Instructions For Codex, Practical Local Testing, Project Goal (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.43
Nodes (7): DELETE(), GET(), POST(), proxyDeviceRequest(), PUT(), RouteContext, targetBase()

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (7): Expected Performance, Notes, Phase 1: Validate Existing MJPEG Stream, Phase 2: Add RTSP/H.264 For Low Latency, Ports, Prototype V1 Streaming Plan, Responsibility Split

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (4): Commands Run Locally, Commands To Run On The Raspberry Pi, Prototype V1 Progress, What Is Complete Locally

### Community 28 - "Community 28"
Cohesion: 0.60
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 36 - "Community 36"
Cohesion: 0.39
Nodes (7): _extract_times_from_filename(), str, Cloud Upload Module for Smart Helmet Uploads: video file + start_location + sto, Extract start/end time from names like:       video_20251225_211046_chunk000.mp, Upload video and location payload to cloud.      Args:       video_path: abso, upload_image_to_cloud(), upload_to_cloud()

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (23): dependencies, livekit-client, @livekit/components-react, @livekit/components-styles, livekit-server-sdk, next, react, react-dom (+15 more)

### Community 38 - "Community 38"
Cohesion: 0.23
Nodes (16): countdown(), draw_overlay(), get_current_ssid(), has_ipv4(), init_camera_like_main(), launch_main_py(), LedController, main() (+8 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (10): Codex Handoff: Smart Helmet Dashboard + Vercel Deployment, Device API Proxy, Device/Pi Endpoints Used By The Dashboard, LiveKit Connection, Recommended Next Steps, Repository, Suggested Workflow For Another Codex, Validation Already Done (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (10): API Endpoints Useful For Interface Work, Current Repository Shape, Current Runtime Flow, Guardrails, How To Use Graphify With Codex, Interface Work Instructions For Codex, Practical Local Testing, Project Goal (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (9): Namespace, RawOutputStream, RemoteParticipant, make_token(), parse_args(), play_track(), str, run() (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.39
Nodes (7): _extract_times_from_filename(), str, Cloud Upload Module for Smart Helmet Uploads: video file + start_location + sto, Extract start/end time from names like:       video_20251225_211046_chunk000.mp, Upload video and location payload to cloud.      Args:       video_path: abso, upload_image_to_cloud(), upload_to_cloud()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (7): Expected Performance, Notes, Phase 1: Validate Existing MJPEG Stream, Phase 2: Add RTSP/H.264 For Low Latency, Ports, Prototype V1 Streaming Plan, Responsibility Split

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (6): enable_transcoding, input_type, name, participant_identity, participant_name, room_name

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (4): Commands Run Locally, Commands To Run On The Raspberry Pi, Prototype V1 Progress, What Is Complete Locally

### Community 49 - "Community 49"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (3): orgId, projectId, projectName

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (6): api_upload_cloud(), _find_existing_gps_json_for_video(), get_gps_data(), _gps_json_variations_for_video(), _gps_payload_from_video(), _load_gps_json_points()

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (5): batch_upload(), delete_batch(), extract_timestamp(), list_media(), rename_batch()

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (4): camera_worker(), start_audio_recording(), stop_audio_recording(), _write_gps_json_file()

## Knowledge Gaps
- **226 isolated node(s):** `RouteContext`, `metadata`, `TokenResponse`, `GpsState`, `AudioReceiverStatus` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `int` connect `Community 21` to `Community 38`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `Starts the preview with a 180-degree rotated image.`, `Capture still image with rotation and restore preview afterwards.`, `Ensure the pipeline is in video mode with rotation and running.` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.055272108843537414 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.14736842105263157 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.08307692307692308 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._