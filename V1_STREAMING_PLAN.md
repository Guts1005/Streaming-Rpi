# Prototype V1 Streaming Plan

This prototype keeps the Raspberry Pi lightweight: camera acquisition, GPIO/status control, and local-network streaming. AI inference should run on the PC/host later.

## Phase 1: Validate Existing MJPEG Stream

Raspberry Pi:

```bash
python3 main.py
```

After QR/WiFi provisioning, `init.py` starts the camera UI on port `5001`.

Useful URLs:

- `http://<pi-ip>:5001/`
- `http://<pi-ip>:5001/video_feed`
- `http://<pi-ip>:5001/api/health`
- `http://<pi-ip>:5001/api/stream_info`

PC/host viewer:

```bash
pip install -r requirements-host.txt
python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/video_feed
```

If UDP broadcast works on the local network:

```bash
python tools/host_mjpeg_viewer.py --discover
```

Pi runtime smoke check:

```bash
python3 tools/pi_smoke_check.py --base http://127.0.0.1:5001
```

## Phase 2: Add RTSP/H.264 For Low Latency

MJPEG is simple and debuggable, but it burns Pi CPU on JPEG encoding and uses more bandwidth. The preferred V1 streaming target is RTSP with hardware H.264 encoding.

Recommended Pi packages:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

Install and run MediaMTX on the Pi, then start:

```bash
RTSP_URL=rtsp://127.0.0.1:8554/pi-cam tools/start_rtsp_stream.sh
```

From the PC:

```bash
ffplay rtsp://<pi-ip>:8554/pi-cam
```

or in future Python AI code:

```python
cap = cv2.VideoCapture("rtsp://<pi-ip>:8554/pi-cam")
```

## Responsibility Split

Raspberry Pi:

- Capture frames with Picamera2/libcamera.
- Serve MJPEG for early validation.
- Serve RTSP/H.264 for the low-latency V1 stream.
- Keep GPIO and LED status local.
- Expose simple health/control APIs.

PC/host:

- View the stream.
- Run future OpenCV/AI/object detection.
- Render overlays and operator UI.
- Send events or commands back to the Pi API.

Future AI pipeline:

- Consume RTSP frames.
- Run detection/tracking on host CPU/GPU.
- Publish events to a host UI.
- Optionally call Pi endpoints for LED/GPIO actions or recording triggers.

## Ports

- `5001/tcp`: Flask UI, control API, MJPEG stream.
- `5002/udp`: Pi discovery broadcast response.
- `8554/tcp`: recommended RTSP endpoint when MediaMTX is enabled.

## Expected Performance

- MJPEG: easiest debug path, usually acceptable for a first local-network smoke test.
- RTSP/H.264: better bandwidth and CPU profile, preferred for AI ingestion.
- Keep AI inference off the Pi 4B for this project.

## Notes

- Avoid Docker on the Pi camera path for V1. Camera/GPIO device access is easier directly on Raspberry Pi OS.
- Docker can be useful later on the PC/host AI stack.
- Keep OpenCV on the Pi only for light frame encoding and utility work. Put heavy OpenCV/AI on the host.
