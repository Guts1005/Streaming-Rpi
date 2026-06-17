# Collaborator AI Context

**CRITICAL NOTICE FOR AI AGENTS AND COLLABORATORS:**

## 1. Frontend Directory
- **ONLY use the `source/` folder** for any Next.js frontend development and deployments.
- The old deployment folder (`dpl_Dqc7MDHow7vJNqeHc9swyHasAPqR`) has been permanently deleted because it was causing confusion. Do NOT attempt to use, recreate, or deploy from any folder other than `source/`.

## 2. Vercel Deployment & Environment Variables
- Vercel deployments are managed by the user. If you run a deploy command from your environment (e.g., `vercel --prod`), be aware that the target Vercel project must have its Environment Variables configured in the Vercel Cloud Dashboard.
- **Required Cloud Environment Variables:**
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `NEXT_PUBLIC_LIVEKIT_URL`
  - `DEVICE_API_BASE` (Must point to the active ngrok URL, e.g., `https://unwell-creamer-anytime.ngrok-free.dev`)
  - `GEMINI_API_KEY`
- If these are not set in the Vercel Dashboard, any deployed build will immediately fail to connect and display as "Offline" or "Disconnected".

## 3. UI Changes
- The user rolled back a recent major UI overhaul (the "Aspire Smart Vision" dark theme) via the Vercel dashboard because it was pushed unexpectedly and broke their environment. 
- Please communicate with the user before committing massive structural changes to the UI layout so they can manage their environment variables and expectations accordingly.

## Recent Updates
- Replaced the inline SVG login logo with the uploaded Aspire logo in source/app/login/page.tsx.
- Removed the redundant "Smart Helmet" title below the Aspire logo on the login page.
- Moved "Local Files" and "Server Files" sidebar menu items into a dropdown under the "Recordings" tab.
