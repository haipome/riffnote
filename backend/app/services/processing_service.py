from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models.note import Note
from app.services.storage_service import delete_audio

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

        audio_path = note.audio_file_path

        try:
            from app.services.gemini_service import transcribe_audio
            from app.services.tiptap_converter import markdown_to_tiptap

            markdown = transcribe_audio(audio_path)
            stripped = markdown.strip()
            lines = stripped.split("\n")

            # If first line is a markdown heading, use it as title and strip from body
            if lines and lines[0].startswith("#"):
                title = lines[0].lstrip("#").strip()[:500]
                body_markdown = "\n".join(lines[1:]).strip()
            else:
                # No heading — derive title from first sentence, keep full body
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

            content_json = markdown_to_tiptap(body_markdown)

            note.title = title
            note.content_markdown = markdown
            note.content_json = content_json
            note.status = "completed"

        except Exception as e:
            logger.exception("Failed to process note %d", note_id)
            note.status = "failed"
            note.error_message = str(e)

        # Always clean up: delete temp audio file and clear the path
        note.audio_file_path = None
        db.commit()

        if audio_path:
            delete_audio(audio_path)
