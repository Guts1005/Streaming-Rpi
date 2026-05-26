#!/usr/bin/env python3
import os
import datetime

# Ensure required directories exist.
IMAGES_DIR = "Images"
os.makedirs(IMAGES_DIR, exist_ok=True)

VIDEOS_DIR = "Videos"
os.makedirs(VIDEOS_DIR, exist_ok=True)

AUDIOS_DIR = "Audios"
os.makedirs(AUDIOS_DIR, exist_ok=True)

FAILED_DIR = "failed_to_upload"
FAILED_IMAGES_DIR = os.path.join(FAILED_DIR, "Images")
FAILED_VIDEOS_DIR = os.path.join(FAILED_DIR, "Videos")
FAILED_AUDIOS_DIR = os.path.join(FAILED_DIR, "Audios")

os.makedirs(FAILED_IMAGES_DIR, exist_ok=True)
os.makedirs(FAILED_VIDEOS_DIR, exist_ok=True)
os.makedirs(FAILED_AUDIOS_DIR, exist_ok=True)

def format_timestamp():
    return datetime.datetime.now().strftime("%d%b%y_%H%M%S").lower()

def get_image_filename(device_id="helmet", prefix="img"):
    ts = format_timestamp()
    filename = os.path.join(IMAGES_DIR, f"{prefix}_{device_id}_{ts}.jpg")
    return filename

def get_video_filename(device_id="helmet", session_no=1, seg_num=1, prefix="vdo"):
    ts = datetime.datetime.now().strftime("%d%b%y_%H%M%S").lower()
    filename = os.path.join(VIDEOS_DIR, f"{prefix}_{device_id}_{session_no}_{seg_num}_{ts}.mp4")
    return filename

def get_rpi_serial():
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.strip().split(":")[1].strip()
    except Exception as e:
        print("Could not read RPi serial number:", e)
    return "unknown_pi"

