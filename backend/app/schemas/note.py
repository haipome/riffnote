from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class NoteListItem(BaseModel):
    id: UUID
    notebook_id: UUID
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteResponse(BaseModel):
    id: UUID
    notebook_id: UUID
    title: str
    content: Optional[Any] = None
    status: str
    audio_duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[Any] = None
    notebook_id: Optional[UUID] = None


class NoteStatusResponse(BaseModel):
    id: UUID
    status: str
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}
