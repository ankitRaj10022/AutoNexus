"""
FastAPI application factory.

Creates and configures the ASGI application with:
- Lifespan management (startup/shutdown)
- CORS middleware
- Router registration
- Prometheus instrumentation
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle — startup and shutdown hooks."""
    # ── Startup ──────────────────────────────────────────────
    logger.info(
        "starting_application",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
    )

    # Initialize Redis connection pool
    app.state.redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )

    # Verify Redis connectivity
    try:
        await app.state.redis.ping()
        logger.info("redis_connected", url=settings.REDIS_URL)
    except Exception as e:
        logger.error("redis_connection_failed", error=str(e))

    yield

    # ── Shutdown ─────────────────────────────────────────────
    logger.info("shutting_down_application")
    await app.state.redis.close()


def create_app() -> FastAPI:
    """Application factory — builds and returns the configured FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        description="Production-grade multi-tenant workflow automation platform",
        version="1.0.0",
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Prometheus Metrics ───────────────────────────────────
    if settings.PROMETHEUS_ENABLED:
        Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            excluded_handlers=["/health", "/ready", "/metrics"],
        ).instrument(app).expose(app, endpoint="/metrics")

    # ── Register Routers ─────────────────────────────────────
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """Import and register all API routers."""
    from app.api.v1 import auth, users, api_keys, workflows, webhooks, billing, health

    prefix = settings.API_V1_PREFIX

    app.include_router(health.router, tags=["Health"])
    app.include_router(auth.router, prefix=prefix, tags=["Authentication"])
    app.include_router(users.router, prefix=prefix, tags=["Users"])
    app.include_router(api_keys.router, prefix=prefix, tags=["API Keys"])
    app.include_router(workflows.router, prefix=prefix, tags=["Workflows"])
    app.include_router(webhooks.router, prefix=prefix, tags=["Webhooks"])
    app.include_router(billing.router, prefix=prefix, tags=["Billing"])

    # WebSocket routes
    from app.websockets import execution
    app.include_router(execution.router, tags=["WebSocket"])


# Create the application instance
app = create_app()
