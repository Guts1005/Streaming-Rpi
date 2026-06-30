#!/usr/bin/env python3
import os
import re
import json
import time
import subprocess
import logging
import threading

import cv2
from dotenv import load_dotenv
load_dotenv()

# We only import picamera2 if we are using it to avoid crashes on non-Pi setups
CAMERA_TYPE = os.getenv("CAMERA_TYPE", "picam")
CAMERA_DEVICE = os.getenv("CAMERA_DEVICE", "/dev/video0")

if CAMERA_TYPE == "picam":
    try:
        from picamera2 import Picamera2
        from libcamera import Transform
    except ImportError:
        pass

from pyzbar.pyzbar import decode as zbar_decode

import RPi.GPIO as GPIO

# -------------------- CONFIG --------------------
IGNORE_SSID = "PSRVJ"
WLAN_IFACE = "wlan0"
INIT_PY_PATH = os.path.join(os.path.dirname(__file__), "init.py")
# Match main.py camera settings
CAM_WIDTH, CAM_HEIGHT = 1640, 1232
FPS = 30.0

# LED (GPIO 25)
LED_PIN = 17
LED_FAST_PERIOD = 0.15   # seconds (fast blink)
LED_SLOW_PERIOD = 0.8    # seconds (slow blink)

# UX
COUNTDOWN_BEFORE_SWITCH = 5
POST_CONNECT_WAIT = 2
RESCAN_DELAY_ON_FAIL = 2

WINDOW_NAME = "SmartHelmet QR Provisioning"
# ------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


# -------------------- LED CONTROL --------------------
class LedController:
    def __init__(self, pin: int):
        self.pin = pin
        self._mode = "off"       # off | on | blink_fast | blink_slow
        self._stop = False
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._run, daemon=True)

        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        GPIO.output(self.pin, GPIO.LOW)

        self._thread.start()

    def set_mode(self, mode: str):
        with self._lock:
            self._mode = mode

    def stop(self):
        self._stop = True
        try:
            self._thread.join(timeout=1)
        except Exception:
            pass
        try:
            GPIO.output(self.pin, GPIO.LOW)
        except Exception:
            pass
        try:
            GPIO.cleanup(self.pin)
        except Exception:
            pass

    def _run(self):
        state = False
        while not self._stop:
            with self._lock:
                mode = self._mode

            if mode == "off":
                GPIO.output(self.pin, GPIO.LOW)
                time.sleep(0.1)
                continue

            if mode == "on":
                GPIO.output(self.pin, GPIO.HIGH)
                time.sleep(0.1)
                continue

            if mode == "blink_fast":
                state = not state
                GPIO.output(self.pin, GPIO.HIGH if state else GPIO.LOW)
                time.sleep(LED_FAST_PERIOD)
                continue

            if mode == "blink_slow":
                state = not state
                GPIO.output(self.pin, GPIO.HIGH if state else GPIO.LOW)
                time.sleep(LED_SLOW_PERIOD)
                continue

            GPIO.output(self.pin, GPIO.LOW)
            time.sleep(0.1)


# -------------------- UTILS --------------------
def run(cmd, timeout=50):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def which(binary: str):
    try:
        from shutil import which as _which
        return _which(binary)
    except Exception:
        return None


def get_current_ssid():
    try:
        r = run(["iwgetid", "-r"], timeout=5)
        ssid = (r.stdout or "").strip()
        return ssid if ssid else None
    except Exception:
        return None


def has_ipv4():
    try:
        r = run(["ip", "-4", "addr", "show", WLAN_IFACE], timeout=5)
        return "inet " in (r.stdout or "")
    except Exception:
        return False


def verify_connected(expected_ssid: str = None):
    ssid = get_current_ssid()
    if not ssid:
        return False, None
    if expected_ssid and ssid != expected_ssid:
        return False, ssid
    if not has_ipv4():
        return False, ssid
    return True, ssid


