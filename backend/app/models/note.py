from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.notebook import Notebook
    from app.models.user import User


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    notebook_id: Mapped[int] = mapped_column(ForeignKey("notebooks.id"), index=True)
    title: Mapped[str] = mapped_column(String(500), default="无标题笔记")
    content_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    content_markdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    audio_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="processing")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="notes")
    notebook: Mapped[Notebook] = relationship(back_populates="notes")
