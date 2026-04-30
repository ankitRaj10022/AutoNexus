"""
Health check endpoints for Kubernetes liveness and readiness probes.
"""
from __future__ import annotations
from fastapi import APIRouter, Request
from sqlalchemy import text
from app.core.database import async_session_factory

router = APIRouter()

@router.get("/health", summary="Liveness probe")
async def health():
    return {"status": "healthy", "service": "autonexus-api"}

@router.get("/ready", summary="Readiness probe")
async def ready(request: Request):
    checks = {"database": False, "redis": False}
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = True
    except Exception:
        pass
    try:
        await request.app.state.redis.ping()
        checks["redis"] = True
    except Exception:
        pass
    all_ready = all(checks.values())
    return {"status": "ready" if all_ready else "degraded", "checks": checks}
