# NinjaDojo v1

Next.js + Supabase app with a Chrome extension to power live lobby progress boards and Sensei workflows.

## Features implemented
- Unified live dashboard (`/tv`) with realtime updates, lesson completion modal, and unknown-student resolution flow.
- Legacy dashboard route (`/dashboard`) permanently redirects to `/tv`.
- Curriculum builder (`/curriculum`) for belts, levels, lessons, and point values.
- Monthly report generator (`/reports`) with local PDF download workflow.
- SQL schema + views + RLS policies in `sql/001_schema.sql` and belt seed in `sql/002_seed_belts.sql`.
- Chrome extension in `chrome-extension/` for Sensei portal extraction.

## Quick start
1. Install dependencies.
2. Copy `.env.example` to `.env.local` and fill values.
3. Run SQL files in Supabase SQL editor.
4. Run `npm run dev`.
5. Run `npm run sync:extension-env`.
6. Load `chrome-extension/` as unpacked extension.

## API endpoints
- `GET /api/dashboard/today`
- `GET /api/curriculum`
- `POST /api/curriculum`
- `POST /api/students/resolve-unknown`
- `POST /api/progress/complete-lesson`
- `POST /api/reports/monthly/generate`

## Monthly automation schedule
- Target schedule: first day of each month at 6:00 AM (America/Chicago).
- Trigger endpoint: `POST /api/reports/monthly/generate` with `x-kiosk-key` header.
