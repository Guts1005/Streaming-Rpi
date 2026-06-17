#!/usr/bin/env python3
import datetime
import glob
import logging
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from gpiozero import Button, LED
from uploader import upload_image_to_cloud, upload_to_cloud

RECORD_DIR = os.getenv("RECORD_DIR", "recordings")
DEVICE_ID = os.getenv("DEVICE_ID", "smart_hm_02")
USB_MIC_DEVICE = os.getenv("USB_MIC_DEVICE", "hw:3,0")

GPIO_RECORD_BUTTON = int(os.getenv("GPIO_RECORD_BUTTON", "6"))
GPIO_PHOTO_BUTTON = int(os.getenv("GPIO_PHOTO_BUTTON", "13"))
GPIO_STREAM_LED = int(os.getenv("GPIO_STREAM_LED", "19"))
GPIO_RECORD_LED = int(os.getenv("GPIO_RECORD_LED", "26"))

SYNC_INTERVAL = int(os.getenv("OFFLINE_SYNC_INTERVAL", "60"))
LATEST_SNAPSHOT = os.path.join(RECORD_DIR, ".latest_gpio_snapshot.jpg")


def internet_available():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3).close()
        return True
    except Exception:
        return False


def publisher_active():
    return subprocess.run(["systemctl", "is-active", "--quiet", "livekit-publisher"]).returncode == 0


def stop_publisher():
    subprocess.run(["systemctl", "stop", "livekit-publisher"], check=False)


def start_publisher_if_online():
    if internet_available():
        subprocess.run(["systemctl", "start", "livekit-publisher"], check=False)


def get_is_recording():
    return os.path.exists(os.path.join(RECORD_DIR, ".ui_recording"))

def toggle_recording():
    if get_is_recording():
        logging.info("[GPIO] Sending stop record to API")
        try:
            requests.post("http://127.0.0.1:5001/api/stop_record", timeout=10)
        except Exception as e:
            logging.error("Failed to stop via API: %s", e)
    else:
        logging.info("[GPIO] Sending start record to API")
        try:
            requests.post("http://127.0.0.1:5001/api/start_record", timeout=10)
        except Exception as e:
            logging.error("Failed to start via API: %s", e)

def capture_photo_api():
    logging.info("[GPIO] Sending capture photo to API")
    try:
        requests.post("http://127.0.0.1:5001/api/capture_photo", timeout=15)
    except Exception as e:
        logging.error("Failed to capture photo via API: %s", e)


def sync_pending():
    if not internet_available() or get_is_recording():
        return
    for path in sorted(glob.glob(os.path.join(RECORD_DIR, "video_*.mp4")) + glob.glob(os.path.join(RECORD_DIR, "img_*.jpg"))):
        name = os.path.basename(path)
        if name.startswith("img_"):
            ok, msg = upload_image_to_cloud(image_path=path, device_id=DEVICE_ID)
            prefix = "uploaded_img_" if ok else "failed_upload_img_"
        else:
            ok, msg = upload_to_cloud(video_path=path, device_id=DEVICE_ID)
            prefix = "uploaded_" if ok else "failed_upload_"
        logging.info("[SYNC] %s: %s", name, msg)
        os.rename(path, os.path.join(RECORD_DIR, prefix + name.split("_", 1)[1]))


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    os.makedirs(RECORD_DIR, exist_ok=True)
    record_btn = Button(GPIO_RECORD_BUTTON, pull_up=True, bounce_time=0.25)
    photo_btn = Button(GPIO_PHOTO_BUTTON, pull_up=True, bounce_time=0.25)
    stream_led = LED(GPIO_STREAM_LED)
    record_led = LED(GPIO_RECORD_LED)

    record_btn.when_pressed = toggle_recording

    def photo_press():
        capture_photo_api()
        record_led.blink(on_time=0.12, off_time=0.12, n=1, background=True)

    photo_btn.when_pressed = photo_press
    last_sync = 0
    while True:
        stream_led.value = publisher_active()
        ui_recording = get_is_recording()
        record_led.value = ui_recording
        if time.time() - last_sync > SYNC_INTERVAL:
            sync_pending()
            last_sync = time.time()
        time.sleep(0.3)


if __name__ == "__main__":
    main()
