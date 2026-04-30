"""
API Key model for programmatic access.

API keys allow external systems to trigger workflows and access the API
without interactive authentication. Keys are stored as hashes, never plaintext.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBaseModel

if TYPE_CHECKING:
    from app.models.user import User


class APIKey(TenantBaseModel):
    """
    API key for programmatic automation triggers.

    The raw key is shown once at creation time. Only the SHA-256 hash is stored.
    Keys can be scoped to specific operations and have optional expiration.
    """

    __tablename__ = "api_keys"
    __table_args__ = (
        Index("ix_api_keys_key_hash", "key_hash", unique=True),
        Index("ix_api_keys_tenant_active", "tenant_id", "is_active"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(
        String(12), nullable=False
    )  # First 8 chars for identification (e.g. "ank_xxxx")
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    scopes: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {"workflows": ["read", "execute"], "webhooks": ["trigger"]},
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Owner
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="api_keys")

    def __repr__(self) -> str:
        return f"<APIKey {self.key_prefix}... ({self.name})>"
