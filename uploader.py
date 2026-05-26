"""
Cloud Upload Module for Smart Helmet
Uploads: video file + start_location + stop_location + location(JSON string)
Does NOT rename files (main.py handles renaming)
"""

import os
import logging
import requests
import datetime

UPLOAD_URL = "https://centrix.co.in/v_api/upload"
API_KEY = "DDjgMfxLqhxbNmaBoTkfBJkhMxNxkPwMgGjPUwCOaJRCBrvtUX"


def _extract_times_from_filename(filename: str):
    """
    Extract start/end time from names like:
      video_20251225_211046_chunk000.mp4
      uploaded_20251225_211046_chunk000.mp4
      failed_upload_20251225_211046_chunk000.mp4
    Returns (start_time, end_time) as 'YYYY-MM-DD HH:MM:SS'
    """
    try:
        base = os.path.basename(filename)
        # find first occurrence of YYYYMMDD_HHMMSS
        import re
        m = re.search(r"(\d{8}_\d{6})", base)
        if not m:
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return now, now
        dt = datetime.datetime.strptime(m.group(1), "%Y%m%d_%H%M%S")
        ts = dt.strftime("%Y-%m-%d %H:%M:%S")
        return ts, ts
    except Exception:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return now, now


def upload_to_cloud(
    *,
    video_path: str,
    device_id: str,
    start_location: str = None,
    stop_location: str = None,
    location_json_string: str = ""
):
    """
    Upload video and location payload to cloud.

    Args:
      video_path: absolute/relative path to mp4
      device_id: device identifier string
      start_location: "lat,lon" or None
      stop_location: "lat,lon" or None
      location_json_string: JSON string (entire file content) or ""

    Returns:
      (success: bool, message: str)
    """
    try:
        if not os.path.exists(video_path):
            return False, "Video file not found"

        filename = os.path.basename(video_path)
        start_time, end_time = _extract_times_from_filename(filename)
        try:
            mtime = os.path.getmtime(video_path)
            end_time = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

        data = {
            "device_id": device_id,
            "file_type": "video",
            "start_time": start_time,
            "end_time": end_time,
        }

        # Your required keys:
        if start_location:
            data["start_location"] = str(start_location)
        if stop_location:
            data["stop_location"] = str(stop_location)

        # Store entire JSON as a string under "location"
        if location_json_string is None:
            location_json_string = ""
        data["location"] = str(location_json_string)

        headers = {"X-API-KEY": API_KEY}

        with open(video_path, "rb") as vf:
            files = {
                "video": (filename, vf, "video/mp4")
            }
            resp = requests.post(
                UPLOAD_URL,
                headers=headers,
                files=files,
                data=data,
                timeout=180
            )

        # Try JSON response
        try:
            result = resp.json()
        except Exception:
            # Non-JSON response
            if resp.status_code == 200:
                return True, "Upload successful"
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"

        if resp.status_code != 200:
            msg = result.get("message") or f"HTTP {resp.status_code}"
            return False, msg

        # Expect server to return {"success": true/false, ...}
        if bool(result.get("success")):
            return True, result.get("message") or "Upload successful"

        return False, result.get("message") or "Upload failed"

    except requests.exceptions.Timeout:
        return False, "Timeout"
    except requests.exceptions.ConnectionError:
        return False, "Connection error"
    except Exception as e:
        logging.exception("[UPLOAD] Unexpected error")
        return False, str(e)

def upload_image_to_cloud(
    *,
    image_path: str,
    device_id: str,
    start_location: str = None,
    stop_location: str = None,
    location_json_string: str = ""
):
    try:
        if not os.path.exists(image_path):
            return False, "Image file not found"
        filename = os.path.basename(image_path)
        start_time, end_time = _extract_times_from_filename(filename)
        try:
            mtime = os.path.getmtime(image_path)
            end_time = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
        data = {
            "device_id": device_id,
            "file_type": "image",
            "start_time": start_time,
            "end_time": end_time,
        }
        if start_location:
            data["start_location"] = str(start_location)
        if stop_location:
            data["stop_location"] = str(stop_location)
        if location_json_string is None:
            location_json_string = ""
        data["location"] = str(location_json_string)
        headers = {"X-API-KEY": API_KEY}
        with open(image_path, "rb") as f:
            files = {
                "video": (filename, f, "image/jpeg")
            }
            resp = requests.post(
                UPLOAD_URL,
                headers=headers,
                files=files,
                data=data,
                timeout=180
            )
        try:
            result = resp.json()
        except Exception:
            if resp.status_code == 200:
                return True, "Upload successful"
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        if resp.status_code != 200:
            msg = result.get("message") or f"HTTP {resp.status_code}"
            return False, msg
        if bool(result.get("success")):
            return True, result.get("message") or "Upload successful"
        return False, result.get("message") or "Upload failed"
    except requests.exceptions.Timeout:
        return False, "Timeout"
    except requests.exceptions.ConnectionError:
        return False, "Connection error"
    except Exception as e:
        logging.exception("[UPLOAD] Unexpected error")
        return False, str(e)
