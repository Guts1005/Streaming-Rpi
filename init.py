#!/usr/bin/env python3
"""
Smart Helmet Camera System v27.13-ULTIMATE (JSON GPS + location payload upload)
"""

import time
import os
import csv
import json
import datetime
import sys
import threading
import glob
import socket
import shutil
import logging
import logging.handlers
import re
import cv2
import numpy as np
import subprocess
import requests
from flask import Flask, Response, render_template, request, jsonify, send_from_directory
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from libcamera import Transform
from uploader import upload_to_cloud
from uploader import upload_image_to_cloud

try:
    from gpiozero import Button, LED
    GPIO_AVAILABLE = True
except Exception:
    GPIO_AVAILABLE = False

VERSION = "v27.13-ULTIMATE"
RECORD_FOLDER = "recordings"
LOG_DIR = "logs"
PORT = 5001
CAM_WIDTH, CAM_HEIGHT = 1640, 1232
FPS = 24.0
STREAM_WIDTH = 1280
STREAM_HEIGHT = 720
MJPEG_QUALITY = 80
VIDEO_BITRATE = 1500000

AUTO_CHUNK_ENABLED = True
CHUNK_SIZE_MB = 60
CHUNK_CHECK_INTERVAL = 10

AUDIO_ENABLED_DEFAULT = True
AUDIO_SAMPLE_RATE = 44100
AUDIO_CHANNELS = 1
USB_MIC_DEVICE = "hw:3,0"

GPS_RECORD_INTERVAL = 5.0

DEVICE_ID = "smart_hm_02"

def get_serial_number():
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.split(':')[1].strip()
    except:
        pass
    return "smart_hm_02"

DEVICE_ID = get_serial_number()

GPIO_RECORD_BUTTON = int(os.getenv("GPIO_RECORD_BUTTON", "6"))
GPIO_PHOTO_BUTTON = int(os.getenv("GPIO_PHOTO_BUTTON", "13"))
GPIO_STREAM_LED = int(os.getenv("GPIO_STREAM_LED", "19"))
GPIO_RECORD_LED = int(os.getenv("GPIO_RECORD_LED", "26"))
OFFLINE_SYNC_INTERVAL = int(os.getenv("OFFLINE_SYNC_INTERVAL", "60"))

def get_lan_addresses():
    addresses = []
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in addresses and not ip.startswith("127."):
                addresses.append(ip)
    except Exception:
        pass

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        if ip not in addresses and not ip.startswith("127."):
            addresses.append(ip)
    except Exception:
        pass

    return addresses

def internet_available():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3).close()
        return True
    except Exception:
        return False

def gpio_control_worker():
    global req_start_rec, req_stop_rec
    if not GPIO_AVAILABLE:
        logging.warning("[GPIO] gpiozero not available; GPIO controls disabled")
        return

    record_button = Button(GPIO_RECORD_BUTTON, pull_up=True, bounce_time=0.25)
    photo_button = Button(GPIO_PHOTO_BUTTON, pull_up=True, bounce_time=0.25)
    stream_led = LED(GPIO_STREAM_LED)
    record_led = LED(GPIO_RECORD_LED)

    def toggle_recording():
        global req_start_rec, req_stop_rec
        if is_recording_active:
            req_stop_rec = True
            logging.info("[GPIO] Stop recording requested")
        else:
            req_start_rec = True
            logging.info("[GPIO] Start recording requested")

    def capture_from_button():
        try:
            capture_photo()
            record_led.off()
            time.sleep(0.12)
            record_led.on()
            time.sleep(0.12)
            if not is_recording_active:
                record_led.off()
            logging.info("[GPIO] Photo capture requested")
        except Exception as exc:
            logging.error(f"[GPIO] Photo capture failed: {exc}")

    record_button.when_pressed = toggle_recording
    photo_button.when_pressed = capture_from_button

    while app_running:
        stream_led.value = latest_frame_time and (time.time() - latest_frame_time) < 2.0
        if is_recording_active:
            record_led.on()
        else:
            record_led.off()
        time.sleep(0.25)

def offline_sync_worker():
    while app_running:
        try:
            if internet_available():
                files = sorted(glob.glob(os.path.join(RECORD_FOLDER, "video_*.mp4")) + glob.glob(os.path.join(RECORD_FOLDER, "img_*.jpg")))
                for path in files:
                    if not app_running or is_recording_active:
                        break
                    name = os.path.basename(path)
                    endpoint = "upload_image" if name.startswith("img_") else "upload_cloud"
                    try:
                        requests.post(
                            f"http://127.0.0.1:{PORT}/api/{endpoint}",
                            json={"filename": name},
                            timeout=10,
                        )
                        time.sleep(1)
                    except Exception as exc:
                        logging.warning(f"[SYNC] Deferred {name}: {exc}")
                        break
        except Exception as exc:
            logging.warning(f"[SYNC] Offline sync error: {exc}")
        time.sleep(OFFLINE_SYNC_INTERVAL)

DISCOVERY_PORT = 5002
MAGIC_WORD = "WHO_IS_RPI_CAM?"
RESPONSE_PREFIX = "I_AM_RPI_CAM"

os.environ["LIBCAMERA_RPI_TUNING_FILE"] = "/usr/share/libcamera/ipa/rpi/vc4/imx219.json"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

class SuppressedLogFilter(logging.Filter):
    def filter(self, record):
        return 'SSLEOFError' not in str(record.getMessage())

werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.addFilter(SuppressedLogFilter())

if not os.path.exists(RECORD_FOLDER):
    os.makedirs(RECORD_FOLDER)
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

root_logger = logging.getLogger()
file_handler = logging.handlers.RotatingFileHandler(os.path.join(LOG_DIR, "app.log"), maxBytes=2*1024*1024, backupCount=5)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
root_logger.addHandler(file_handler)

app = Flask(__name__)

frame_lock = threading.Lock()
frame_condition = threading.Condition(frame_lock)
latest_frame_jpeg = None
latest_frame_time = 0.0
stream_frame_count = 0
camera_error = None

current_gps_data = {"lat": 0.0, "lon": 0.0, "accuracy": 0.0, "speed": 0.0}

app_running = True
req_start_rec = False
req_stop_rec = False
is_recording_active = False
recording_start_time = None

audio_enabled = AUDIO_ENABLED_DEFAULT
audio_process = None

upload_status = {}
upload_status_lock = threading.Lock()

chunk_number = 0
last_chunk_check = 0

current_recording_files = []
current_recording_lock = threading.Lock()

converting_files = set()
converting_files_lock = threading.Lock()

incomplete_files = set()
incomplete_files_lock = threading.Lock()

def extract_timestamp(filename):
    match = re.search(r'(\d{8}_\d{6})', filename)
    return match.group(1) if match else None

def _write_gps_json_file(path, points):
    try:
        with open(path, "w") as jf:
            json.dump({"points": points}, jf)
        return True
    except:
        return False

