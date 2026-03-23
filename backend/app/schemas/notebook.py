from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotebookCreate(BaseModel):
    name: str


class NotebookUpdate(BaseModel):
    name: Optional[str] = None


class NotebookResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    note_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
