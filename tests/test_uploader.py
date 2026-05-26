import os
import sys
import datetime
import types

# ensure repo root on path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

if "requests" not in sys.modules:
    requests_stub = types.ModuleType("requests")
    exceptions = types.SimpleNamespace(
        Timeout=type("Timeout", (Exception,), {}),
        ConnectionError=type("ConnectionError", (Exception,), {}),
    )
    requests_stub.exceptions = exceptions
    sys.modules["requests"] = requests_stub

import uploader


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text="OK"):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {"success": True, "message": "Upload successful"}
        self.text = text

    def json(self):
        return self._json_data


def run_video_upload_test():
    os.makedirs("recordings", exist_ok=True)
    video_name = "video_20250101_120000_chunk000.mp4"
    video_path = os.path.join("recordings", video_name)
    try:
        with open(video_path, "wb") as f:
            f.write(b"\x00\x00")  # small dummy content
        os.utime(video_path, (datetime.datetime.now().timestamp(), datetime.datetime.now().timestamp()))

        captured = {}

        def fake_post(url, headers=None, files=None, data=None, timeout=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["files"] = files
            captured["data"] = data
            captured["timeout"] = timeout
            return FakeResponse()

        # patch requests.post
        uploader.requests.post = fake_post

        ok, msg = uploader.upload_to_cloud(
            video_path=video_path,
            device_id="test-device",
            start_location="18.0,72.0",
            stop_location="18.1,72.1",
            location_json_string='{"points":[]}'
        )

        print("VIDEO ok:", ok, "msg:", msg)
        print("VIDEO files keys:", list(captured.get("files", {}).keys()))
        print("VIDEO data keys:", list(captured.get("data", {}).keys()))
        assert ok, "Video upload should succeed"
        assert "video" in captured["files"], "Multipart key should be 'video' for video uploads"
        assert captured["data"]["file_type"] == "video"
        assert "start_time" in captured["data"] and "end_time" in captured["data"]
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)


def run_image_upload_test():
    os.makedirs("recordings", exist_ok=True)
    image_name = "img_20250101_120000.jpg"
    image_path = os.path.join("recordings", image_name)
    try:
        with open(image_path, "wb") as f:
            f.write(b"\xff\xd8\xff")  # JPEG header bytes
        os.utime(image_path, (datetime.datetime.now().timestamp(), datetime.datetime.now().timestamp()))

        captured = {}

        def fake_post(url, headers=None, files=None, data=None, timeout=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["files"] = files
            captured["data"] = data
            captured["timeout"] = timeout
            return FakeResponse()

        uploader.requests.post = fake_post

        ok, msg = uploader.upload_image_to_cloud(
            image_path=image_path,
            device_id="test-device",
            start_location="18.2,72.2",
            stop_location="18.2,72.2",
            location_json_string='{"points":[{"lat":18.2,"lon":72.2}]}'
        )

        print("IMAGE ok:", ok, "msg:", msg)
        print("IMAGE files keys:", list(captured.get("files", {}).keys()))
        print("IMAGE data keys:", list(captured.get("data", {}).keys()))
        assert ok, "Image upload should succeed"
        assert "video" in captured["files"], "Multipart key should be 'video' for image uploads (server compatibility)"
        assert captured["data"]["file_type"] == "image"
        assert "start_time" in captured["data"] and "end_time" in captured["data"]
        assert "start_location" in captured["data"] and "stop_location" in captured["data"]
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


if __name__ == "__main__":
    run_video_upload_test()
    run_image_upload_test()
    print("All uploader tests passed.")
