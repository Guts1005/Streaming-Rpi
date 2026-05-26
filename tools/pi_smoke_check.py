#!/usr/bin/env python3
"""
Raspberry Pi runtime smoke check for Prototype V1.

Run this after `python3 init.py` is active on the Pi:
  python3 tools/pi_smoke_check.py
  python3 tools/pi_smoke_check.py --base http://<pi-ip>:5001
"""

import argparse
import json
import sys
import urllib.request


def read_url(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read(4096), response.getcode(), dict(response.headers)


def read_json(base, path):
    body, status, _headers = read_url(base.rstrip("/") + path)
    if status != 200:
        raise RuntimeError(f"{path} returned HTTP {status}")
    return json.loads(body.decode("utf-8"))


def check_mjpeg(base):
    body, status, headers = read_url(base.rstrip("/") + "/video_feed", timeout=10)
    content_type = headers.get("Content-Type", "")
    if status != 200:
        raise RuntimeError(f"/video_feed returned HTTP {status}")
    if "multipart/x-mixed-replace" not in content_type:
        raise RuntimeError(f"/video_feed has unexpected Content-Type: {content_type}")
    if b"--frame" not in body and b"Content-Type: image/jpeg" not in body:
        raise RuntimeError("/video_feed did not return an MJPEG frame boundary in the first bytes")


def main():
    parser = argparse.ArgumentParser(description="Smoke-check the V1 Pi camera server.")
    parser.add_argument("--base", default="http://127.0.0.1:5001", help="Base URL for the Pi camera server")
    args = parser.parse_args()

    health = read_json(args.base, "/api/health")
    stream = read_json(args.base, "/api/stream_info")
    check_mjpeg(args.base)

    print("Health:")
    print(json.dumps(health, indent=2))
    print("Stream:")
    print(json.dumps(stream, indent=2))

    if not health.get("ok"):
        raise RuntimeError(f"Health endpoint reported not ok: {health.get('camera_error')}")
    if not stream.get("has_frame"):
        raise RuntimeError("Stream endpoint is reachable, but no frame has been produced yet")

    print("Pi smoke check passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