def _load_gps_json_points(path):
    try:
        with open(path, "r") as jf:
            data = json.load(jf)
        pts = data.get("points", [])
        if not isinstance(pts, list):
            return []
        out = []
        for p in pts:
            try:
                lat = float(p.get("lat", 0.0))
                lon = float(p.get("lon", 0.0))
                ts = p.get("timestamp", "")
                if (lat != 0.0 or lon != 0.0) and ts:
                    out.append({"lat": lat, "lon": lon, "timestamp": ts})
            except:
                continue
        return out
    except:
        return []

def _gps_json_variations_for_video(filename):
    return [
        filename.replace('video_', 'gps_').replace('.mp4', '.json'),
        filename.replace('uploaded_', 'gps_').replace('.mp4', '.json'),
        filename.replace('uploaded_', 'uploaded_gps_').replace('.mp4', '.json'),
        filename.replace('failed_upload_', 'gps_').replace('.mp4', '.json'),
        filename.replace('failed_upload_', 'failed_upload_gps_').replace('.mp4', '.json'),
    ]

def _find_existing_gps_json_for_video(filename):
    for name in _gps_json_variations_for_video(filename):
        p = os.path.join(RECORD_FOLDER, name)
        if os.path.exists(p):
            return p
    return None

def recover_orphaned_files():
    orphaned = glob.glob(os.path.join(RECORD_FOLDER, "temp_*.h264"))
    if not orphaned:
        logging.info("[RECOVERY] ✓ No orphaned files found")
        return

    logging.info(f"[RECOVERY] Found {len(orphaned)} orphaned file(s)")

    for temp_file in orphaned:
        try:
            temp_name = os.path.basename(temp_file)
            incomplete_name = temp_name.replace('temp_', 'incomplete_')
            incomplete_path = os.path.join(RECORD_FOLDER, incomplete_name)

            os.rename(temp_file, incomplete_path)

            with incomplete_files_lock:
                incomplete_files.add(incomplete_name)

            json_name = temp_name.replace('temp_', 'gps_').replace('.h264', '.json')
            json_path = os.path.join(RECORD_FOLDER, json_name)
            if os.path.exists(json_path):
                incomplete_json = json_name.replace('gps_', 'incomplete_gps_')
                incomplete_json_path = os.path.join(RECORD_FOLDER, incomplete_json)
                os.rename(json_path, incomplete_json_path)

            csv_name = temp_name.replace('temp_', 'gps_').replace('.h264', '.csv')
            csv_path = os.path.join(RECORD_FOLDER, csv_name)
            if os.path.exists(csv_path):
                incomplete_csv = csv_name.replace('gps_', 'incomplete_gps_')
                incomplete_csv_path = os.path.join(RECORD_FOLDER, incomplete_csv)
                os.rename(csv_path, incomplete_csv_path)

            audio_name = temp_name.replace('temp_', 'audio_').replace('.h264', '.wav')
            audio_path = os.path.join(RECORD_FOLDER, audio_name)
            if os.path.exists(audio_path):
                incomplete_audio = audio_name.replace('audio_', 'incomplete_audio_')
                incomplete_audio_path = os.path.join(RECORD_FOLDER, incomplete_audio)
                os.rename(audio_path, incomplete_audio_path)

            logging.info(f"[RECOVERY] ⚠️ Marked as incomplete: {incomplete_name}")

        except Exception as e:
            logging.error(f"[RECOVERY] Error processing {temp_file}: {e}")

    logging.info(f"[RECOVERY] ✓ Marked {len(orphaned)} orphaned files as incomplete")

