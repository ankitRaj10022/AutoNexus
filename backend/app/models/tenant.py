"""
Workspace (tenant) model.

Each workspace represents an isolated tenant. All data in the system
is scoped to a workspace via tenant_id foreign keys.
"""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.subscription import Subscription


class PlanType(str, enum.Enum):
    """Subscription plan tiers."""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Workspace(BaseModel):
    """
    A workspace is the top-level tenant container.

    All users, workflows, executions, and billing data belong to a workspace.
    """

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[PlanType] = mapped_column(
        Enum(PlanType), default=PlanType.FREE, nullable=False
    )
    settings: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Stripe customer ID for billing
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )

    # ── Relationships ────────────────────────────────────────
    users: Mapped[List["User"]] = relationship(
        "User", back_populates="workspace", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        "Subscription", back_populates="workspace", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workspace {self.slug} ({self.plan.value})>"
