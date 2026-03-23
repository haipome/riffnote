# Backend — FastAPI

## Run

```bash
source .venv/bin/activate
uvicorn app.main:app --reload
```

## Structure

```
app/
  main.py              — FastAPI app, lifespan, router registration
  config.py            — Pydantic Settings (loads .env)
  database.py          — async engine + session factory + get_db dependency
  auth.py              — Clerk JWT verification, get_current_user (find-or-create user + default notebook)
  models/
    base.py            — DeclarativeBase
    user.py            — User (clerk_id, email, name)
    notebook.py        — Notebook (user_id, name, is_default)
    note.py            — Note (notebook_id, title, content_json, content_markdown, audio_file_path, status)
  schemas/
    notebook.py        — NotebookCreate, NotebookUpdate, NotebookResponse
    note.py            — NoteListItem, NoteResponse, NoteUpdate, NoteStatusResponse
  routers/
    notebooks.py       — CRUD /api/notebooks
    notes.py           — CRUD /api/notes, POST /api/notes (multipart audio upload)
  services/
    storage_service.py — Save/delete audio files on disk (uploads/audio/{user_id}/{note_id}.ext)
    gemini_service.py  — Gemini API: upload audio → generate structured text
    tiptap_converter.py — Markdown → TipTap JSON conversion
    processing_service.py — Orchestrates: audio → Gemini → TipTap JSON → DB (runs in BackgroundTasks)
```

## API Endpoints

### Notebooks
- `GET /api/notebooks` — list (with note_count)
- `POST /api/notebooks` — create `{name}`
- `PATCH /api/notebooks/{id}` — rename `{name}`
- `DELETE /api/notebooks/{id}` — delete (400 if default)

### Notes
- `GET /api/notebooks/{id}/notes` — list (paginated, reverse chronological)
- `POST /api/notes` — multipart: `notebook_id` + `audio` file → create + process
- `GET /api/notes/{id}` — detail (with content_json)
- `PATCH /api/notes/{id}` — update `{title?, content_json?, notebook_id?}`
- `DELETE /api/notes/{id}` — delete (+ audio file)
- `GET /api/notes/{id}/status` — poll processing status

### Other
- `GET /api/health` — DB connectivity check
- `GET /api/me` — current user info

## Conventions

- Python 3.9: always use `from __future__ import annotations` and `Optional[X]` (not `X | None`)
- All models use `Mapped[]` + `mapped_column()` (SQLAlchemy 2.0 style)
- Background processing uses sync SQLAlchemy (`create_engine` + `Session`) because FastAPI `BackgroundTasks` runs in thread pool
- Gemini audio: supported formats are OGG, MP4, MP3, WAV, FLAC, AAC. WebM is NOT supported — convert via ffmpeg
- Tables are auto-created on startup via `Base.metadata.create_all`. Alembic is configured but no migrations generated yet
