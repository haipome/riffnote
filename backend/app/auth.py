from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()

_jwks_cache: Optional[dict] = None
_jwks_cache_time: float = 0
_JWKS_TTL_SECONDS = 300  # 5 minutes


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache, _jwks_cache_time
    now = time.monotonic()
    if _jwks_cache is None or force_refresh or (now - _jwks_cache_time > _JWKS_TTL_SECONDS):
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                settings.clerk_jwks_url,
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_time = now
    return _jwks_cache


async def _verify_token(token: str) -> dict:
    """Verify Clerk JWT and return the payload."""
    jwks = await _get_jwks()
    public_keys = {}
    for key_data in jwks.get("keys", []):
        public_keys[key_data["kid"]] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    if kid not in public_keys:
        jwks = await _get_jwks(force_refresh=True)
        public_keys = {}
        for key_data in jwks.get("keys", []):
            public_keys[key_data["kid"]] = jwt.algorithms.RSAAlgorithm.from_jwk(
                key_data
            )
        if kid not in public_keys:
            raise ValueError("Unknown signing key")

    return jwt.decode(token, key=public_keys[kid], algorithms=["RS256"])


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify Clerk JWT, then find-or-create the local User row."""
    try:
        payload = await _verify_token(credentials.credentials)
    except (jwt.PyJWTError, ValueError, KeyError, httpx.HTTPError) as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clerk_id = payload["sub"]

    user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one_or_none()

    if user is None:
        try:
            user = User(clerk_id=clerk_id)
            db.add(user)
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            # Concurrent request already created this user — just fetch it
            await db.rollback()
            user = (await db.execute(select(User).where(User.clerk_id == clerk_id))).scalar_one()

    return user
