"""
Workflow model — stores DAG definitions as JSON.

A workflow is a directed acyclic graph of task nodes connected by edges.
The DAG definition is stored as JSONB for flexible schema evolution.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBaseModel

if TYPE_CHECKING:
    from app.models.task import WorkflowExecution


class Workflow(TenantBaseModel):
    """
    A workflow is a reusable automation pipeline defined as a DAG.

    dag_definition schema:
    {
        "nodes": [
            {
                "id": "node_1",
                "type": "trigger|action|condition|output",
                "label": "Send Email",
                "config": { ... },
                "position": {"x": 100, "y": 200}
            }
        ],
        "edges": [
            {
                "id": "edge_1",
                "source": "node_1",
                "target": "node_2",
                "condition": null
            }
        ]
    }
    """

    __tablename__ = "workflows"
    __table_args__ = (
        Index("ix_workflows_tenant_active", "tenant_id", "is_active"),
        Index("ix_workflows_tenant_name", "tenant_id", "name"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dag_definition: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"nodes": [], "edges": []}, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Cron schedule (null = manual/webhook only)
    schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Trigger configuration
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )  # manual, cron, webhook, api

    # Webhook secret for webhook-triggered workflows
    webhook_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Creator
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ────────────────────────────────────────
    executions: Mapped[List["WorkflowExecution"]] = relationship(
        "WorkflowExecution",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowExecution.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Workflow {self.name} (trigger={self.trigger_type})>"
