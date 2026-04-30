"""
API Key management endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, CurrentTenant, DbSession
from app.core.security import generate_api_key
from app.models.api_key import APIKey
from app.schemas.api_key import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyListResponse,
    APIKeyResponse,
)

router = APIRouter(prefix="/api-keys")


@router.post(
    "",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new API key",
)
async def create_api_key(
    payload: APIKeyCreateRequest,
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
):
    raw_key, key_prefix, key_hash = generate_api_key()

    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    api_key = APIKey(
        name=payload.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=payload.scopes,
        expires_at=expires_at,
        user_id=user.id,
        tenant_id=tenant.id,
    )
    db.add(api_key)
    await db.flush()

    return APIKeyCreateResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,  # shown only once!
        key_prefix=key_prefix,
        scopes=api_key.scopes,
        expires_at=expires_at,
        created_at=api_key.created_at,
    )


@router.get(
    "",
    response_model=APIKeyListResponse,
    summary="List all API keys in workspace",
)
async def list_api_keys(
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
):
    result = await db.execute(
        select(APIKey)
        .where(APIKey.tenant_id == tenant.id)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()

    return APIKeyListResponse(keys=keys, total=len(keys))


@router.delete(
    "/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API key",
)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.tenant_id == tenant.id)
    )
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.is_active = False
    await db.flush()
