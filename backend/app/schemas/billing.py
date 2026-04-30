"""
Pydantic schemas for billing and subscription endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class UsageSummaryResponse(BaseModel):
    tenant_id: uuid.UUID
    plan: str
    period_start: datetime | None
    period_end: datetime | None
    task_executions: int
    task_limit: int
    compute_seconds: float
    api_calls: int


class PlanResponse(BaseModel):
    plan: str
    task_limit: int
    rate_limit: int
    features: list[str]


class SubscribeRequest(BaseModel):
    plan: str  # "pro" or "enterprise"
    payment_method_id: str | None = None  # Stripe payment method


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: str
    status: str
    current_period_start: datetime | None
    current_period_end: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
