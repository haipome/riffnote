from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotebookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class NotebookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class NotebookResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    note_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