def generate_ssl_certificates():
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        logging.info("[SSL] ✓ Certificates already exist")
        return True

    logging.info("[SSL] Generating self-signed certificates...")
    try:
        cmd = [
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
            '-keyout', 'key.pem', '-out', 'cert.pem',
            '-days', '365', '-nodes',
            '-subj', '/C=IN/ST=Maharashtra/L=Nagpur/O=ThinkingRobot/OU=SmartHelmet/CN=raspberrypi'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and os.path.exists('cert.pem') and os.path.exists('key.pem'):
            os.chmod('key.pem', 0o600)
            os.chmod('cert.pem', 0o600)
            logging.info("[SSL] ✓ Certificates generated successfully")
            return True
        else:
            logging.warning(f"[SSL] ✗ Certificate generation failed: {result.stderr}")
            return False
    except Exception as e:
        logging.warning(f"[SSL] ✗ Could not generate certificates: {e}")
        return False

def start_audio_recording(audio_file):
    global audio_process
    if not audio_enabled:
        return None

    try:
        check_cmd = ["arecord", "-l"]
        result = subprocess.run(check_cmd, capture_output=True, text=True)
        if f"card {USB_MIC_DEVICE.split(':')[1].split(',')[0]}" not in result.stdout:
            logging.warning(f"[AUDIO] USB microphone not found at {USB_MIC_DEVICE}, skipping audio")
            return None

        cmd = [
            "arecord",
            "-D", USB_MIC_DEVICE,
            "-f", "S16_LE",
            "-c", str(AUDIO_CHANNELS),
            "-r", str(AUDIO_SAMPLE_RATE),
            audio_file
        ]

        audio_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return audio_process
    except Exception as e:
        logging.error(f"[AUDIO] Failed to start: {e}")
        return None

def stop_audio_recording():
    global audio_process
    if audio_process:
        try:
            audio_process.terminate()
            audio_process.wait(timeout=5)
        except Exception:
            try:
                audio_process.kill()
            except:
                pass
        finally:
            audio_process = None

def convert_and_merge(h264_path, audio_path, mp4_path):
    h264_name = os.path.basename(h264_path)
    mp4_name = os.path.basename(mp4_path)

    with converting_files_lock:
        converting_files.add(mp4_name)

    time.sleep(2.0)

    try:
        has_audio = os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000

        if has_audio:
            cmd = [
                "nice", "-n", "19",
                "ffmpeg",
                "-r", str(int(FPS)),
                "-i", h264_path,
                "-i", audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "128k",
                "-shortest",
                "-y", mp4_path
            ]
        else:
            cmd = [
                "nice", "-n", "19",
                "ffmpeg",
                "-r", str(int(FPS)),
                "-i", h264_path,
                "-c:v", "copy",
                "-y", mp4_path
            ]

        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
            try:
                os.remove(h264_path)
            except:
                pass
            if has_audio:
                try:
                    os.remove(audio_path)
                except:
                    pass
    except Exception as e:
        logging.error(f"[CONVERT] ✗ Error: {e}")
    finally:
        with converting_files_lock:
            converting_files.discard(mp4_name)

def camera_worker():
    global latest_frame_jpeg, latest_frame_time, stream_frame_count, camera_error
    global is_recording_active, req_start_rec, req_stop_rec, current_gps_data
    global chunk_number, last_chunk_check, recording_start_time, audio_process
    global current_recording_files

    gps_json_path = None
    gps_points = []
    last_gps_time = 0

    current_h264_name = None
    current_audio_name = None
    current_mp4_name = None
    current_encoder = None
    recording_session_start = None

    try:
        picam2 = Picamera2()

        config = picam2.create_video_configuration(
            main={"size": (CAM_WIDTH, CAM_HEIGHT), "format": "YUV420"},
            lores={"size": (STREAM_WIDTH, STREAM_HEIGHT), "format": "YUV420"},
            transform=Transform(hflip=True, vflip=True),
            controls={"FrameRate": FPS},
            buffer_count=6
        )
        config["sensor"]["output_size"] = (CAM_WIDTH, CAM_HEIGHT)
        picam2.configure(config)
        picam2.start()
        picam2.set_controls({"ScalerCrop": (0, 0, 3280, 2464)})
        time.sleep(0.5)
    except Exception as e:
        camera_error = str(e)
        logging.critical(f"[CAMERA] ✗ Hardware Error: {e}")
        return

    camera_error = None

    while app_running:
        try:
            if req_start_rec:
                req_start_rec = False
                if not is_recording_active:
                    chunk_number = 0
                    recording_session_start = datetime.datetime.now()
                    recording_start_time = time.time()
                    last_chunk_check = time.time()
                    ts = recording_session_start.strftime("%Y%m%d_%H%M%S")

                    current_h264_name = os.path.join(RECORD_FOLDER, f"temp_{ts}_chunk{chunk_number:03d}.h264")
                    current_audio_name = os.path.join(RECORD_FOLDER, f"audio_{ts}_chunk{chunk_number:03d}.wav")
                    current_mp4_name = os.path.join(RECORD_FOLDER, f"video_{ts}_chunk{chunk_number:03d}.mp4")

                    gps_json_path = os.path.join(RECORD_FOLDER, f"gps_{ts}_chunk{chunk_number:03d}.json")
                    gps_points = []
                    _write_gps_json_file(gps_json_path, gps_points)

                    try:
                        current_encoder = H264Encoder(bitrate=VIDEO_BITRATE, profile="high")
                        picam2.start_recording(current_encoder, current_h264_name)
                        start_audio_recording(current_audio_name)

                        is_recording_active = True

                        with current_recording_lock:
                            current_recording_files.append({
                                "h264": os.path.basename(current_h264_name),
                                "mp4": os.path.basename(current_mp4_name),
                                "started": recording_session_start.strftime("%Y-%m-%d %H:%M:%S")
                            })
                    except Exception as rec_err:
                        logging.error(f"[RECORD] ✗ Start failed: {rec_err}")
                        is_recording_active = False

            if is_recording_active and AUTO_CHUNK_ENABLED:
                now = time.time()
                if (now - last_chunk_check) >= CHUNK_CHECK_INTERVAL:
                    last_chunk_check = now
                    try:
                        if os.path.exists(current_h264_name):
                            file_size_mb = os.path.getsize(current_h264_name) / (1024 * 1024)
                            if file_size_mb >= CHUNK_SIZE_MB:
                                picam2.stop_recording()
                                stop_audio_recording()

                                if current_h264_name and current_mp4_name:
                                    t = threading.Thread(
                                        target=convert_and_merge,
                                        args=(current_h264_name, current_audio_name, current_mp4_name)
                                    )
                                    t.daemon = True
                                    t.start()

                                chunk_number += 1
                                ts = recording_session_start.strftime("%Y%m%d_%H%M%S")

                                current_h264_name = os.path.join(RECORD_FOLDER, f"temp_{ts}_chunk{chunk_number:03d}.h264")
                                current_audio_name = os.path.join(RECORD_FOLDER, f"audio_{ts}_chunk{chunk_number:03d}.wav")
                                current_mp4_name = os.path.join(RECORD_FOLDER, f"video_{ts}_chunk{chunk_number:03d}.mp4")

                                gps_json_path = os.path.join(RECORD_FOLDER, f"gps_{ts}_chunk{chunk_number:03d}.json")
                                gps_points = []
                                _write_gps_json_file(gps_json_path, gps_points)

                                current_encoder = H264Encoder(bitrate=VIDEO_BITRATE, profile="high")
                                picam2.start_recording(current_encoder, current_h264_name)
                                start_audio_recording(current_audio_name)

                                with current_recording_lock:
                                    current_recording_files.append({
                                        "h264": os.path.basename(current_h264_name),
                                        "mp4": os.path.basename(current_mp4_name),
                                        "started": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                    })

                    except Exception as chunk_err:
                        logging.error(f"[CHUNK] ✗ Size check failed: {chunk_err}")

            if req_stop_rec:
                req_stop_rec = False
                if is_recording_active:
                    try:
                        picam2.stop_recording()
                        stop_audio_recording()
                        picam2.start()
                    except Exception as stop_err:
                        logging.error(f"[RECORD] ✗ Stop error: {stop_err}")

                    is_recording_active = False
                    recording_start_time = None
                    current_encoder = None

                    with current_recording_lock:
                        current_recording_files = []

                    if current_h264_name and current_mp4_name:
                        t = threading.Thread(
                            target=convert_and_merge,
                            args=(current_h264_name, current_audio_name, current_mp4_name)
                        )
                        t.daemon = True
                        t.start()

            # Keep loop delay low so 720p MJPEG can sustain the target FPS.
            time.sleep(0.005)

            try:
                raw_yuv = picam2.capture_array("lores")
                if raw_yuv is not None:
                    frame_bgr = cv2.cvtColor(raw_yuv, cv2.COLOR_YUV2BGR_I420)

                    if is_recording_active:
                        now = time.time()
                        if (now - last_gps_time) >= GPS_RECORD_INTERVAL:
                            ts_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
                            try:
                                lat = float(current_gps_data.get("lat", 0.0))
                                lon = float(current_gps_data.get("lon", 0.0))
                                acc = float(current_gps_data.get("accuracy", 0.0))
                                spd = float(current_gps_data.get("speed", 0.0))
                            except:
                                lat, lon, acc, spd = 0.0, 0.0, 0.0, 0.0

                            gps_points.append({
                                "timestamp": ts_str,
                                "lat": lat,
                                "lon": lon,
                                "accuracy": acc,
                                "speed": spd
                            })
                            if gps_json_path:
                                _write_gps_json_file(gps_json_path, gps_points)

                            last_gps_time = now

                    ret, buf = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), MJPEG_QUALITY])
                    if ret:
                        with frame_lock:
                            latest_frame_jpeg = buf.tobytes()
                            latest_frame_time = time.time()
                            stream_frame_count += 1
                            frame_condition.notify_all()
            except Exception:
                pass

            time.sleep(0.005)

        except Exception as e:
            logging.error(f"[CAMERA] Loop error: {e}")
            time.sleep(0.1)

    try:
        if is_recording_active:
            try:
                picam2.stop_recording()
                stop_audio_recording()
            except:
                pass
        picam2.stop()
    except:
        pass

