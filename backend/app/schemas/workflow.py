"""
Pydantic schemas for workflow and execution endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.task import ExecutionStatus


# ── Workflow ─────────────────────────────────────────────────
class WorkflowCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    dag_definition: dict = Field(default_factory=lambda: {"nodes": [], "edges": []})
    trigger_type: str = "manual"
    schedule: str | None = None  # cron expression


class WorkflowUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    dag_definition: dict | None = None
    is_active: bool | None = None
    trigger_type: str | None = None
    schedule: str | None = None


class WorkflowResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    dag_definition: dict
    is_active: bool
    trigger_type: str
    schedule: str | None
    created_by: uuid.UUID | None
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowListResponse(BaseModel):
    workflows: list[WorkflowResponse]
    total: int


# ── Execution ────────────────────────────────────────────────
class ExecutionTriggerRequest(BaseModel):
    input_data: dict | None = None


class NodeExecutionResponse(BaseModel):
    id: uuid.UUID
    node_id: str
    node_type: str
    node_label: str
    status: ExecutionStatus
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    input_data: dict | None
    output_data: dict | None
    error: str | None

    model_config = {"from_attributes": True}


class WorkflowExecutionResponse(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    status: ExecutionStatus
    trigger_type: str
    triggered_by: uuid.UUID | None
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    input_data: dict | None
    output_data: dict | None
    error: str | None
    retry_count: int
    node_executions: list[NodeExecutionResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ExecutionListResponse(BaseModel):
    executions: list[WorkflowExecutionResponse]
    total: int
