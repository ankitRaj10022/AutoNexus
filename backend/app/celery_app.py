"""
Celery application instance.

Configured with Redis broker, JSON serializer, and production-safe defaults.
Import this module to register tasks or start workers.

Usage:
    celery -A app.celery_app.celery worker --loglevel=info
    celery -A app.celery_app.celery beat --loglevel=info
"""

from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery = Celery(
    "autonexus",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# ── Celery Configuration ─────────────────────────────────────
celery.conf.update(
    # Serialization — JSON only, never pickle (security)
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Reliability
    task_acks_late=True,               # ACK after completion, not receipt
    worker_prefetch_multiplier=1,      # Fair distribution across workers
    task_reject_on_worker_lost=True,   # Re-queue if worker crashes
    task_track_started=True,           # Track STARTED state

    # Performance
    worker_max_tasks_per_child=1000,   # Prevent memory leaks
    result_expires=86400,              # Results expire after 24h

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task routing — separate queues for different workloads
    task_routes={
        "app.workers.task_executor.execute_node": {"queue": "execution"},
        "app.workers.task_executor.execute_workflow": {"queue": "orchestration"},
        "app.workers.task_executor.schedule_check": {"queue": "scheduler"},
    },

    # Beat schedule (cron-based workflow scheduling)
    beat_schedule={
        "check-scheduled-workflows": {
            "task": "app.workers.task_executor.schedule_check",
            "schedule": 60.0,  # every minute
        },
    },

    # Task discovery
    include=[
        "app.workers.task_executor",
    ],
)