def parse_wifi_qr(payload: str):
    """
    Supported:
    1) WIFI:T:WPA;S:MySSID;P:MyPass;;
    2) {"ssid":"MySSID","password":"MyPass"}
    3) ssid=MySSID;password=MyPass
    Returns (ssid, password) or (None, None)
    """
    if not payload:
        return None, None

    s = payload.strip()

    # JSON
    if s.startswith("{") and s.endswith("}"):
        try:
            obj = json.loads(s)
            ssid = obj.get("ssid") or obj.get("S")
            password = obj.get("password") or obj.get("P")
            if ssid is not None and password is not None:
                return str(ssid), str(password)
        except Exception:
            pass

    # Standard WIFI:
    if s.startswith("WIFI:"):
        m_s = re.search(r"S:([^;]*)", s)
        m_p = re.search(r"P:([^;]*)", s)
        ssid = m_s.group(1) if m_s else None
        password = m_p.group(1) if m_p else ""
        if ssid:
            return ssid, password

    # Simple kv
    low = s.lower()
    if "ssid=" in low and "password=" in low:
        try:
            parts = s.split(";")
            kv = {}
            for p in parts:
                if "=" in p:
                    k, v = p.split("=", 1)
                    kv[k.strip().lower()] = v.strip()
            ssid = kv.get("ssid")
            password = kv.get("password", "")
            if ssid:
                return ssid, password
        except Exception:
            pass

    return None, None


def nmcli_disconnect():
    r = run(["nmcli", "dev", "disconnect", WLAN_IFACE], timeout=15)
    ok = (r.returncode == 0)
    msg = ((r.stdout or "") + (r.stderr or "")).strip()
    return ok, msg


def nmcli_connect(ssid: str, password: str):
    run(["nmcli", "radio", "wifi", "on"], timeout=10)
    if password:
        r = run(["nmcli", "dev", "wifi", "connect", ssid, "password", password, "ifname", WLAN_IFACE], timeout=60)
    else:
        r = run(["nmcli", "dev", "wifi", "connect", ssid, "ifname", WLAN_IFACE], timeout=60)

    ok = (r.returncode == 0)
    msg = ((r.stdout or "") + (r.stderr or "")).strip()
    return ok, msg


def countdown(seconds: int, prefix: str):
    for i in range(seconds, 0, -1):
        logging.info(f"{prefix} in {i}...")
        time.sleep(1)


def launch_main_py():
    logging.info("[BOOT] Launching Init.py now...")
    os.execv("/usr/bin/python3", ["/usr/bin/python3", INIT_PY_PATH])


