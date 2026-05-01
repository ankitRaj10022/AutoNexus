"""
Subscription and usage tracking models.

Tracks tenant billing state, Stripe subscriptions, and per-tenant
usage metrics for enforcing plan limits.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.models.base import TenantBaseModel

if TYPE_CHECKING:
    from app.models.tenant import Workspace


class SubscriptionStatus(str, enum.Enum):
    """Stripe-aligned subscription states."""
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    TRIALING = "trialing"
    INCOMPLETE = "incomplete"


class Subscription(TenantBaseModel):
    """
    Maps a workspace to a Stripe subscription.

    One active subscription per workspace at a time.
    History is preserved — cancelled subscriptions remain in the table.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_tenant_status", "tenant_id", "status"),
        Index("ix_subscriptions_stripe_id", "stripe_subscription_id"),
    )

    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus),
        default=SubscriptionStatus.ACTIVE,
        nullable=False,
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    stripe_price_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="subscriptions"
    )

    def __repr__(self) -> str:
        return f"<Subscription {self.plan} ({self.status.value})>"


class UsageRecord(TenantBaseModel):
    """
    Per-tenant usage metric record.

    Tracks task executions, compute time, API calls, etc.
    Aggregated for billing enforcement and dashboard display.
    """

    __tablename__ = "usage_records"
    __table_args__ = (
        Index("ix_usage_tenant_metric_date", "tenant_id", "metric_name", "recorded_at"),
    )

    metric_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "task_executions", "compute_seconds", "api_calls"
    value: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Optional: link to specific execution
    workflow_execution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<UsageRecord {self.metric_name}={self.value}>"
