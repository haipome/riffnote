# RiffNote

Voice-to-structured-note app. Users speak freely, AI restructures messy speech into clean, well-organized text.

## Project Structure

- `backend/` — FastAPI + SQLAlchemy async + PostgreSQL
- `frontend/` — React 19 + React Router 7 (SPA mode) + TailwindCSS 4 + Clerk auth

## Quick Start

```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
# → http://localhost:8000

# Frontend
cd frontend && npm run dev
# → http://localhost:5173
```

## Key Services

- **Auth**: Clerk (frontend `@clerk/react`, backend JWT verification via JWKS)
- **Database**: PostgreSQL (local, user `haipoyang`, no password)
- **AI**: Gemini 2.5 Flash via `google-genai` SDK (audio → structured text)
- **Editor**: TipTap (rich text, auto-save)

## Environment Variables

### backend/.env
- `DATABASE_URL` — PostgreSQL async connection string
- `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `GEMINI_API_KEY` — Google Gemini API key

### frontend/.env
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key

## Core Flow

1. Frontend records audio (OGG/MP4, fallback WebM)
2. `POST /api/notes` uploads audio + creates note (status=processing)
3. Background task: save audio → convert to mp3 if webm → upload to Gemini Files API → generate structured text → convert Markdown to TipTap JSON → save to DB
4. Frontend polls `GET /api/notes/{id}/status` every 500ms → navigates to editor on completion

## Important Notes

- Python 3.9 (system) — use `from __future__ import annotations` and `Optional[]` instead of `X | None`
- Gemini does NOT support `audio/webm` — backend converts to mp3 via ffmpeg when needed
- Frontend records in OGG (Chrome/Firefox) or MP4 (Safari) to avoid conversion
- `google-genai` SDK officially requires Python 3.10+ but works on 3.9 for basic operations