def draw_overlay(bgr, ssid_now: str, msg: str):
    y = 30
    cv2.putText(bgr, "SmartHelmet QR Provisioning", (20, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)
    y += 30
    cv2.putText(bgr, f"Current SSID: {ssid_now or 'None'}", (20, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.60, (255, 255, 255), 2)
    y += 30
    cv2.putText(bgr, msg, (20, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 255, 255), 2)
    y += 30
    cv2.putText(bgr, "Press 'q' to quit", (20, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 2)


def init_camera_like_main():
    picam2 = Picamera2()
    config = picam2.create_video_configuration(
        main={"size": (CAM_WIDTH, CAM_HEIGHT), "format": "YUV420"},
        lores={"size": (640, 480), "format": "YUV420"},
        transform=Transform(hflip=True, vflip=True),
        controls={"FrameRate": FPS},
        buffer_count=6
    )
    config["sensor"]["output_size"] = (CAM_WIDTH, CAM_HEIGHT)
    picam2.configure(config)
    picam2.start()
    picam2.set_controls({"ScalerCrop": (0, 0, 3280, 2464)})
    time.sleep(0.5)
    return picam2


def main():
    if which("nmcli") is None:
        logging.critical("[FATAL] nmcli not found.")
        raise SystemExit(1)

    if not os.path.exists(INIT_PY_PATH):
        logging.critical(f"[FATAL] main.py not found at: {INIT_PY_PATH}")
        raise SystemExit(1)

    led = LedController(LED_PIN)

    picam2 = None
    cap = None
    if CAMERA_TYPE == "picam":
        picam2 = init_camera_like_main()
    else:
        dev_idx = CAMERA_DEVICE
        if CAMERA_DEVICE.startswith("/dev/video"):
            try:
                dev_idx = int(CAMERA_DEVICE.replace("/dev/video", ""))
            except:
                pass
        cap = cv2.VideoCapture(dev_idx)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 900, 650)

    logging.info("[QR] Scanner running.")
    ssid = get_current_ssid()

    # If connected to something else, immediately start main.py (success mode)
    if ssid and ssid != IGNORE_SSID:
        led.set_mode("on")
        logging.info(f"[WIFI] Connected to SSID: {ssid}. Launching main.py ...")
        time.sleep(1)
        launch_main_py()

    logging.info(f"[WIFI] Current SSID: {ssid or 'None'}. IGNORE_SSID={IGNORE_SSID}. Keeping scan mode.")
    led.set_mode("blink_fast")

    last_payload = None
    last_time = 0.0

    try:
        while True:
            if CAMERA_TYPE == "picam":
                raw_yuv = picam2.capture_array("lores")
                if raw_yuv is None:
                    time.sleep(0.02)
                    continue
                bgr = cv2.cvtColor(raw_yuv, cv2.COLOR_YUV2BGR_I420)
            else:
                ret, bgr = cap.read()
                if not ret or bgr is None:
                    time.sleep(0.02)
                    continue

            ssid_now = get_current_ssid()
            draw_overlay(bgr, ssid_now, f"Show Wi-Fi QR. Will switch from {IGNORE_SSID}.")

            decoded = zbar_decode(bgr)
            if decoded:
                payload = decoded[0].data.decode("utf-8", errors="ignore").strip()

                now = time.time()
                if payload == last_payload and (now - last_time) < 2:
                    pass
                else:
                    last_payload = payload
                    last_time = now

                    target_ssid, target_pass = parse_wifi_qr(payload)
                    if not target_ssid:
                        logging.warning(f"[QR] Detected but unsupported QR: {payload[:120]}")
                        led.set_mode("blink_fast")
                    else:
                        led.set_mode("on")  # solid while switching
                        logging.info("--------------------------------------------------")
                        logging.info("[QR] Found credentials:")
                        logging.info(f"     SSID: {target_ssid}")
                        logging.info(f"     PASS: {target_pass}")
                        logging.info("--------------------------------------------------")

                        countdown(COUNTDOWN_BEFORE_SWITCH, "[WIFI] Switching network")

                        okd, msgd = nmcli_disconnect()
                        logging.info(f"[WIFI] Disconnect: {'OK' if okd else 'WARN'} {msgd}")

                        okc, msgc = nmcli_connect(target_ssid, target_pass)
                        logging.info(f"[WIFI] Connect: {'OK' if okc else 'FAIL'} {msgc}")

                        if not okc:
                            logging.error("[WIFI] Connect failed. Back to scan.")
                            led.set_mode("blink_fast")
                            time.sleep(RESCAN_DELAY_ON_FAIL)
                        else:
                            time.sleep(POST_CONNECT_WAIT)
                            okv, ssid_ver = verify_connected(expected_ssid=target_ssid)
                            if okv:
                                logging.info(f"[WIFI] Verified connected to: {ssid_ver}")
                                led.set_mode("on")
                                time.sleep(10)  # success indication before network cuts your VNC
                                launch_main_py()
                                return
                            else:
                                logging.error(f"[WIFI] Not verified. Current SSID={ssid_ver}. Back to scan.")
                                led.set_mode("blink_fast")
                                time.sleep(RESCAN_DELAY_ON_FAIL)

            cv2.imshow(WINDOW_NAME, bgr)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

    finally:
        if CAMERA_TYPE == "picam":
            try:
                picam2.stop()
            except Exception:
                pass
        else:
            try:
                if cap: cap.release()
            except Exception:
                pass
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        led.stop()


if __name__ == "__main__":
    main()
