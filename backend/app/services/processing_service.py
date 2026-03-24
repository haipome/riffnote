from __future__ import annotations

import logging
import time
from typing import Optional
from uuid import UUID

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models.note import Note
from app.services.storage_service import delete_audio

logger = logging.getLogger(__name__)

# Sync engine for background tasks (BackgroundTasks runs in a thread)
_sync_url = settings.database_url.replace("+asyncpg", "+psycopg2", 1)
_sync_engine = create_engine(_sync_url)

MAX_RETRIES = 3
RETRY_DELAYS = [2, 4]  # seconds between retries


def _is_retryable(e: Exception) -> bool:
    """Check if an exception is worth retrying (transient errors only)."""
    msg = str(e).lower()
    # Network / timeout / server errors
    if any(kw in msg for kw in ("timeout", "503", "500", "429", "rate limit", "overloaded", "connection", "unavailable")):
        return True
    # google-genai specific transient errors
    cls_name = type(e).__name__
    if cls_name in ("ServiceUnavailable", "ResourceExhausted", "DeadlineExceeded", "InternalServerError"):
        return True
    return False


def process_note(note_id: UUID, audio_mime: Optional[str] = None) -> None:
    """Process a note in a background thread: Gemini transcription + TipTap conversion."""
    with Session(_sync_engine) as db:
        note = db.get(Note, note_id)
        if note is None:
            logger.error("Note %s not found for processing", note_id)
            return

        audio_path = note.audio_file_path

        try:
            from app.services.gemini_service import transcribe_audio
            from app.services.tiptap_converter import markdown_to_tiptap

            # Retry Gemini call on transient errors
            markdown = None
            last_error = None
            for attempt in range(MAX_RETRIES):
                try:
                    markdown = transcribe_audio(audio_path, mime_type=audio_mime)
                    break
                except Exception as e:
                    last_error = e
                    if attempt < MAX_RETRIES - 1 and _is_retryable(e):
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        logger.warning("Gemini attempt %d failed for note %s, retrying in %ds: %s", attempt + 1, note_id, delay, e)
                        time.sleep(delay)
                    else:
                        raise

            if markdown is None:
                raise last_error or RuntimeError("transcribe_audio returned None")

            stripped = markdown.strip()
            lines = stripped.split("\n")

            # If first line is a markdown heading, use it as title and strip from body
            if lines and lines[0].startswith("#"):
                title = lines[0].lstrip("#").strip()[:500]
                body_markdown = "\n".join(lines[1:]).strip()
            else:
                first_line = lines[0] if lines else ""
                for sep in ("。", ".", "！", "？", "，", "\n"):
                    idx = first_line.find(sep)
                    if 0 < idx <= 50:
                        title = first_line[:idx]
                        break
                else:
                    title = first_line[:50]
                title = title.strip() or "无标题笔记"
                body_markdown = stripped

            content = markdown_to_tiptap(body_markdown)

            note.title = title
            note.content = content
            note.status = "completed"

        except Exception as e:
            logger.exception("Failed to process note %s after %d attempts", note_id, MAX_RETRIES)
            note.status = "failed"
            note.error_message = str(e)

        # Only delete audio on success; keep it for retry on failure
        if note.status == "completed":
            note.audio_file_path = None
            db.commit()
            if audio_path:
                delete_audio(audio_path)
        else:
            db.commit()
