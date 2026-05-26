# Prototype V1 Progress

Updated: 2026-05-26

```text
Local implementation progress: 100%
Pi hardware verification: pending on Raspberry Pi

[done] Project/architecture analysis
[done] Graphify knowledge graph generation
[done] MJPEG-first implementation path
[done] Stream health/status API
[done] PC MJPEG viewer helper
[done] Pi runtime smoke-check helper
[done] RTSP/H.264 migration helper
[done] V1 streaming documentation
[done] Team interface handoff
[done] Hardware-free syntax/static validation
[done] Uploader payload validation without network
[pending on Pi] Camera runtime validation
[pending on Pi] PC-to-Pi livestream validation
```

## What Is Complete Locally

- `init.py` exposes `/api/health` and `/api/stream_info`.
- `/video_feed` now returns no-cache MJPEG headers.
- Stream metadata tracks frame age, frame count, frame size, and camera startup errors.
- `tools/host_mjpeg_viewer.py` can open the MJPEG stream from a PC/host.
- `tools/pi_smoke_check.py` can verify health, stream metadata, and the MJPEG endpoint on the Pi.
- `tools/start_rtsp_stream.sh` prepares the RTSP/H.264 migration path.
- `tests/test_uploader.py` validates upload payloads without real network calls.
- `tests/test_v1_static.py` validates the V1 routes and helper scripts without Pi hardware.

## Commands Run Locally

```bash
python -m py_compile init.py uploader.py tools/host_mjpeg_viewer.py tools/pi_smoke_check.py tests/test_uploader.py tests/test_v1_static.py
python tests/test_uploader.py
python tests/test_v1_static.py
```

## Commands To Run On The Raspberry Pi

Start the runtime:

```bash
python3 init.py
```

Smoke-check locally on the Pi:

```bash
python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001
```

View from PC:

```bash
python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/video_feed
```

Check browser URLs:

```text
http://<pi-ip>:5001/
http://<pi-ip>:5001/api/health
http://<pi-ip>:5001/api/stream_info
```

