"""
Billing service — usage tracking, plan enforcement, Stripe integration.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.subscription import UsageRecord
from app.models.tenant import Workspace

class BillingService:
    PLAN_FEATURES = {
        "free": ["basic_workflows", "manual_triggers", "5_workflows"],
        "pro": ["advanced_workflows", "cron_triggers", "webhooks", "api_keys", "50_workflows", "priority_support"],
        "enterprise": ["unlimited_workflows", "custom_integrations", "sla", "dedicated_support", "sso"],
    }

    @staticmethod
    async def get_usage_summary(db: AsyncSession, tenant_id: uuid.UUID, plan: str) -> dict:
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        result = await db.execute(
            select(func.coalesce(func.sum(UsageRecord.value), 0))
            .where(UsageRecord.tenant_id == tenant_id,
                   UsageRecord.metric_name == "task_executions",
                   UsageRecord.recorded_at >= period_start))
        task_count = int(result.scalar() or 0)

        compute_result = await db.execute(
            select(func.coalesce(func.sum(UsageRecord.value), 0))
            .where(UsageRecord.tenant_id == tenant_id,
                   UsageRecord.metric_name == "compute_seconds",
                   UsageRecord.recorded_at >= period_start))
        compute_seconds = float(compute_result.scalar() or 0)

        api_result = await db.execute(
            select(func.coalesce(func.sum(UsageRecord.value), 0))
            .where(UsageRecord.tenant_id == tenant_id,
                   UsageRecord.metric_name == "api_calls",
                   UsageRecord.recorded_at >= period_start))
        api_calls = int(api_result.scalar() or 0)

        return {
            "tenant_id": tenant_id, "plan": plan,
            "period_start": period_start, "period_end": None,
            "task_executions": task_count,
            "task_limit": settings.get_plan_task_limit(plan),
            "compute_seconds": compute_seconds, "api_calls": api_calls,
        }

    @staticmethod
    async def check_limit(db: AsyncSession, tenant_id: uuid.UUID, plan: str) -> bool:
        limit = settings.get_plan_task_limit(plan)
        if limit == -1:
            return True
        summary = await BillingService.get_usage_summary(db, tenant_id, plan)
        return summary["task_executions"] < limit

    @staticmethod
    async def record_usage(db: AsyncSession, tenant_id: uuid.UUID,
        metric_name: str, value: float, execution_id: uuid.UUID | None = None):
        record = UsageRecord(tenant_id=tenant_id, metric_name=metric_name,
            value=value, recorded_at=datetime.now(timezone.utc),
            workflow_execution_id=execution_id)
        db.add(record)
        await db.flush()
