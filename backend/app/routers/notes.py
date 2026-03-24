from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.notebook import Notebook
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteListItem, NoteResponse, NoteStatusResponse, NoteUpdate
from app.services.storage_service import delete_audio, save_audio_temp

router = APIRouter(tags=["notes"])


@router.post("/api/notes", response_model=NoteResponse, status_code=201)
async def create_note(
    background_tasks: BackgroundTasks,
    notebook_id: int = Form(...),
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify notebook belongs to user
    nb = (
        await db.execute(
            select(Notebook).where(
                Notebook.id == notebook_id, Notebook.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if nb is None:
        raise HTTPException(404, "Notebook not found")

    # Create note
    note = Note(user_id=user.id, notebook_id=notebook_id, status="processing")
    db.add(note)
    await db.flush()

    # Save audio to temp file
    audio_data = await audio.read()
    ALLOWED_EXTENSIONS = {"ogg", "mp4", "mp3", "wav", "flac", "aac", "webm", "mpeg"}
    ext = audio.filename.rsplit(".", 1)[-1].lower() if audio.filename and "." in audio.filename else "webm"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported audio format: {ext}")
    file_path = save_audio_temp(audio_data, ext)
    note.audio_file_path = file_path

    await db.commit()
    await db.refresh(note)

    # Trigger background processing (Phase 4 will add Gemini integration)
    from app.services.processing_service import process_note
    background_tasks.add_task(process_note, note.id)

    return note


@router.get("/api/notebooks/{notebook_id}/notes")
async def list_notes(
    notebook_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify notebook belongs to user
    nb = (
        await db.execute(
            select(Notebook).where(
                Notebook.id == notebook_id, Notebook.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if nb is None:
        raise HTTPException(404, "Notebook not found")

    total_result = await db.execute(
        select(func.count(Note.id)).where(Note.notebook_id == notebook_id)
    )
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    notes_result = await db.execute(
        select(Note)
        .where(Note.notebook_id == notebook_id)
        .order_by(Note.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    notes = notes_result.scalars().all()

    return {
        "items": [NoteListItem.model_validate(n) for n in notes],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/api/notes/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_user_note(db, note_id, user.id)
    return note


@router.patch("/api/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    body: NoteUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_user_note(db, note_id, user.id)

    if body.notebook_id is not None:
        nb = (
            await db.execute(
                select(Notebook).where(
                    Notebook.id == body.notebook_id, Notebook.user_id == user.id
                )
            )
        ).scalar_one_or_none()
        if nb is None:
            raise HTTPException(404, "Target notebook not found")
        note.notebook_id = body.notebook_id

    if body.title is not None:
        note.title = body.title
    if body.content_json is not None:
        note.content_json = body.content_json

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/api/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_user_note(db, note_id, user.id)
    # Clean up temp audio if still present (e.g. note deleted while processing)
    if note.audio_file_path:
        delete_audio(note.audio_file_path)
    await db.delete(note)
    await db.commit()


@router.get("/api/notes/{note_id}/status", response_model=NoteStatusResponse)
async def get_note_status(
    note_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_user_note(db, note_id, user.id)
    return NoteStatusResponse(id=note.id, status=note.status, error_message=note.error_message)


async def _get_user_note(db: AsyncSession, note_id: int, user_id: int) -> Note:
    note = (
        await db.execute(
            select(Note).where(Note.id == note_id, Note.user_id == user_id)
        )
    ).scalar_one_or_none()
    if note is None:
        raise HTTPException(404, "Note not found")
    return note
