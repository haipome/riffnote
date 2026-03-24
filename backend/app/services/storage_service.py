from __future__ import annotations

import os
import tempfile

from app.config import settings


def save_audio_temp(data: bytes, extension: str = "webm") -> str:
    """Save audio bytes to a temp file. Returns the file path."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    tmp = tempfile.NamedTemporaryFile(
        suffix=f".{extension}", dir=settings.upload_dir, delete=False
    )
    tmp.write(data)
    tmp.close()
    return tmp.name


def delete_audio(file_path: str) -> None:
    try:
        os.remove(file_path)
    except OSError:
        pass
