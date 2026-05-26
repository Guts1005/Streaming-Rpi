import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_init_py_has_v1_stream_health_routes():
    source = read("init.py")
    tree = ast.parse(source)

    routes = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        for decorator in node.decorator_list:
            if (
                isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Attribute)
                and decorator.func.attr == "route"
                and decorator.args
                and isinstance(decorator.args[0], ast.Constant)
            ):
                routes.append(decorator.args[0].value)

    assert "/video_feed" in routes
    assert "/api/health" in routes
    assert "/api/stream_info" in routes


def test_stream_metadata_state_is_tracked():
    source = read("init.py")

    assert "MJPEG_QUALITY" in source
    assert "latest_frame_time" in source
    assert "stream_frame_count" in source
    assert "camera_error" in source
    assert "Cache-Control" in source


def test_host_and_rtsp_helpers_exist():
    host_viewer = read("tools/host_mjpeg_viewer.py")
    rtsp_helper = read("tools/start_rtsp_stream.sh")

    assert "VideoCapture" in host_viewer
    assert "WHO_IS_RPI_CAM?" in host_viewer
    assert "rpicam-vid" in rtsp_helper
    assert "rtsp://127.0.0.1:8554/pi-cam" in rtsp_helper


if __name__ == "__main__":
    test_init_py_has_v1_stream_health_routes()
    test_stream_metadata_state_is_tracked()
    test_host_and_rtsp_helpers_exist()
    print("V1 static checks passed.")
