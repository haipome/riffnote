from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class NoteListItem(BaseModel):
    id: int
    notebook_id: int
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteResponse(BaseModel):
    id: int
    notebook_id: int
    title: str
    content_json: Optional[Any] = None
    status: str
    audio_duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content_json: Optional[Any] = None
    notebook_id: Optional[int] = None


class NoteStatusResponse(BaseModel):
    id: int
    status: str
    error_message: Optional[str] = None
