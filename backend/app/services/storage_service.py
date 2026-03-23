from __future__ import annotations

import os

from app.config import settings


def get_audio_dir(user_id: int) -> str:
    path = os.path.join(settings.upload_dir, "audio", str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_audio(user_id: int, note_id: int, data: bytes, extension: str = "webm") -> str:
    """Save audio bytes to disk. Returns the file path."""
    directory = get_audio_dir(user_id)
    filename = f"{note_id}.{extension}"
    file_path = os.path.join(directory, filename)
    with open(file_path, "wb") as f:
        f.write(data)
    return file_path


def delete_audio(file_path: str) -> None:
    try:
        os.remove(file_path)
    except OSError:
        pass
