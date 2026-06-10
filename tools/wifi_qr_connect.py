#!/usr/bin/env python3
import os
import re
import socket
import subprocess
import time
from urllib.parse import unquote

import cv2

try:
    from gpiozero import LED
except Exception:
    LED = None


STREAM_LED_PIN = int(os.getenv("GPIO_STREAM_LED", "22"))
RECORD_LED_PIN = int(os.getenv("GPIO_RECORD_LED", "23"))
SCAN_SECONDS = int(os.getenv("WIFI_QR_SCAN_SECONDS", "180"))
SNAPSHOT = "/tmp/smart_helmet_wifi_qr.jpg"


def internet_available():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3).close()
        return True
    except Exception:
        return False


def parse_wifi_qr(payload):
    # Standard QR format: WIFI:T:WPA;S:ssid;P:password;;
    if not payload.startswith("WIFI:"):
        return None
    data = {}
    for key in ("S", "P", "T"):
        match = re.search(rf"(?<!\\){key}:((?:\\.|[^;])*)", payload)
        if match:
            data[key] = unquote(match.group(1).replace(r"\;", ";").replace(r"\\", "\\"))
    ssid = data.get("S")
    if not ssid:
        return None
    return {"ssid": ssid, "password": data.get("P", ""), "auth": data.get("T", "WPA")}


def scan_qr_once():
    subprocess.run(
        ["rpicam-still", "--timeout", "900", "--nopreview", "-o", SNAPSHOT],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    image = cv2.imread(SNAPSHOT)
    if image is None:
        return None
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(image)
    return parse_wifi_qr(text.strip()) if text else None


def connect_wifi(config):
    cmd = ["nmcli", "dev", "wifi", "connect", config["ssid"]]
    if config.get("password"):
        cmd += ["password", config["password"]]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def main():
    if internet_available():
        return

    stream_led = LED(STREAM_LED_PIN) if LED else None
    record_led = LED(RECORD_LED_PIN) if LED else None
    if stream_led:
        stream_led.blink(on_time=0.25, off_time=0.25, background=True)
    if record_led:
        record_led.off()

    deadline = time.time() + SCAN_SECONDS
    while time.time() < deadline:
        config = scan_qr_once()
        if config and connect_wifi(config):
            for _ in range(20):
                if internet_available():
                    if stream_led:
                        stream_led.on()
                    if record_led:
                        record_led.blink(on_time=0.12, off_time=0.12, n=3, background=False)
                        record_led.off()
                    return
                time.sleep(1)
        time.sleep(1)

    if stream_led:
        stream_led.off()
    if record_led:
        record_led.off()


if __name__ == "__main__":
    main()
