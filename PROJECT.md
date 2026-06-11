# PROJECT — Aspire Smart Vision Dashboard

## Architecture
- **Frontend**: Next.js app at `source/` — single-page dashboard in `source/app/page.tsx` (~635 lines) + `source/app/globals.css` (~498 lines)
- **Backend**: Flask at `init.py` (~1633 lines) — runs on Raspberry Pi
- **API Proxy**: `source/app/api/device/[...path]/route.ts` — Vercel proxy to Pi
- **Token API**: `source/app/api/token/route.ts` — LiveKit token generation
- **Layout**: `source/app/layout.tsx` — minimal root layout

## Code Layout
```
source/
├── app/
│   ├── page.tsx          ← Main dashboard (ALL UI)
│   ├── globals.css       ← All styles
│   ├── layout.tsx        ← Root layout
│   ├── page.module.css   ← Unused module CSS
│   └── api/
│       ├── token/route.ts    ← LiveKit token endpoint
│       └── device/[...path]/route.ts ← Pi proxy
├── package.json
└── tsconfig.json
init.py                   ← Flask backend (Pi)
```

## Existing Feature Status (from codebase analysis)

### Already Implemented ✅
- Sidebar with brand header, nav groups (MONITORING, LIBRARY, AI FEATURES, PROGRESS ANALYSIS), device status panel
- Video player with LiveKit integration, LIVE badge, timestamp, connection status, 1080p indicator, control bar
- Quick Actions 2×3 grid (Local Recording, Desktop Recording, Sync, Download, Snapshot, Live Talk)
- Recent Recordings list with thumbnails, filenames, sizes, download buttons
- Construction Progress Comparison with side-by-side images, stats, progress bars
- AI Summary with AUTO GENERATED badge, 4-metric grid, analysis text
- System Status grid (Live Stream, Recording Local, Recording Desktop, Server Sync)
- Video Player Modal with error handling and download fallback
- Gallery Modal with grid layout, play/download buttons
- Dark navy color scheme (#0a0e17, #111827, #2563eb)
- Inter font
- Desktop recording via browser API
- Local recording start/stop
- Gemini AI analysis trigger
- Toast notifications
- Basic responsive breakpoints (1200px, 768px)

### Gaps / Needs Enhancement 🔧
1. **Mobile**: No hamburger menu — sidebar just disappears on mobile. Need toggle button.
2. **Gallery**: No delete functionality, no file status indicators (uploaded/failed/converting)
3. **AI Feature Views**: Object Detection, Face Detection, Safety Alerts nav items are non-functional
4. **Sync to Server**: Just shows a fake toast, doesn't call actual API
5. **Innovations**: None implemented yet
6. **Live time**: `liveTime` is computed once via `useMemo` with no deps — it's static, not updating
7. **Fullscreen button**: Not functional
8. **Delete button**: Missing from gallery
9. **Recording timer**: Not live-updating (only refreshes via status poll)

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Full Dashboard Enhancement | UI polish, mobile hamburger, gallery delete, AI views, sync fix, all functional gaps, innovations | none | PLANNED |
| 2 | Build Verification & Review | npm run build, review, fix any issues | M1 | PLANNED |

## Interface Contracts
### Frontend ↔ Backend (via /api/device/ proxy)
- `GET /api/status` → `{is_recording, storage_free_gb, recording_time, ...}`
- `GET /api/start_record` → starts recording
- `POST /api/stop_record` → stops recording
- `GET /api/capture_photo` → captures snapshot
- `GET /api/list_media` → returns array of media items
- `GET /api/gemini_analyze` → triggers AI analysis
- `POST /api/delete_file` → deletes a file (exists in backend)
- `GET /data/<filename>` → serves media file
- `GET /download/<filename>` → downloads media file
- `POST /api/upload_cloud` → syncs file to cloud
