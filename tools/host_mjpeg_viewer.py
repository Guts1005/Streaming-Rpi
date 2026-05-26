#!/usr/bin/env python3
"""
PC/host MJPEG viewer for Prototype V1.

Usage:
  python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/video_feed
  python tools/host_mjpeg_viewer.py --discover
"""

import argparse
import socket
import sys
import time

import cv2

DISCOVERY_PORT = 5002
MAGIC_WORD = b"WHO_IS_RPI_CAM?"


def discover(timeout_seconds: float = 3.0):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout_seconds)

    try:
        sock.sendto(MAGIC_WORD, ("255.255.255.255", DISCOVERY_PORT))
        data, addr = sock.recvfrom(1024)
    finally:
        sock.close()

    text = data.decode("utf-8", errors="replace").strip()
    if not text.startswith("I_AM_RPI_CAM"):
        raise RuntimeError(f"Unexpected discovery response from {addr[0]}: {text}")

    return addr[0]


def open_stream(url: str):
    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open stream: {url}")

    frame_count = 0
    last_report = time.time()
    window_name = "Smart Helmet MJPEG"

    while True:
        ok, frame = cap.read()
        if not ok:
            print("No frame received; retrying...")
            time.sleep(0.25)
            continue

        frame_count += 1
        now = time.time()
        if now - last_report >= 5.0:
            print(f"Frames received: {frame_count}")
            last_report = now

        cv2.imshow(window_name, frame)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            break

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="View the Raspberry Pi MJPEG stream from a PC/host.")
    parser.add_argument("--url", help="MJPEG URL, for example http://192.168.1.20:5001/video_feed")
    parser.add_argument("--discover", action="store_true", help="Discover the Pi using UDP broadcast on port 5002")
    args = parser.parse_args()

    url = args.url
    if args.discover:
        ip = discover()
        url = f"http://{ip}:5001/video_feed"
        print(f"Discovered Pi at {ip}; opening {url}")

    if not url:
        parser.error("Provide --url or --discover")

    try:
        open_stream(url)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
