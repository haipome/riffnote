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
# Alembic is configured but tables are auto-created on startup via Base.metadata.create_all()
# To generate a migration:
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head
```

No test framework is set up in either backend or frontend. No linter/formatter config exists.

## Architecture

### Backend (`backend/app/`)

- **main.py** — FastAPI app, lifespan (creates tables, upload dir), CORS for localhost:5173, mounts routers
- **auth.py** — Clerk JWT verification via JWKS. `get_current_user()` finds/creates User + default notebook ("默认笔记本")
- **config.py** — Pydantic Settings loading from `.env`
- **database.py** — Async engine (asyncpg), async session factory, `get_db()` dependency
- **models/** — SQLAlchemy 2.0 (`Mapped[]`, `mapped_column()`): User, Notebook, Note
- **schemas/** — Pydantic request/response models
- **routers/notebooks.py** — CRUD for notebooks (`/api/notebooks`)
- **routers/notes.py** — Note CRUD + audio upload (`POST /api/notes`) + status polling (`GET /api/notes/{id}/status`)
- **services/processing_service.py** — Background note processing pipeline (runs in thread pool, uses **sync** SQLAlchemy with psycopg2)
- **services/gemini_service.py** — Uploads audio to Gemini Files API → generates structured markdown via `gemini-2.5-flash`
- **services/tiptap_converter.py** — Markdown → TipTap JSON using `markdown-it-py`
- **services/storage_service.py** — Local audio file storage in `uploads/audio/{user_id}/`

### Frontend (`frontend/app/`)

- **root.tsx** — ClerkProvider wrapper, two-column layout (collapsible sidebar + outlet)
- **routes.ts** — Route definitions: `/`, `/notebooks`, `/notebooks/:id`, `/notebooks/:id/new`, `/notes/:id`
- **lib/api.ts** — `apiFetch(path, token, options)` — authenticated fetch wrapper, injects Bearer token from Clerk
- **components/recording-button.tsx** — MediaRecorder: prefers OGG → MP4 → WebM fallback
- **routes/new-note.tsx** — Record → upload → poll status (500ms) → navigate to editor
- **routes/note-detail.tsx** — TipTap editor with auto-save (1.5s debounce), title edit, delete

### Background Processing Pipeline

```
POST /api/notes (audio upload)
  → Create Note (status="processing")
  → BackgroundTasks (thread pool, sync DB session)
    → Save audio to disk
    → Convert to mp3 if webm (ffmpeg)
    → Upload to Gemini Files API
    → Generate structured text (Chinese system prompt: "无损精修")
    → Convert Markdown → TipTap JSON
    → Extract title from first heading
    → Update Note (status="completed")
  ← Frontend polls /api/notes/{id}/status every 500ms
```

## Key Technical Constraints

- **Python 3.9 compatibility** — use `from __future__ import annotations` and `Optional[X]` (not `X | None`) in all backend files
- **Async/sync split** — FastAPI routes use async + asyncpg; background processing uses sync SQLAlchemy + psycopg2 (because BackgroundTasks runs in a thread pool)
- **Audio formats** — Gemini does NOT support `audio/webm`; backend auto-converts to mp3 via ffmpeg. Frontend records OGG (Chrome/Firefox) or MP4 (Safari) to avoid conversion
- **SPA mode** — `ssr: false` in react-router.config.ts because Clerk is client-only
- **Frontend path alias** — `~/` maps to `app/` (configured in tsconfig.json)
- **Tailwind 4** — uses `@theme` block for custom CSS variables, not tailwind.config.js

## Environment Variables

### backend/.env
- `DATABASE_URL` — PostgreSQL async connection string (`postgresql+asyncpg://...`)
- `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `GEMINI_API_KEY` — Google Gemini API key

### frontend/.env
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key

## External Dependencies

- **PostgreSQL** — local, user `haipoyang`, no password
- **ffmpeg** — required for webm→mp3 audio conversion (`brew install ffmpeg`)
- **Clerk** — auth provider (JWT verified via JWKS endpoint)
- **Google Gemini** — `google-genai` SDK (officially requires Python 3.10+ but works on 3.9)
