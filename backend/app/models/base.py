"""
Base model mixins for multi-tenant data isolation.

TenantMixin: Adds tenant_id column + index to every tenant-scoped model.
TimestampMixin: Adds created_at / updated_at columns with auto-update.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow() -> datetime:
    """Return timezone-aware UTC now."""
    return datetime.now(timezone.utc)


def generate_uuid() -> uuid.UUID:
    """Generate a new UUID4."""
    return uuid.uuid4()


class TimestampMixin:
    """Adds created_at and updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=text("NOW()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=text("NOW()"),
        nullable=False,
    )


class TenantMixin:
    """
    Adds tenant_id FK to every tenant-scoped model.

    Every query on a tenant-scoped model MUST filter by tenant_id.
    The middleware + dependency layer enforces this automatically.
    """

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class BaseModel(Base, TimestampMixin):
    """Abstract base with UUID PK and timestamps."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
        server_default=text("gen_random_uuid()"),
    )


class TenantBaseModel(BaseModel, TenantMixin):
    """Abstract base with UUID PK, timestamps, and tenant scoping."""

    __abstract__ = True