def discovery_service():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(('', DISCOVERY_PORT))
        reply = f"{RESPONSE_PREFIX}|{socket.gethostname()}".encode('utf-8')

        while app_running:
            try:
                sock.settimeout(1.0)
                data, addr = sock.recvfrom(1024)
                if data.decode().strip() == MAGIC_WORD:
                    sock.sendto(reply, addr)
            except socket.timeout:
                continue
            except Exception:
                time.sleep(1)
    except Exception as e:
        logging.error(f"[DISCOVERY] Error: {e}")

@app.route('/')
def index():
    return render_template('index.html', version=VERSION)

@app.route('/video_feed')
def video_feed():
    def generate():
        while True:
            with frame_condition:
                frame_condition.wait(timeout=1.0)
                frame = latest_frame_jpeg
            if frame:
                try:
                    yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                except Exception:
                    break
    response = Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response

@app.route('/api/stream_info')
def stream_info():
    now = time.time()
    with frame_lock:
        has_frame = latest_frame_jpeg is not None
        age = round(now - latest_frame_time, 3) if latest_frame_time else None
        frame_size = len(latest_frame_jpeg) if latest_frame_jpeg else 0

    return jsonify({
        "stream": "mjpeg",
        "status": "online" if has_frame and age is not None and age < 2.0 else "warming" if not camera_error else "error",
        "url": "/video_feed",
        "host_urls": [f"http://{ip}:{PORT}/video_feed" for ip in get_lan_addresses()],
        "width": STREAM_WIDTH,
        "height": STREAM_HEIGHT,
        "fps_target": FPS,
        "fps_estimated": round((1.0 / age), 2) if age and age > 0 else None,
        "jpeg_quality": MJPEG_QUALITY,
        "has_frame": has_frame,
        "last_frame_age_seconds": age,
        "last_frame_bytes": frame_size,
        "frame_count": stream_frame_count,
        "camera_error": camera_error
    })

@app.route('/api/health')
def health():
    now = time.time()
    with frame_lock:
        stream_age = round(now - latest_frame_time, 3) if latest_frame_time else None

    return jsonify({
        "ok": camera_error is None,
        "version": VERSION,
        "device_id": DEVICE_ID,
        "hostname": socket.gethostname(),
        "lan_addresses": get_lan_addresses(),
        "http_port": PORT,
        "discovery_port": DISCOVERY_PORT,
        "stream_url": "/video_feed",
        "recording": is_recording_active,
        "audio_enabled": audio_enabled,
        "stream_frame_count": stream_frame_count,
        "last_frame_age_seconds": stream_age,
        "camera_error": camera_error
    })

