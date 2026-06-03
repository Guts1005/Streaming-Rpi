# Codex Handoff: Smart Helmet Dashboard + Vercel Deployment

## Repository

- GitHub remote: `https://github.com/Guts1005/Streaming-Rpi.git`
- Main workspace: `C:\Users\Soumya\Downloads\hm_releases-main\hm_releases-main`
- Current branch used for work: `main`

## What Was Built

The project now has two UI surfaces:

1. Flask/Raspberry Pi template UI in `templates/index.html`
2. Vercel/Next.js deployment UI in `dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR/src`

The UI was upgraded into an enterprise-style smart helmet surveillance dashboard with:

- Premium dark theme
- Left sidebar navigation
- Large central LiveKit stream panel
- Right-side action cards
- Local recording controls
- Desktop/client recording controls
- Snapshot capture and preview
- Server sync/upload actions
- Download/delete/sync actions for recent recordings
- Live Talk push-to-talk UI
- Device/system status cards
- Settings sections for stream, recording, audio, server, and UI preferences

No AI inference was implemented. AI analytics/reporting/object detection/face detection features were intentionally excluded.

## Vercel App

Vercel app folder:

```text
dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR/src
```

Important files:

```text
app/page.tsx
app/globals.css
app/layout.tsx
app/api/token/route.ts
app/api/device/[...path]/route.ts
next.config.ts
package.json
```

Production deployment was completed successfully:

```text
https://helmet-live-viewer.vercel.app
```

Deployment ID:

```text
dpl_9A9CZnqk3kUz6iuGdwEKHVGiTxwo
```

Vercel project:

```text
guts1005s-projects/helmet-live-viewer
```

## LiveKit Connection

LiveKit is still connected through the existing Vercel token API:

```text
GET /api/token
```

The token route uses:

```text
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_ROOM
```

The frontend uses:

```text
NEXT_PUBLIC_LIVEKIT_URL
NEXT_PUBLIC_LIVEKIT_ROOM
```

The token grant was updated to allow Live Talk:

```ts
canSubscribe: true
canPublish: true
canPublishData: true
```

The deployed token endpoint was verified and returned a token successfully.

## Device API Proxy

A Vercel-side proxy route was added:

```text
/api/device/[...path]
```

This lets the deployed browser call Raspberry Pi/Flask APIs through the same Vercel origin, avoiding browser CORS issues.

The proxy forwards requests to:

```text
DEVICE_API_BASE
```

or fallback:

```text
NEXT_PUBLIC_DEVICE_API_BASE
```

Current issue:

Vercel has LiveKit env vars, but does not currently have `DEVICE_API_BASE`. Because of that:

```text
https://helmet-live-viewer.vercel.app/api/device/api/health
```

returns:

```json
{"error":"Missing DEVICE_API_BASE or NEXT_PUBLIC_DEVICE_API_BASE"}
```

To finish device API connectivity, add this Vercel environment variable:

```text
DEVICE_API_BASE=https://<public-pi-or-tunnel-url>
```

Then redeploy production.

## Device/Pi Endpoints Used By The Dashboard

The upgraded UI calls the existing Flask backend endpoints:

```text
GET  /api/health
GET  /api/list_media
GET  /api/capture_photo
GET  /api/start_record
POST /api/stop_record
POST /api/upload_cloud
POST /api/upload_image
POST /api/delete_file
GET  /api/download/<filename>
GET  /api/list_logs
GET  /api/download_log/<filename>
```

Through Vercel, these become:

```text
/api/device/api/health
/api/device/api/list_media
/api/device/api/capture_photo
/api/device/api/start_record
/api/device/api/stop_record
/api/device/api/upload_cloud
/api/device/api/upload_image
/api/device/api/delete_file
/api/device/api/download/<filename>
/api/device/api/list_logs
/api/device/api/download_log/<filename>
```

## Validation Already Done

From:

```powershell
cd C:\Users\Soumya\Downloads\hm_releases-main\hm_releases-main\dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR\src
```

Validated:

```powershell
npm.cmd run lint
npm.cmd run build
```

Both passed locally.

Vercel production deployment also built successfully.

Public checks performed:

```text
https://helmet-live-viewer.vercel.app
```

returned `200 OK`.

```text
https://helmet-live-viewer.vercel.app/api/token
```

returned `200 OK` with a token.

```text
https://helmet-live-viewer.vercel.app/api/device/api/health
```

returned `500` only because `DEVICE_API_BASE` is missing.

## Recommended Next Steps

1. Add `DEVICE_API_BASE` in Vercel production/preview environment variables.
2. Redeploy production:

```powershell
cd dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR/src
npx.cmd vercel deploy --prod --yes
```

3. Verify:

```text
/api/device/api/health
/api/device/api/list_media
/api/device/api/capture_photo
```

4. Test UI actions:

- LiveKit stream appears
- Start local recording
- Stop local recording
- Capture snapshot
- Download media
- Upload/sync media
- Delete media
- Push-to-talk microphone publish

## Suggested Workflow For Another Codex

Give another Codex:

1. This handoff file
2. The GitHub repo URL
3. The deployed Vercel URL
4. The expected device API base URL, if available
5. A specific task, such as:

```text
Read CODEX_DEPLOYMENT_HANDOFF.md first. Verify the Vercel Next.js dashboard in dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR/src. Do not add AI features. Preserve LiveKit and existing Flask/Pi endpoints. Finish DEVICE_API_BASE setup and verify the device proxy endpoints.
```

Best practice: keep this handoff file updated after each deployment so future agents do not need to rediscover the architecture.
