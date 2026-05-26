# Smart Helmet Camera System v27.1

Complete camera system with cloud upload and GPS location tracking.

## Files to Push to Git

### Core Files (REQUIRED)
1. **main.py** - Main camera system with auto SSL generation
2. **uploader.py** - Cloud uploader with GPS location extraction  
3. **templates/index.html** - Web interface
4. **.gitignore** - Prevents certificates from being pushed

### DO NOT Push to Git
- ❌ cert.pem (auto-generated)
- ❌ key.pem (auto-generated)
- ❌ recordings/ folder
- ❌ *.mp4, *.csv files

## Installation on Raspberry Pi

### 1. Clone/Pull from Git
```bash
cd ~/Desktop/Projects/hm_releases/
git pull origin main
```

### 2. Run the System
```bash
python3 main.py
```

**That's it!** The system will:
- ✅ Auto-generate SSL certificates on first run
- ✅ Start HTTPS server on port 5001
- ✅ Fall back to HTTP if SSL fails

## Configuration

### Device ID
Change in `main.py`:
```python
DEVICE_ID = "smart_hm_02"  # Change to your device ID
```

### Upload Settings
Check `uploader.py` for:
- API URL
- API Key
- Timeout settings

## Features

### Upload to Cloud
- Swipe LEFT on any video to upload
- Shows "☁️ Uploading..." during upload
- Shows "✅ Uploaded!" when complete
- Auto-deletes local file after successful upload

### GPS Location Tracking
- Extracts start_location from first CSV row
- Extracts end_location from last CSV row
- Sends to server as: "lat,lon" format

### Data Sent to Server
```
POST: https://centrix.co.in/v_api/upload

POST Data:
  - device_id: smart_hm_02
  - file_type: video
  - start_time: 2025-12-25 21:53:44
  - end_time: 2025-12-25 21:53:44
  - start_location: 18.9234,73.5678
  - end_location: 18.9245,73.5690
```

## Troubleshooting

### SSL Certificate Issues
If you see "FileNotFoundError: cert.pem":
1. System will auto-generate certificates
2. If that fails, will run on HTTP instead
3. No manual action needed

### Manual Certificate Generation (optional)
```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=IN/ST=Maharashtra/L=Nagpur/O=ThinkingRobot/CN=raspberrypi"
```

### Check Logs
Watch terminal output for detailed debug info:
```
[UPLOAD] 📍 Start Location: 18.9234,73.5678
[UPLOAD] 📍 End Location: 18.9245,73.5690
[UPLOAD] ✅ SUCCESS!
```

## Web Interface

Access at: `https://raspberrypi.local:5001` or `https://<pi-ip>:5001`

## Prototype V1 Livestream

For the current PC-viewable livestream plan, see `V1_STREAMING_PLAN.md`.

Quick checks:

```bash
curl http://<pi-ip>:5001/api/health
curl http://<pi-ip>:5001/api/stream_info
```

PC viewer:

```bash
pip install -r requirements-host.txt
python tools/host_mjpeg_viewer.py --url http://<pi-ip>:5001/video_feed
```

### Controls
- **REC VIDEO** - Start recording
- **STOP** - Stop recording
- **SNAP PIC** - Capture photo

### Media List
- Tap to playback
- Swipe LEFT to upload to cloud
- Swipe RIGHT for download link
- Long press to delete

## Security Notes

⚠️ **NEVER push these to git:**
- SSL certificates (cert.pem, key.pem)
- Recordings folder
- API keys (already in code, but be careful)

✅ **Safe to push:**
- main.py
- uploader.py
- templates/index.html
- .gitignore
