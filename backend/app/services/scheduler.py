"""
Scheduler service to inspect time-based workflows.
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.workflow import Workflow

logger = structlog.get_logger()


async def poll_scheduled_workflows() -> int:
    """Return the number of active cron workflows visible to the scheduler."""
    logger.info(
        "polling_scheduled_workflows",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    async with async_session_factory() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.is_active.is_(True),
                Workflow.schedule.isnot(None),
                Workflow.trigger_type == "cron",
            )
        )
        workflows = result.scalars().all()
        logger.info("scheduled_workflows_polled", count=len(workflows))
        return len(workflows)
