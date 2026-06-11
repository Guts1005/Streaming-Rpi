# Original User Request

## Initial Request — 2026-06-11T16:28:18+05:30

Build a production-quality live streaming dashboard ("Aspire Smart Vision") for a Raspberry Pi-based smart camera system. The system serves two audiences: construction site managers monitoring worksites for progress/safety insights, and sports event organizers streaming matches. The dashboard is a Next.js app deployed on Vercel; the Pi runs a Flask backend with LiveKit streaming, local recording, GPIO controls, and AI analysis.

Working directory: c:\Users\sharv\Downloads\hm_releases-main-latest\hm_releases-main
Integrity mode: development

## Context

The project already has a working foundation:
- **Frontend**: Next.js app at `source/` deployed to Vercel at `https://helmet-live-viewer.vercel.app/`
- **Backend**: Flask app at `init.py` running on Raspberry Pi with endpoints for recording, media listing, status, upload, Gemini analysis
- **Services**: LiveKit publisher, audio bridge, GPIO offline capture, WiFi QR connect
- **Proxy**: Vercel API proxy at `source/app/api/device/[...path]/route.ts` that forwards requests to the Pi (requires `DEVICE_API_BASE` env var)
- **Key env vars**: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_ROOM`, `NEXT_PUBLIC_LIVEKIT_URL`, `DEVICE_API_BASE`, `GEMINI_API_KEY`

A reference design image exists showing the target UI layout. The current implementation partially matches it but needs significant polish and feature completion.

**Important Pi constraints:**
- The Pi camera cannot be shared by two processes simultaneously — local recording must stop the LiveKit stream
- The Pi may not have a monitor/keyboard at deployment sites
- Vercel cannot directly reach a private LAN IP — the proxy route handles this
- Browser audio playback requires a user click

## Requirements

### R1. UI/UX — Match the Reference Design and Polish

The dashboard must visually match the provided reference design and feel premium enough for a demo presentation. Key elements that must be present and styled correctly:

- **Sidebar**: Brand header ("Aspire Smart Vision"), navigation items grouped under MONITORING, LIBRARY, AI FEATURES, PROGRESS ANALYSIS sections, device status panel at the bottom with connection status, device ID, and storage usage bar
- **Video player**: LiveKit stream with LIVE badge, timestamp, connection status dot, 1080p indicator, and a proper control bar (play/pause, volume/mute, progress, snapshot, settings, fullscreen)
- **Quick Actions**: 2×3 grid with Local Recording, Desktop Recording, Sync to Server, Download Files, Snapshot, Live Talk — each with colored icon and functional click handler
- **Recent Recordings**: List with thumbnails, filenames, sizes, download buttons, and a "View All" link that opens a gallery modal
- **Construction Progress Comparison**: Side-by-side image comparison with dates, stats (Foundation Work %, Columns Completed, Workers Detected), and progress bars
- **AI Summary**: AUTO GENERATED badge, 4-metric grid (+43% progress, +23 structural elements, +12 workers, 92% accuracy), analysis text
- **System Status**: Grid showing Live Stream, Recording (Local), Recording (Desktop), Server Sync — each with colored status dot
- **Mobile responsiveness**: The dashboard must be usable on phones and tablets. Sidebar should collapse, grid should restack, video should resize properly

### R2. Local Recording — Full End-to-End Flow

Local recording must work reliably from the dashboard:

- Start recording → Pi stops LiveKit stream, starts `rpicam-vid` recording, dashboard shows a dimmed video frame with pulsing "● REC" overlay and timer
- Stop recording → Pi saves the MP4, restarts LiveKit stream, dashboard shows "Resuming stream" feedback and refreshes the recordings list after a delay (Pi needs time to finalize the file)
- Recordings appear in the "Recent Recordings" list and can be played in an in-browser video player modal with seeking support (the Vercel proxy must forward `Range`/`Content-Range` headers)
- A "Download instead" fallback link in the player modal for when Vercel streaming times out
- Error handling: if video fails to load, show an error message instead of a broken player

### R3. Desktop Recording

Desktop recording captures the user's screen locally in the browser:

- Uses `navigator.mediaDevices.getDisplayMedia()` to capture screen
- Shows active recording state in the Quick Actions button and System Status
- When stopped, auto-downloads the recording as an MP4
- Button toggles between start/stop states

### R4. AI Features — Real Integration

Integrate real AI capabilities using the Gemini API (already partially wired):

- **AI Analysis**: The "Generate AI Report" button should call the Pi's `/api/gemini_analyze` endpoint, which captures the latest image and sends it to Gemini for construction site analysis
- **AI Summary**: Should display actual analysis results when available, falling back to placeholder text when not
- **Object Detection / Face Detection / Safety Alerts**: These sidebar items should lead to functional views. At minimum, show the live stream with overlay indicators. If YOLO or similar models aren't feasible on the Pi, use Gemini vision API to analyze snapshots and display results

### R5. Media Management

- Gallery modal showing all recordings and images from the Pi with play/download options
- Files should display their actual size, type, and status (uploaded, failed, converting)
- Sync to Server button should trigger the Pi's upload API for pending files
- Delete functionality for individual files and batches

### R6. Innovative Improvements

The team should propose and implement 3-5 creative improvements that make the product stand out. Examples of the kind of thinking expected (the team should come up with their own ideas):
- Smart notifications when the AI detects safety violations
- GPS-based location tracking overlay on recordings
- Time-lapse generation from recorded footage
- Voice commands via the Live Talk feature
- Battery/temperature monitoring from Pi sensors
- Multi-camera support for switching between angles

## Acceptance Criteria

### Visual Fidelity
- [ ] The dashboard layout matches the reference design: sidebar with all nav groups, video player with badges and control bar, Quick Actions 2×3 grid, Recent Recordings with download buttons, Progress Comparison with stats, AI Summary with metrics, System Status grid
- [ ] The color scheme uses the dark navy palette (#0a0e17 background, #111827 panels, #2563eb accent blue)
- [ ] Typography uses Inter font with proper weight hierarchy (700 for headings, 500-600 for body, proper sizing)
- [ ] The page looks polished on desktop (1920×1080), laptop (1366×768), tablet (768px), and mobile (375px) viewports

### Recording Functionality
- [ ] Clicking "Local Recording" sends a request to the Pi's `/api/start_record` endpoint
- [ ] Clicking "Stop Recording" sends a request to `/api/stop_record` and the recordings list updates within 5 seconds
- [ ] Clicking a recording in the list opens a video player modal where the video plays with seeking support
- [ ] Desktop Recording captures the screen using the browser API and saves an MP4 locally
- [ ] The System Status panel accurately reflects which recordings are active

### AI Integration
- [ ] The "Generate AI Report" button triggers a real Gemini API call through the Pi and displays the response
- [ ] At least one AI feature (Object Detection, Face Detection, or Safety Alerts) shows real analysis results from Gemini vision or another model

### Media Management
- [ ] The gallery modal displays all media files from the Pi's `/api/list_media` endpoint
- [ ] Each file can be played (video) or viewed (image) in the modal
- [ ] Each file has a working download button

### Build Verification
- [ ] `npm run build` in the `source/` directory completes without errors
- [ ] `python -m py_compile init.py` passes without errors (if Pi backend is modified)
- [ ] No TypeScript errors or warnings in the build output

### Innovation
- [ ] At least 3 novel improvements are implemented beyond the base requirements
- [ ] Each improvement is documented with a brief description of what it does and why it adds value
