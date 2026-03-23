from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models.note import Note

logger = logging.getLogger(__name__)

# Sync engine for background tasks (BackgroundTasks runs in a thread)
_sync_url = settings.database_url.replace("+asyncpg", "+psycopg2", 1)
_sync_engine = create_engine(_sync_url)


def process_note(note_id: int) -> None:
    """Process a note in a background thread: Gemini transcription + TipTap conversion."""
    with Session(_sync_engine) as db:
        note = db.get(Note, note_id)
        if note is None:
            logger.error("Note %d not found for processing", note_id)
            return

        try:
            from app.services.gemini_service import transcribe_audio
            from app.services.tiptap_converter import markdown_to_tiptap

            markdown = transcribe_audio(note.audio_file_path)
            content_json = markdown_to_tiptap(markdown)

            # Extract title from first line
            first_line = markdown.strip().split("\n")[0].lstrip("# ").strip()
            title = first_line[:500] if first_line else "无标题笔记"

            note.title = title
            note.content_markdown = markdown
            note.content_json = content_json
            note.status = "completed"

        except Exception as e:
            logger.exception("Failed to process note %d", note_id)
            note.status = "failed"
            note.error_message = str(e)

        db.commit()
