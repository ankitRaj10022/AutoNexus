"""
Task execution models — workflow runs and individual node executions.

WorkflowExecution tracks an entire workflow run.
NodeExecution tracks each individual node within a run.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Float, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List

from app.models.base import TenantBaseModel

if TYPE_CHECKING:
    from app.models.workflow import Workflow


class ExecutionStatus(str, enum.Enum):
    """Execution lifecycle states."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class WorkflowExecution(TenantBaseModel):
    """
    Represents a single execution run of a workflow.

    Tracks overall status, timing, and contains child node executions.
    """

    __tablename__ = "workflow_executions"
    __table_args__ = (
        Index("ix_wf_exec_tenant_status", "tenant_id", "status"),
        Index("ix_wf_exec_tenant_created", "tenant_id", "created_at"),
        Index("ix_wf_exec_workflow", "workflow_id", "created_at"),
    )

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus),
        default=ExecutionStatus.PENDING,
        nullable=False,
        index=True,
    )
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # user_id or null for automated

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    # Input parameters for this execution
    input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Final output / result
    output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Error info if failed
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Retry tracking
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # ── Relationships ────────────────────────────────────────
    workflow: Mapped["Workflow"] = relationship(
        "Workflow", back_populates="executions"
    )
    node_executions: Mapped[List["NodeExecution"]] = relationship(
        "NodeExecution",
        back_populates="workflow_execution",
        cascade="all, delete-orphan",
        order_by="NodeExecution.started_at",
    )

    def __repr__(self) -> str:
        return f"<WorkflowExecution {self.id} ({self.status.value})>"


class NodeExecution(TenantBaseModel):
    """
    Tracks execution of a single node within a workflow run.

    Each node in the DAG gets its own NodeExecution record with
    independent status tracking, timing, and result storage.
    """

    __tablename__ = "node_executions"
    __table_args__ = (
        Index("ix_node_exec_wf_exec", "workflow_execution_id"),
        Index("ix_node_exec_tenant_status", "tenant_id", "status"),
    )

    workflow_execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False,
    )
    node_id: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # Matches the node ID in dag_definition
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    node_label: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus),
        default=ExecutionStatus.PENDING,
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    # Input received from upstream nodes
    input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Output produced by this node
    output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Error details
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Celery task ID for tracking
    celery_task_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    # Worker that executed this node
    worker_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relationships ────────────────────────────────────────
    workflow_execution: Mapped["WorkflowExecution"] = relationship(
        "WorkflowExecution", back_populates="node_executions"
    )

    def __repr__(self) -> str:
        return f"<NodeExecution {self.node_id} ({self.status.value})>"
