"""
Pydantic schemas for API key endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class APIKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scopes: dict = Field(
        default_factory=lambda: {"workflows": ["read", "execute"], "webhooks": ["trigger"]}
    )
    expires_in_days: int | None = Field(None, ge=1, le=365)


class APIKeyCreateResponse(BaseModel):
    """Returned only once at creation time — includes the raw key."""
    id: uuid.UUID
    name: str
    key: str  # raw key — shown only once
    key_prefix: str
    scopes: dict
    expires_at: datetime | None
    created_at: datetime


class APIKeyResponse(BaseModel):
    """List view — never includes the raw key."""
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: dict
    is_active: bool
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyListResponse(BaseModel):
    keys: list[APIKeyResponse]
    total: int
