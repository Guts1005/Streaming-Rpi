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

record_proc = None
record_path = None


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


def start_recording():
    global record_proc, record_path, record_h264_path
    if record_proc:
        return
    stop_publisher()
    time.sleep(1.5)
    os.makedirs(RECORD_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    abs_record_dir = os.path.abspath(RECORD_DIR)
    record_h264_path = os.path.join(abs_record_dir, f"video_{ts}_raw.h264")
    record_path = os.path.join(abs_record_dir, f"video_{ts}_chunk000.mp4")
    cmd = f"rpicam-vid --width 1280 --height 720 --framerate 24 --codec h264 --inline --timeout 0 --nopreview -o '{record_h264_path}' > '{os.path.join(abs_record_dir, 'gpio_camera.log')}' 2>&1"
    record_proc = subprocess.Popen(cmd, shell=True, preexec_fn=os.setsid)
    logging.info("[GPIO] Local recording started: %s", record_path)


def stop_recording():
    global record_proc, record_path, record_h264_path
    if not record_proc:
        return
    os.killpg(os.getpgid(record_proc.pid), signal.SIGTERM)
    try:
        record_proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(record_proc.pid), signal.SIGKILL)
        
    if 'record_h264_path' in globals() and record_h264_path and os.path.exists(record_h264_path):
        mux_cmd = f"ffmpeg -y -framerate 24 -i '{record_h264_path}' -c:v copy '{record_path}' -vf fps=1 -update 1 '{LATEST_SNAPSHOT}'"
        subprocess.run(mux_cmd, shell=True)
        if os.path.exists(record_path) and os.path.getsize(record_path) > 1000:
            os.remove(record_h264_path)
            subprocess.run(["chmod", "777", record_path], check=False)
            
    logging.info("[GPIO] Local recording stopped: %s", record_path)
    record_proc = None
    record_path = None
    record_h264_path = None
    start_publisher_if_online()


def capture_photo():
    os.makedirs(RECORD_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(RECORD_DIR, f"img_{ts}.jpg")
    if record_proc and os.path.exists(LATEST_SNAPSHOT):
        shutil.copy2(LATEST_SNAPSHOT, path)
    else:
        was_streaming = publisher_active()
        if was_streaming:
            stop_publisher()
            time.sleep(1)
        subprocess.run(["rpicam-still", "--timeout", "1000", "--nopreview", "-o", path], check=False)
        if was_streaming:
            start_publisher_if_online()
    logging.info("[GPIO] Photo captured: %s", path)


def sync_pending():
    if not internet_available() or record_proc:
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

    record_btn.when_pressed = lambda: stop_recording() if record_proc else start_recording()

    def photo_press():
        capture_photo()
        record_led.blink(on_time=0.12, off_time=0.12, n=1, background=True)

    photo_btn.when_pressed = photo_press
    last_sync = 0
    while True:
        stream_led.value = publisher_active()
        record_led.value = bool(record_proc)
        if time.time() - last_sync > SYNC_INTERVAL:
            sync_pending()
            last_sync = time.time()
        time.sleep(0.3)


if __name__ == "__main__":
    main()
