# AGENTS.md

This repository is the working base for the Smart Helmet / Raspberry Pi streaming project. Follow these instructions for any AI coding agent working here.

## User Preferences

- Preserve tokens. Be concise. Do not repeat context unless needed.
- Prefer direct implementation over long discussion.
- Ask only for missing information that cannot be discovered safely.
- Keep explanations short unless the user explicitly asks for detail.
- Do not make broad refactors during urgent demo/deployment work.
- Before committing, ask the user.
- **CRITICAL NEW RULE**: Every time you start working or making a change, FIRST pull everything (`git pull`) to check for changes and get the latest files.
- Do not expose or hard-code secrets in committed files.

## Project Context

- Root backend: `init.py`, `requirements.txt`, `uploader.py`
- Current V3 frontend: `source/`
- Older Vercel app copy: `dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR/src`
- Flask UI template: `templates/index.html`
- Local media folder: `recordings/`
- Pi tools/services: `tools/`
- Production viewer: `https://helmet-live-viewer.vercel.app/`
- Raspberry Pi repo path: `/home/trc/Desktop/Projects/Streaming-Rpi/hm_releases`
- Raspberry Pi LAN IP used during development: `192.168.0.240`

Do not assume these are still current if the user says the Pi/network changed. Verify before deployment.

## Current Architecture

- Camera livestream uses LiveKit.
- Vercel/Next.js subscribes to LiveKit video/audio.
- Browser-to-Pi talkback uses LiveKit microphone publishing.
- Pi audio bridge publishes Pi USB/default mic to LiveKit and plays browser audio on the Pi speaker.
- Pi local GPIO offline capture uses a separate service.
- Flask backend manages media listing, local recording APIs, capture APIs, upload, delete, Gemini analysis, and AI summary.
- Vercel device proxy uses `/api/device/...`; it only works if `DEVICE_API_BASE` points to a publicly reachable Pi/backend URL.

Important: Vercel cannot directly reach a private LAN IP such as `192.168.x.x` from the cloud.

## Key Services On The Pi

- `livekit-publisher.service`: publishes camera video to LiveKit.
- `livekit-audio-bridge.service`: two-way LiveKit audio bridge.
- `gpio-offline-capture.service`: GPIO local recording/photo capture and auto-sync.
- `wifi-qr-connect.service`: boot-time WiFi QR scanner when no internet is available.

Check status with:

```bash
systemctl is-active livekit-publisher livekit-audio-bridge gpio-offline-capture wifi-qr-connect
```

## GPIO Defaults

- `GPIO6`: local recording start/stop button (Physical Pin 31)
- `GPIO13`: image capture button (Physical Pin 33)
- `GPIO19`: stream/WiFi scan status LED (Physical Pin 35)
- `GPIO26`: local recording/photo LED (Physical Pin 37)
- `GND`: Ground pin available at Physical Pin 39

Behavior:

- `GPIO19` blinks during WiFi QR scan.
- `GPIO19` stays ON when streaming/connected status is active.
- `GPIO26` stays ON during local recording.
- `GPIO26` blinks once on image capture.
- Local recording may stop LiveKit streaming temporarily because the Pi camera cannot be owned by two processes at the same time.

## WiFi / Offline Flow

On boot:

1. If internet is available, skip QR scan and start streaming.
2. If internet is unavailable, run `wifi-qr-connect.service`.
3. The Pi camera scans a standard WiFi QR code for the configured scan window.
4. If WiFi connects, streaming services start.
5. If no QR is scanned, local GPIO capture remains available offline.

Standard WiFi QR format:

```text
WIFI:T:WPA;S:SSID_NAME;P:WIFI_PASSWORD;;
```

Do not store WiFi passwords in documentation unless the user explicitly asks and accepts that risk.

## Deployment Rules

### Vercel

Deploy the current frontend from `source/` unless the user explicitly says to use another app folder.

Required Vercel environment variables:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_ROOM`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `DEVICE_API_BASE` if device APIs must work from Vercel
- `GEMINI_API_KEY` if Gemini calls run through Vercel routes

Build/deploy:

```powershell
cd source
npm install
npm run build
vercel --prod --yes
```

Use `vercel.cmd` on Windows if PowerShell blocks `vercel.ps1`.

### Raspberry Pi

Sync only required files. Avoid overwriting unrelated Pi files.

Typical backend sync targets:

- `init.py`
- `requirements.txt`
- `uploader.py`
- `tools/*.py`
- `tools/*.service`

After syncing:

```bash
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl daemon-reload
sudo systemctl restart <changed-service>
```

Do not restart camera services during a demo unless necessary.

## Rollback / Backup Discipline

Before risky deployment:

1. Check current git state:

```bash
git status --short
```

2. If touching Pi files, create a timestamped backup on the Pi:

```bash
mkdir -p ~/hm_backups
cp init.py ~/hm_backups/init.py.$(date +%Y%m%d_%H%M%S)
cp -r tools ~/hm_backups/tools.$(date +%Y%m%d_%H%M%S)
```

3. For Vercel, note the currently working deployment URL from the Vercel output.
4. If a deploy breaks the demo, redeploy the last known working frontend or use Vercel rollback.

Never use `git reset --hard` or destructive cleanup unless the user explicitly approves.

## SQA And Verification

Use the smallest verification set that covers the change.

Frontend:

```bash
npm run build
```

Backend:

```bash
python -m py_compile init.py tools/*.py
```

Pi service health:

```bash
systemctl is-active livekit-publisher livekit-audio-bridge gpio-offline-capture
journalctl -u livekit-publisher -n 50 --no-pager
journalctl -u livekit-audio-bridge -n 50 --no-pager
journalctl -u gpio-offline-capture -n 50 --no-pager
```

Demo checklist:

1. LiveKit video appears on Vercel.
2. Browser can hear Pi mic after enabling audio.
3. Browser mic talkback plays through Pi speaker.
4. GPIO local recording starts/stops.
5. GPIO photo capture saves a file.
6. Offline files sync after internet returns.
7. Gemini analysis returns a result when `GEMINI_API_KEY` is configured.
8. Media gallery lists and deletes Pi files when `DEVICE_API_BASE` is reachable.

## Iteration Methodology

Use this loop:

1. Identify the exact failing surface.
2. Verify whether the failure is frontend, backend, Pi service, network, or credentials.
3. Make the smallest effective change.
4. Build or compile.
5. Deploy only the affected part.
6. Verify the user-visible workflow.
7. Record critical caveats briefly.

When UI and functionality conflict, preserve working stream/audio/talk logic first, then improve presentation.

## Known Pitfalls

- Static HTML LiveKit code was fragile. Prefer React LiveKit components in `source/app/page.tsx`.
- Vercel cannot call a private Pi IP directly.
- The Pi camera cannot be shared by `rpicam-vid`, Picamera2, and `rpicam-still` simultaneously.
- GPIO local recording may need to stop `livekit-publisher` to access the camera.
- Browser audio playback often requires a user click.
- Do not assume the Pi has a monitor, keyboard, mouse, HDMI, or LAN at demo sites.
- Always account for hotspot/client WiFi instability.

## Graphify

If the user asks for `/graphify` or architecture understanding, use the Graphify workflow and existing `graphify-out/` artifacts where useful. Do not spend tokens on full manual audits when Graphify output can answer the structure question faster.

## Communication Style

- Start with what changed or what is blocked.
- Keep status updates short.
- Give exact commands when the user needs to run something.
- If something cannot be verified, say so directly and state the next concrete check.
