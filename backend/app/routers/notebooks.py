from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.notebook import Notebook
from app.models.note import Note
from app.models.user import User
from app.schemas.notebook import NotebookCreate, NotebookResponse, NotebookUpdate

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])


@router.get("", response_model=list[NotebookResponse])
async def list_notebooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Auto-create default notebook if user has none
    has_any = (
        await db.execute(
            select(Notebook.id).where(Notebook.user_id == user.id).limit(1)
        )
    ).scalar_one_or_none()
    if has_any is None:
        default_nb = Notebook(user_id=user.id, name="默认笔记本", is_default=True)
        db.add(default_nb)
        await db.commit()

    stmt = (
        select(
            Notebook,
            func.count(Note.id).label("note_count"),
        )
        .outerjoin(Note, Note.notebook_id == Notebook.id)
        .where(Notebook.user_id == user.id)
        .group_by(Notebook.id)
        .order_by(Notebook.is_default.desc(), Notebook.created_at)
    )
    rows = (await db.execute(stmt)).all()
    return [
        NotebookResponse(
            id=nb.id,
            name=nb.name,
            is_default=nb.is_default,
            note_count=count,
            created_at=nb.created_at,
            updated_at=nb.updated_at,
        )
        for nb, count in rows
    ]


@router.post("", response_model=NotebookResponse, status_code=201)
async def create_notebook(
    body: NotebookCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Notebook).where(
            Notebook.user_id == user.id, Notebook.name == body.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Notebook with this name already exists")

    nb = Notebook(user_id=user.id, name=body.name)
    db.add(nb)
    await db.commit()
    await db.refresh(nb)
    return NotebookResponse(
        id=nb.id,
        name=nb.name,
        is_default=nb.is_default,
        note_count=0,
        created_at=nb.created_at,
        updated_at=nb.updated_at,
    )


@router.patch("/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: UUID,
    body: NotebookUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nb = await _get_user_notebook(db, notebook_id, user.id)
    if body.name is not None:
        existing = await db.execute(
            select(Notebook).where(
                Notebook.user_id == user.id,
                Notebook.name == body.name,
                Notebook.id != notebook_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Notebook with this name already exists")
        nb.name = body.name
    await db.commit()
    await db.refresh(nb)
    count = await _note_count(db, nb.id)
    return NotebookResponse(
        id=nb.id,
        name=nb.name,
        is_default=nb.is_default,
        note_count=count,
        created_at=nb.created_at,
        updated_at=nb.updated_at,
    )


@router.delete("/{notebook_id}", status_code=204)
async def delete_notebook(
    notebook_id: UUID,
    action: Optional[str] = Query(None),
    move_to: Optional[UUID] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nb = await _get_user_notebook(db, notebook_id, user.id)
    note_count = await _note_count(db, notebook_id)

    if note_count > 0:
        if action == "move_notes":
            if not move_to:
                raise HTTPException(400, "move_to is required when action is move_notes")
            target = await _get_user_notebook(db, move_to, user.id)
            await db.execute(
                update(Note)
                .where(Note.notebook_id == notebook_id)
                .values(notebook_id=target.id)
            )
            await db.flush()
            # Expire notebook's cached notes to avoid cascade deleting moved notes
            await db.refresh(nb)
        elif action == "delete_notes":
            pass  # cascade will handle it, or delete explicitly below
        else:
            raise HTTPException(
                400,
                "Notebook has notes. Specify action=delete_notes or action=move_notes&move_to=<id>",
            )

    await db.delete(nb)
    await db.commit()


async def _get_user_notebook(
    db: AsyncSession, notebook_id: UUID, user_id: int
) -> Notebook:
    nb = (
        await db.execute(
            select(Notebook).where(
                Notebook.id == notebook_id, Notebook.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if nb is None:
        raise HTTPException(404, "Notebook not found")
    return nb


async def _note_count(db: AsyncSession, notebook_id: UUID) -> int:
    result = await db.execute(
        select(func.count(Note.id)).where(Note.notebook_id == notebook_id)
    )
    return result.scalar() or 0