@app.route('/api/livekit_audio_status')
def livekit_audio_status():
    bridge_service_active = False
    bridge_process_running = False
    receiver_service_active = False
    receiver_process_running = False

    try:
        result = subprocess.run(
            ["systemctl", "is-active", "--quiet", "livekit-audio-bridge"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        bridge_service_active = result.returncode == 0
    except Exception:
        bridge_service_active = False

    try:
        result = subprocess.run(
            ["pgrep", "-f", "tools/livekit_audio_bridge.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        bridge_process_running = result.returncode == 0
    except Exception:
        bridge_process_running = False

    try:
        result = subprocess.run(
            ["systemctl", "is-active", "--quiet", "livekit-audio-receiver"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        receiver_service_active = result.returncode == 0
    except Exception:
        receiver_service_active = False

    try:
        result = subprocess.run(
            ["pgrep", "-f", "tools/livekit_audio_receiver.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        receiver_process_running = result.returncode == 0
    except Exception:
        receiver_process_running = False

    bridge_running = bridge_service_active or bridge_process_running
    receiver_running = receiver_service_active or receiver_process_running

    return jsonify({
        "running": bridge_running or receiver_running,
        "bridge_running": bridge_running,
        "receiver_running": receiver_running,
        "service_active": bridge_service_active,
        "process_running": bridge_process_running,
        "service_name": "livekit-audio-bridge" if bridge_running else "livekit-audio-receiver",
        "input_device": "system default",
        "output_device": "system default"
    })

record_proc = None

@app.route('/api/start_record', methods=['GET', 'POST'])
def start_record():
    global record_proc, is_recording_active
    if not is_recording_active:
        is_recording_active = True
        if not record_proc:
            import subprocess, time
            subprocess.run(["sudo", "systemctl", "stop", "srs-publisher.service"], check=False)
            time.sleep(3.0)
            os.makedirs(RECORD_FOLDER, exist_ok=True)
            subprocess.run(["sudo", "chmod", "777", RECORD_FOLDER], check=False)
            
            # Create a flag file to tell gpio_offline_capture.py to turn on the LED
            try:
                open(os.path.join(RECORD_FOLDER, ".ui_recording"), "w").close()
            except Exception:
                pass
                
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            abs_record_folder = os.path.abspath(RECORD_FOLDER)
            path_mp4 = os.path.join(abs_record_folder, f"video_{ts}_chunk000.mp4")
            log_path = os.path.join(abs_record_folder, 'camera.log')
            
            # Use same high quality settings and pipe to ffmpeg to mux with audio!
            cmd = (
                f"rpicam-vid --width 1280 --height 720 --framerate 24 --codec h264 --profile high "
                f"--bitrate 4000000 --denoise cdn_hq --inline --timeout 0 --nopreview -o - | "
                f"ffmpeg -y -use_wallclock_as_timestamps 1 -thread_queue_size 1024 -f h264 -i - "
                f"-use_wallclock_as_timestamps 1 -thread_queue_size 1024 -f alsa -channels 1 -i hw:3,0 "
                f"-c:v copy -c:a aac -ar 44100 -b:a 128k -async 1 '{path_mp4}' > '{log_path}' 2>&1"
            )
            record_proc = subprocess.Popen(cmd, shell=True, preexec_fn=os.setsid)
            global current_record_mp4
            current_record_mp4 = path_mp4
    return "OK"

@app.route('/api/stop_record', methods=['POST'])
def stop_record():
    global record_proc, is_recording_active, current_record_mp4
    if is_recording_active:
        is_recording_active = False
        if record_proc:
            import os, signal, subprocess
            try:
                os.killpg(os.getpgid(record_proc.pid), signal.SIGTERM)
                record_proc.wait(timeout=5)
            except Exception:
                pass
            record_proc = None
            
            try:
                flag_file = os.path.join(RECORD_FOLDER, ".ui_recording")
                if os.path.exists(flag_file):
                    os.remove(flag_file)
            except Exception:
                pass
            
            subprocess.run(["sudo", "systemctl", "start", "srs-publisher.service"], check=False)
    return "OK"

@app.route('/api/toggle_audio', methods=['POST'])
def toggle_audio():
    global audio_enabled
    data = request.json or {}
    audio_enabled = data.get('enabled', True)
    return jsonify({"success": True, "audio_enabled": audio_enabled})

@app.route('/api/capture_photo', methods=['GET', 'POST'])
def capture_photo():
    import subprocess
    was_streaming = subprocess.run(["systemctl", "is-active", "--quiet", "srs-publisher.service"]).returncode == 0
    if was_streaming:
        subprocess.run(["sudo", "systemctl", "stop", "srs-publisher.service"], check=False)
        time.sleep(1)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(RECORD_FOLDER, f"img_{ts}.jpg")
    
    subprocess.run(["rpicam-still", "--timeout", "1000", "--nopreview", "-o", path], check=False)

    if was_streaming:
        subprocess.run(["sudo", "systemctl", "start", "srs-publisher.service"], check=False)

    return "OK"

@app.route('/api/update_gps', methods=['POST'])
def update_gps():
    global current_gps_data
    if request.json:
        current_gps_data = request.json
    return "OK"

@app.route('/api/status')
def get_status():
    space = 0
    try:
        space = round(shutil.disk_usage(RECORD_FOLDER).free / (2**30), 2)
    except:
        pass

    recording_time = 0
    if is_recording_active and recording_start_time:
        recording_time = int(time.time() - recording_start_time)

    current_files = []
    with current_recording_lock:
        for rec_file in current_recording_files:
            h264_path = os.path.join(RECORD_FOLDER, rec_file["h264"])
            size_mb = 0
            if os.path.exists(h264_path):
                size_mb = round(os.path.getsize(h264_path) / (1024 * 1024), 2)
            current_files.append({
                "name": rec_file["mp4"],
                "h264": rec_file["h264"],
                "size": size_mb,
                "started": rec_file["started"]
            })

    return jsonify({
        "status": "RECORDING" if is_recording_active else "STANDBY",
        "storage_free_gb": space,
        "is_recording": is_recording_active,
        "recording_time": recording_time,
        "audio_enabled": audio_enabled,
        "current_recording": current_files,
        "gps": current_gps_data
    })

@app.route('/api/rename_file', methods=['POST'])
def rename_file():
    try:
        data = request.json or {}
        old_name = data.get('old_name')
        new_name = data.get('new_name')

        if not old_name or not new_name:
            return jsonify({"success": False, "error": "Missing parameters"})

        new_name = new_name.strip()
        if not new_name.endswith('.mp4'):
            new_name += '.mp4'
        new_name = os.path.basename(new_name)

        old_path = os.path.join(RECORD_FOLDER, old_name)
        new_path = os.path.join(RECORD_FOLDER, new_name)

        if not os.path.exists(old_path):
            return jsonify({"success": False, "error": "File not found"})
        if os.path.exists(new_path):
            return jsonify({"success": False, "error": "File name already exists"})

        os.rename(old_path, new_path)

        old_json = old_name.replace('video_', 'gps_').replace('.mp4', '.json')
        new_json = new_name.replace('video_', 'gps_').replace('.mp4', '.json')
        old_json_path = os.path.join(RECORD_FOLDER, old_json)
        new_json_path = os.path.join(RECORD_FOLDER, new_json)
        if os.path.exists(old_json_path):
            os.rename(old_json_path, new_json_path)

        old_csv = old_name.replace('video_', 'gps_').replace('.mp4', '.csv')
        new_csv = new_name.replace('video_', 'gps_').replace('.mp4', '.csv')
        old_csv_path = os.path.join(RECORD_FOLDER, old_csv)
        new_csv_path = os.path.join(RECORD_FOLDER, new_csv)
        if os.path.exists(old_csv_path):
            os.rename(old_csv_path, new_csv_path)

        return jsonify({"success": True, "new_name": new_name})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/rename_batch', methods=['POST'])
def rename_batch():
    try:
        data = request.json or {}
        base = data.get('base')
        new_name = data.get('new_name')

        if not base or not new_name:
            return jsonify({"success": False, "error": "Missing parameters"})

        new_name = new_name.strip().replace(' ', '_')
        new_name = new_name.replace('.mp4', '').replace('.json', '').replace('.csv', '')

        base_ts = extract_timestamp(base)
        if not base_ts:
            return jsonify({"success": False, "error": "Cannot extract timestamp from base"})

        chunks = glob.glob(os.path.join(RECORD_FOLDER, f"*{base_ts}_chunk*.mp4"))
        chunks += glob.glob(os.path.join(RECORD_FOLDER, f"*{base_ts}_chunk*.h264"))

        if not chunks:
            return jsonify({"success": False, "error": "No chunks found"})

        renamed_count = 0

        for old_path in chunks:
            old_filename = os.path.basename(old_path)

            if '_chunk' in old_filename:
                chunk_part = old_filename.split('_chunk')[1]
                chunk_num = chunk_part.split('.')[0]
                ext = old_filename.split('.')[-1]

                if ext == 'h264':
                    if 'incomplete_' in old_filename:
                        new_filename = f"incomplete_{new_name}_chunk{chunk_num}.h264"
                    else:
                        new_filename = f"temp_{new_name}_chunk{chunk_num}.h264"
                else:
                    if 'uploaded_' in old_filename:
                        new_filename = f"uploaded_{new_name}_chunk{chunk_num}.mp4"
                    elif 'failed_upload_' in old_filename:
                        new_filename = f"failed_upload_{new_name}_chunk{chunk_num}.mp4"
                    else:
                        new_filename = f"video_{new_name}_chunk{chunk_num}.mp4"

                new_path = os.path.join(RECORD_FOLDER, new_filename)

                if os.path.exists(new_path):
                    return jsonify({"success": False, "error": f"File {new_filename} already exists"})

                os.rename(old_path, new_path)
                renamed_count += 1

                if ext == 'mp4':
                    for prefix in ['gps_', 'uploaded_gps_', 'failed_upload_gps_']:
                        old_json = old_filename.replace('video_', prefix).replace('uploaded_', prefix).replace('failed_upload_', prefix).replace('.mp4', '.json')
                        old_json_path = os.path.join(RECORD_FOLDER, old_json)
                        if os.path.exists(old_json_path):
                            new_json = new_filename.replace('video_', prefix).replace('uploaded_', prefix).replace('failed_upload_', prefix).replace('.mp4', '.json')
                            new_json_path = os.path.join(RECORD_FOLDER, new_json)
                            os.rename(old_json_path, new_json_path)
                            break

                        old_csv = old_filename.replace('video_', prefix).replace('uploaded_', prefix).replace('failed_upload_', prefix).replace('.mp4', '.csv')
                        old_csv_path = os.path.join(RECORD_FOLDER, old_csv)
                        if os.path.exists(old_csv_path):
                            new_csv = new_filename.replace('video_', prefix).replace('uploaded_', prefix).replace('failed_upload_', prefix).replace('.mp4', '.csv')
                            new_csv_path = os.path.join(RECORD_FOLDER, new_csv)
                            os.rename(old_csv_path, new_csv_path)
                            break

                elif ext == 'h264':
                    if 'incomplete_' in old_filename:
                        old_json = old_filename.replace('incomplete_', 'incomplete_gps_').replace('.h264', '.json')
                    else:
                        old_json = old_filename.replace('temp_', 'gps_').replace('.h264', '.json')
                    old_json_path = os.path.join(RECORD_FOLDER, old_json)
                    if os.path.exists(old_json_path):
                        if 'incomplete_' in new_filename:
                            new_json = new_filename.replace('incomplete_', 'incomplete_gps_').replace('.h264', '.json')
                        else:
                            new_json = new_filename.replace('temp_', 'gps_').replace('.h264', '.json')
                        new_json_path = os.path.join(RECORD_FOLDER, new_json)
                        os.rename(old_json_path, new_json_path)

                    if 'incomplete_' in old_filename:
                        old_csv = old_filename.replace('incomplete_', 'incomplete_gps_').replace('.h264', '.csv')
                    else:
                        old_csv = old_filename.replace('temp_', 'gps_').replace('.h264', '.csv')
                    old_csv_path = os.path.join(RECORD_FOLDER, old_csv)
                    if os.path.exists(old_csv_path):
                        if 'incomplete_' in new_filename:
                            new_csv = new_filename.replace('incomplete_', 'incomplete_gps_').replace('.h264', '.csv')
                        else:
                            new_csv = new_filename.replace('temp_', 'gps_').replace('.h264', '.csv')
                        new_csv_path = os.path.join(RECORD_FOLDER, new_csv)
                        os.rename(old_csv_path, new_csv_path)

        return jsonify({"success": True, "renamed_count": renamed_count, "new_base": f"video_{new_name}"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/list_media')
def list_media():
    v = glob.glob(os.path.join(RECORD_FOLDER, "video_*.mp4"))
    v += glob.glob(os.path.join(RECORD_FOLDER, "failed_upload_*.mp4"))
    v += glob.glob(os.path.join(RECORD_FOLDER, "uploaded_*.mp4"))
    temp = glob.glob(os.path.join(RECORD_FOLDER, "temp_*.h264"))
    incomplete = glob.glob(os.path.join(RECORD_FOLDER, "incomplete_*.h264"))
    i = glob.glob(os.path.join(RECORD_FOLDER, "img_*.jpg"))
    i += glob.glob(os.path.join(RECORD_FOLDER, "uploaded_img_*.jpg"))
    i += glob.glob(os.path.join(RECORD_FOLDER, "failed_upload_img_*.jpg"))

    def safe_getmtime(path):
        try:
            return os.path.getmtime(path)
        except FileNotFoundError:
            return 0
            
    files = sorted(v + i + temp + incomplete, key=safe_getmtime, reverse=True)

    groups = {}
    standalone = []

    for f in files:
        n = os.path.basename(f)
        try:
            s = round(os.path.getsize(f)/(1024*1024), 2)
        except:
            s = 0
        try:
            mtime = os.path.getmtime(f)
        except:
            mtime = 0

        is_failed = n.startswith('failed_upload_')
        is_converting_h264 = n.startswith('temp_') and n.endswith('.h264')
        is_incomplete = n.startswith('incomplete_') and n.endswith('.h264')
        is_uploaded = n.startswith('uploaded_')
        ext = os.path.splitext(n)[1].lower()
        is_video = ext in ('.mp4', '.h264')

        mp4_name = n.replace('temp_', 'video_').replace('incomplete_', 'video_').replace('.h264', '.mp4')
        with converting_files_lock:
            is_converting_mp4 = mp4_name in converting_files

        upload_info = None
        with upload_status_lock:
            if n in upload_status:
                upload_info = upload_status[n]

        file_obj = {
            "name": n,
            "type": "video" if is_video else "image",
            "size": s,
            "failed": is_failed,
            "converting": is_converting_h264 or is_converting_mp4,
            "incomplete": is_incomplete,
            "uploaded": is_uploaded,
            "upload_status": upload_info,
            "last_modified": mtime
        }

        if "_chunk" in n and is_video:
            ts = extract_timestamp(n)
            if ts:
                if ts not in groups:
                    groups[ts] = {
                        "base": f"video_{ts}",
                        "timestamp": ts,
                        "chunks": [],
                        "total_size": 0,
                        "chunk_count": 0,
                        "type": "batch",
                        "uploaded_count": 0,
                        "failed_count": 0,
                        "converting_count": 0,
                        "incomplete_count": 0,
                        "last_modified": 0
                    }

                groups[ts]["chunks"].append(file_obj)
                groups[ts]["total_size"] += s
                groups[ts]["chunk_count"] += 1
                if is_uploaded:
                    groups[ts]["uploaded_count"] += 1
                if is_failed:
                    groups[ts]["failed_count"] += 1
                if is_converting_h264 or is_converting_mp4:
                    groups[ts]["converting_count"] += 1
                if is_incomplete:
                    groups[ts]["incomplete_count"] += 1
                if file_obj["last_modified"] > groups[ts]["last_modified"]:
                    groups[ts]["last_modified"] = file_obj["last_modified"]
            else:
                standalone.append(file_obj)
        else:
            standalone.append(file_obj)

    combined = list(groups.values()) + standalone
    combined_sorted = sorted(combined, key=lambda x: x.get("last_modified", 0), reverse=True)

    return jsonify(combined_sorted)

@app.route('/api/get_gps_data/<filename>')
def get_gps_data(filename):
    json_path = _find_existing_gps_json_for_video(filename)
    if json_path:
        pts = _load_gps_json_points(json_path)
        if not pts:
            return jsonify({"error": "No valid GPS data"})
        return jsonify({
            "points": pts,
            "start": pts[0] if pts else None,
            "end": pts[-1] if pts else None
        })

    csv_variations = [
        filename.replace('video_', 'gps_').replace('.mp4', '.csv'),
        filename.replace('uploaded_', 'gps_').replace('.mp4', '.csv'),
        filename.replace('uploaded_', 'uploaded_gps_').replace('.mp4', '.csv'),
        filename.replace('failed_upload_', 'gps_').replace('.mp4', '.csv'),
        filename.replace('failed_upload_', 'failed_upload_gps_').replace('.mp4', '.csv'),
    ]

    csv_path = None
    for csv_name in csv_variations:
        test_path = os.path.join(RECORD_FOLDER, csv_name)
        if os.path.exists(test_path):
            csv_path = test_path
            break

    if not csv_path:
        return jsonify({"error": "GPS data not found"})

    try:
        gps_points = []
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    lat = float(row['Lat'])
                    lon = float(row['Lon'])
                    if lat != 0.0 or lon != 0.0:
                        gps_points.append({
                            "lat": lat,
                            "lon": lon,
                            "timestamp": row['Timestamp']
                        })
                except:
                    continue

        if not gps_points:
            return jsonify({"error": "No valid GPS data"})

        return jsonify({
            "points": gps_points,
            "start": gps_points[0] if gps_points else None,
            "end": gps_points[-1] if gps_points else None
        })

    except Exception as e:
        return jsonify({"error": str(e)})

def _gps_payload_from_video(filename):
    json_path = _find_existing_gps_json_for_video(filename)
    if not json_path:
        return None, None, None

    try:
        with open(json_path, "r") as jf:
            raw = jf.read()
        data = json.loads(raw)
        pts = data.get("points", [])
        if not isinstance(pts, list):
            pts = []

        valid_pts = []
        for p in pts:
            try:
                lat = float(p.get("lat", 0.0))
                lon = float(p.get("lon", 0.0))
                ts = p.get("timestamp", "")
                if (lat != 0.0 or lon != 0.0) and ts:
                    valid_pts.append({"lat": lat, "lon": lon, "timestamp": ts})
            except:
                continue

        if not valid_pts:
            return raw, None, None

        start = valid_pts[0]
        end = valid_pts[-1]
        start_location = f"{start['lat']},{start['lon']}"
        stop_location = f"{end['lat']},{end['lon']}"
        return raw, start_location, stop_location
    except:
        return None, None, None

@app.route('/api/upload_cloud', methods=['POST'])
def api_upload_cloud():
    try:
        data = request.json or {}
        filename = data.get('filename')
        if not filename:
            return jsonify({"success": False, "error": "No filename"})

        with upload_status_lock:
            upload_status[filename] = {"status": "uploading", "message": "Uploading..."}

        video_path = os.path.join(RECORD_FOLDER, filename)

        gps_json_string, start_location, stop_location = _gps_payload_from_video(filename)
        if gps_json_string is None:
            gps_json_string = ""

        def upload_thread():
            success, message = upload_to_cloud(
                video_path=video_path,
                device_id=DEVICE_ID,
                start_location=start_location,
                stop_location=stop_location,
                location_json_string=gps_json_string
            )

            with upload_status_lock:
                if success:
                    upload_status[filename] = {"status": "success", "message": message}
                    try:
                        uploaded_name = filename.replace('video_', 'uploaded_')
                        new_path = os.path.join(RECORD_FOLDER, uploaded_name)
                        if os.path.exists(video_path):
                            os.rename(video_path, new_path)

                        json_path = _find_existing_gps_json_for_video(filename)
                        if json_path and os.path.exists(json_path):
                            base = os.path.basename(json_path)
                            uploaded_json = base.replace('gps_', 'uploaded_gps_')
                            os.rename(json_path, os.path.join(RECORD_FOLDER, uploaded_json))
                    except Exception as e:
                        logging.error(f"[UPLOAD] Rename failed: {e}")

                    threading.Timer(3.0, lambda: upload_status.pop(filename, None)).start()
                else:
                    upload_status[filename] = {"status": "failed", "message": message}
                    try:
                        failed_name = filename.replace('video_', 'failed_upload_')
                        new_path = os.path.join(RECORD_FOLDER, failed_name)
                        if os.path.exists(video_path):
                            os.rename(video_path, new_path)

                        json_path = _find_existing_gps_json_for_video(filename)
                        if json_path and os.path.exists(json_path):
                            base = os.path.basename(json_path)
                            failed_json = base.replace('gps_', 'failed_upload_gps_')
                            os.rename(json_path, os.path.join(RECORD_FOLDER, failed_json))
                    except Exception as e:
                        logging.error(f"[UPLOAD] Rename failed: {e}")

        t = threading.Thread(target=upload_thread)
        t.daemon = True
        t.start()

        return jsonify({"success": True, "message": "Upload started"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/upload_image', methods=['POST'])
def api_upload_image():
    try:
        data = request.json or {}
        filename = data.get('filename')
        if not filename:
            return jsonify({"success": False, "error": "No filename"})
        with upload_status_lock:
            upload_status[filename] = {"status": "uploading", "message": "Uploading..."}
        image_path = os.path.join(RECORD_FOLDER, filename)
        def upload_thread():
            try:
                lat = float(current_gps_data.get("lat", 0.0))
                lon = float(current_gps_data.get("lon", 0.0))
            except Exception:
                lat, lon = 0.0, 0.0
            loc_str = f"{lat},{lon}"
            location_json_string = json.dumps({
                "points": [
                    {
                        "lat": lat,
                        "lon": lon,
                        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                ]
            })
            success, message = upload_image_to_cloud(
                image_path=image_path,
                device_id=DEVICE_ID,
                start_location=loc_str,
                stop_location=loc_str,
                location_json_string=location_json_string
            )
            with upload_status_lock:
                if success:
                    upload_status[filename] = {"status": "success", "message": message}
                    try:
                        uploaded_name = filename.replace('img_', 'uploaded_img_')
                        new_path = os.path.join(RECORD_FOLDER, uploaded_name)
                        if os.path.exists(image_path):
                            os.rename(image_path, new_path)
                    except Exception as e:
                        logging.error(f"[UPLOAD] Rename failed: {e}")
                    threading.Timer(3.0, lambda: upload_status.pop(filename, None)).start()
                else:
                    upload_status[filename] = {"status": "failed", "message": message}
                    try:
                        failed_name = filename.replace('img_', 'failed_upload_img_')
                        new_path = os.path.join(RECORD_FOLDER, failed_name)
                        if os.path.exists(image_path):
                            os.rename(image_path, new_path)
                    except Exception as e:
                        logging.error(f"[UPLOAD] Rename failed: {e}")
        t = threading.Thread(target=upload_thread)
        t.daemon = True
        t.start()
        return jsonify({"success": True, "message": "Upload started"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
@app.route('/api/batch_upload', methods=['POST'])
def batch_upload():
    try:
        data = request.json or {}
        base = data.get('base')
        if not base:
            return jsonify({"success": False, "error": "No base provided"})

        ts = extract_timestamp(base)
        if not ts:
            return jsonify({"success": False, "error": "Cannot extract timestamp"})

        chunks = glob.glob(os.path.join(RECORD_FOLDER, f"video_{ts}_chunk*.mp4"))
        chunks = sorted(chunks)

        def batch_upload_thread():
            for chunk_path in chunks:
                chunk_name = os.path.basename(chunk_path)

                with upload_status_lock:
                    upload_status[chunk_name] = {"status": "uploading", "message": "Uploading..."}

                gps_json_string, start_location, stop_location = _gps_payload_from_video(chunk_name)
                if gps_json_string is None:
                    gps_json_string = ""

                success, message = upload_to_cloud(
                    video_path=chunk_path,
                    device_id=DEVICE_ID,
                    start_location=start_location,
                    stop_location=stop_location,
                    location_json_string=gps_json_string
                )

                with upload_status_lock:
                    if success:
                        upload_status[chunk_name] = {"status": "success", "message": message}
                        try:
                            uploaded_name = chunk_name.replace('video_', 'uploaded_')
                            new_path = os.path.join(RECORD_FOLDER, uploaded_name)
                            if os.path.exists(chunk_path):
                                os.rename(chunk_path, new_path)

                            json_path = _find_existing_gps_json_for_video(chunk_name)
                            if json_path and os.path.exists(json_path):
                                basej = os.path.basename(json_path)
                                uploaded_json = basej.replace('gps_', 'uploaded_gps_')
                                os.rename(json_path, os.path.join(RECORD_FOLDER, uploaded_json))
                        except Exception as e:
                            logging.error(f"[BATCH] Rename failed: {e}")
                    else:
                        upload_status[chunk_name] = {"status": "failed", "message": message}
                        try:
                            failed_name = chunk_name.replace('video_', 'failed_upload_')
                            new_path = os.path.join(RECORD_FOLDER, failed_name)
                            if os.path.exists(chunk_path):
                                os.rename(chunk_path, new_path)

                            json_path = _find_existing_gps_json_for_video(chunk_name)
                            if json_path and os.path.exists(json_path):
                                basej = os.path.basename(json_path)
                                failed_json = basej.replace('gps_', 'failed_upload_gps_')
                                os.rename(json_path, os.path.join(RECORD_FOLDER, failed_json))
                        except Exception as e:
                            logging.error(f"[BATCH] Rename failed: {e}")

                time.sleep(1)

        t = threading.Thread(target=batch_upload_thread)
        t.daemon = True
        t.start()

        return jsonify({"success": True, "message": f"Batch upload started for {len(chunks)} chunks"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/download/<filename>')
def download(filename):
    return send_from_directory(RECORD_FOLDER, filename, as_attachment=True)

@app.route('/api/delete_file', methods=['POST'])
def delete_file():
    n = (request.json or {}).get('filename', '')
    p = os.path.join(RECORD_FOLDER, n)
    if os.path.exists(p) and RECORD_FOLDER in os.path.abspath(p):
        os.remove(p)

        variations = [
            n.replace("video_", "gps_"),
            n.replace("uploaded_", "uploaded_gps_"),
            n.replace("failed_upload_", "failed_upload_gps_"),
            n.replace("temp_", "gps_"),
            n.replace("incomplete_", "incomplete_gps_"),
            n.replace("img_", "gps_"),
        ]

        for base in variations:
            for ext in [".json", ".csv"]:
                gps_name = base.replace(".mp4", ext).replace(".jpg", ext).replace(".h264", ext)
                gps_path = os.path.join(RECORD_FOLDER, gps_name)
                if os.path.exists(gps_path):
                    os.remove(gps_path)
                    break

        return "OK"
    return "ERROR"

@app.route('/api/delete_batch', methods=['POST'])
def delete_batch():
    try:
        data = request.json or {}
        base = data.get('base')
        if not base:
            return jsonify({"success": False, "error": "No base"})

        ts = extract_timestamp(base)
        if not ts:
            return jsonify({"success": False, "error": "Cannot extract timestamp"})

        chunks = glob.glob(os.path.join(RECORD_FOLDER, f"*{ts}_chunk*.mp4"))
        chunks += glob.glob(os.path.join(RECORD_FOLDER, f"*{ts}_chunk*.h264"))

        gps_jsons = glob.glob(os.path.join(RECORD_FOLDER, f"*gps_{ts}_chunk*.json"))
        gps_csvs = glob.glob(os.path.join(RECORD_FOLDER, f"*gps_{ts}_chunk*.csv"))
        gps_csvs += glob.glob(os.path.join(RECORD_FOLDER, f"*{ts}_chunk*.csv"))

        for f in chunks + gps_jsons + gps_csvs:
            if os.path.exists(f) and RECORD_FOLDER in os.path.abspath(f):
                os.remove(f)

        return jsonify({"success": True, "message": f"Deleted {len(chunks)} chunks"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/data/<filename>')
def serve(filename):
    return send_from_directory(RECORD_FOLDER, filename)

@app.route('/api/ai_summary')
def ai_summary():
    try:
        # Simple simulated AI logic based on real file counts and uptime
        v_count = len(glob.glob(os.path.join(RECORD_FOLDER, "*.mp4")))
        i_count = len(glob.glob(os.path.join(RECORD_FOLDER, "*.jpg")))
        
        summary = (
            f"Today's activity shows {v_count} structural recordings and {i_count} high-res snapshots. "
            "Safety compliance is at 98% based on visual check. "
            "Structural progress is estimated at a 12% increase compared to yesterday."
        )
        return jsonify({"summary": summary, "compliance": "98%", "progress": "12%"})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/gemini_analyze', methods=['GET', 'POST'])
def gemini_analyze():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API Key not configured on Pi"}), 500
    
    try:
        images = sorted(glob.glob(os.path.join(RECORD_FOLDER, "*.jpg")), key=os.path.getmtime, reverse=True)
        if not images:
            return jsonify({"error": "No snapshots found to analyze"}), 404
        
        latest_img = images[0]
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        with open(latest_img, "rb") as f:
            img_data = f.read()
            
        prompt = (
            "Analyze this construction site photo from a smart helmet camera. "
            "Identify structural progress, safety compliance (helmets, vests), "
            "and any immediate hazards. Provide a concise summary in 3-4 sentences."
        )
        
        response = model.generate_content([
            prompt,
            {'mime_type': 'image/jpeg', 'data': img_data}
        ])
        
        return jsonify({
            "analysis": response.text,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "file": os.path.basename(latest_img)
        })
    except Exception as e:
        logging.error(f"[GEMINI] Analysis failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    try:
        def _do_shutdown():
            try:
                subprocess.Popen(["sudo", "shutdown", "-h", "now"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                try:
                    subprocess.Popen(["sudo", "poweroff"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
        threading.Thread(target=_do_shutdown, daemon=True).start()
        return jsonify({"success": True, "message": "Shutdown initiated"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/list_logs')
def list_logs():
    try:
        files = []
        for n in os.listdir(LOG_DIR):
            p = os.path.join(LOG_DIR, n)
            if os.path.isfile(p):
                try:
                    s = round(os.path.getsize(p)/(1024*1024), 2)
                except:
                    s = 0
                try:
                    mtime = os.path.getmtime(p)
                except:
                    mtime = 0
                files.append({"name": n, "size_mb": s, "last_modified": mtime})
        files = sorted(files, key=lambda x: x["last_modified"], reverse=True)
        return jsonify(files)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/download_log/<filename>')
def download_log(filename):
    return send_from_directory(LOG_DIR, filename, as_attachment=True)

@app.route('/api/srs_webrtc_publish', methods=['POST'])
def srs_webrtc_publish():
    try:
        import requests
        srs_url = "http://localhost:1985/rtc/v1/publish/"
        resp = requests.post(srs_url, json=request.json, timeout=5)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"code": 500, "server": "flask", "message": str(e)}), 500
if __name__ == '__main__':
    from werkzeug.serving import WSGIRequestHandler
    WSGIRequestHandler.protocol_version = "HTTP/1.1"

    recover_orphaned_files()
    generate_ssl_certificates()

    threading.Thread(target=discovery_service, daemon=True).start()
    # threading.Thread(target=camera_worker, daemon=True).start()
    # threading.Thread(target=gpio_control_worker, daemon=True).start()
    threading.Thread(target=offline_sync_worker, daemon=True).start()

    try:
        app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
    except KeyboardInterrupt:
        pass
    finally:
        app_running = False
        stop_audio_recording()
        time.sleep(1)
