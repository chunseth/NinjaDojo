# NinjaDojo Sensei Bridge Extension

## Setup
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `chrome-extension/`.
4. In project root, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
5. Run `npm run sync:extension-env` to generate `chrome-extension/env.js`.
6. Reload the extension.
7. Open either:
   - `https://sensei.codeninjas.com/live-ninjas`
   - `https://sensei.codeninjas.com/my-ninjas`

## What it does
- Reads students from Sensei pages:
  - `/live-ninjas`: active/inactive cards based on `time-expired`.
  - `/my-ninjas`: only students with `Subscription Status: Active`.
- Sends snapshots on initial load, DOM updates, and heartbeat.
- Computes active/inactive transitions.
- Upserts to Supabase `active_sessions` using day + status-scoped `idempotency_key` (at most one `active` row and one `inactive` row per student/day).
- Writes `inactive` only when that student has confirmed same-day active history (shared through Supabase so multiple devices stay consistent).
- Syncs active-subscription students from `/my-ninjas` into `students` table.

## Notes
- Selector list in `content.js` may need tuning to your Sensei DOM.
- This extension is intended for local unpacked deployment in-center.

## Troubleshooting
- `TypeError: Failed to fetch` in `background.js`:
  - Confirm `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Re-run `npm run sync:extension-env` and reload extension.
  - Confirm Supabase project is reachable and URL is exactly `https://<project-ref>.supabase.co`.
  - Confirm `active_sessions` and `students` tables exist and RLS/policies allow extension sync.
- `Extension context invalidated` in `content.js`:
  - This can happen right after reloading/updating the extension.
  - Refresh the Sensei tab once after extension reload.
