# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RiffNote — voice-to-structured-note app. Users speak freely, AI restructures messy speech into clean, well-organized text.

## Development Commands

### Backend (FastAPI)

```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload          # Dev server → http://localhost:8000
pip install -r requirements.txt        # Install dependencies
```

### Frontend (React)

```bash
cd frontend
npm run dev                            # Dev server → http://localhost:5173
npm run typecheck                      # react-router typegen && tsc
npm run build                          # Production build
```

### Database

```bash
# Tables are auto-created on startup via Base.metadata.create_all()
# For schema changes, ALWAYS use Alembic migrations (never drop_all):
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head
```

No test framework is set up in either backend or frontend. No linter/formatter config exists.

## Architecture

### Backend (`backend/app/`)

- **main.py** — FastAPI app, lifespan (creates tables, upload dir), CORS (configurable via `CORS_ORIGINS`), logging setup
- **auth.py** — Clerk JWT verification via JWKS with TTL cache. `get_current_user()` finds/creates User
- **config.py** — Pydantic Settings loading from `.env`
- **database.py** — Async engine (asyncpg), async session factory, `get_db()` dependency
- **models/** — SQLAlchemy 2.0 (`Mapped[]`, `mapped_column()`): User (int PK), Notebook (UUID PK), Note (UUID PK)
- **schemas/** — Pydantic request/response models
- **routers/notebooks.py** — CRUD for notebooks (`/api/notebooks`), auto-creates default notebook if none exist
- **routers/notes.py** — Note CRUD + audio upload (`POST /api/notes`) + status polling + retry (`POST /api/notes/{id}/retry`)
- **services/processing_service.py** — Background note processing with retry (max 3 attempts, backoff on transient errors)
- **services/gemini_service.py** — Sends audio to Gemini (inline data or Files API) → generates structured markdown via `gemini-2.5-flash`
- **services/tiptap_converter.py** — Markdown → TipTap JSON using `markdown-it-py`
- **services/storage_service.py** — Temp audio file storage (deleted after processing succeeds, kept on failure for retry)

### Frontend (`frontend/app/`)

- **root.tsx** — ClerkProvider, sidebar (expandable notebooks with note lists, three-dot menus), mobile responsive overlay
- **routes.ts** — Routes: `/` (home), `/notebooks/:id/new` (record), `/notes/:id` (detail)
- **lib/api.ts** — `apiFetch(path, token, options)` — authenticated fetch wrapper, API base URL configurable via `VITE_API_BASE`
- **lib/use-is-mobile.ts** — `useIsMobile()` hook for responsive layout (breakpoint 767px)
- **components/recording-button.tsx** — MediaRecorder: prefers OGG → MP4 → WebM fallback
- **routes/home.tsx** — Signed-out: split card (intro + Clerk sign-in/sign-up). Signed-in: welcome + notebook selector + recording button
- **routes/new-note.tsx** — Record → upload → immediately navigate to note detail (no polling here)
- **routes/note-detail.tsx** — View mode (default) / edit mode toggle, TipTap editor with auto-save, polling for processing status, retry button for failed notes

### Background Processing Pipeline

```
POST /api/notes (audio upload)
  → Save audio to temp file
  → Create Note (status="processing")
  → Navigate to /notes/:id immediately
  → BackgroundTasks (thread pool, sync DB session)
    → Gemini API call (with retry: 3 attempts, 2s/4s backoff)
      → Convert to mp3 if webm (ffmpeg)
      → Send audio inline (<20MB) or via Files API
      → Generate structured text (Chinese system prompt: "无损精修")
    → Convert Markdown → TipTap JSON
    → Extract title from first heading (fallback: first sentence)
    → Update Note (status="completed")
    → Delete temp audio file
  ← Frontend polls /api/notes/{id}/status every 500ms
  ← Sidebar refreshes via "note-updated" custom event
```

## Key Technical Constraints

- **Python 3.9 compatibility** — use `from __future__ import annotations` and `Optional[X]` (not `X | None`) in all backend files
- **UUID primary keys** — Notebook and Note use UUID v4 as primary key; User stays int (internal only)
- **Async/sync split** — FastAPI routes use async + asyncpg; background processing uses sync SQLAlchemy + psycopg2 (because BackgroundTasks runs in a thread pool)
- **Audio formats** — Gemini does NOT support `audio/webm`; backend auto-converts to mp3 via ffmpeg. Frontend records OGG (Chrome/Firefox) or MP4 (Safari) to avoid conversion
- **SPA mode** — `ssr: false` in react-router.config.ts because Clerk is client-only
- **Frontend path alias** — `~/` maps to `app/` (configured in tsconfig.json)
- **Tailwind 4** — uses `@theme` block for custom CSS variables, not tailwind.config.js
- **Database migrations** — ALWAYS use Alembic for schema changes, NEVER drop_all/create_all on existing tables

## Environment Variables

### backend/.env
- `DATABASE_URL` — PostgreSQL async connection string (`postgresql+asyncpg://...`)
- `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `GEMINI_API_KEY` — Google Gemini API key
- `CORS_ORIGINS` — Comma-separated allowed origins (default: `http://localhost:5173`)
- `UPLOAD_DIR` — Temp audio file directory (default: `uploads`)

### frontend/.env
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `VITE_API_BASE` — Backend API URL (default: `http://localhost:8000`)

## External Dependencies

- **PostgreSQL** — local, user `haipoyang`, no password
- **ffmpeg** — required for webm→mp3 audio conversion (`brew install ffmpeg`)
- **Clerk** — auth provider (JWT verified via JWKS endpoint)
- **Google Gemini** — `google-genai` SDK, model `gemini-2.5-flash`
