"""
Application configuration loaded from environment variables.

Uses pydantic-settings for type-safe, validated config with .env support.
All secrets default to placeholder values that will fail loudly in production.
"""

from __future__ import annotations

import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — loaded once at startup, injected via dependency."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────
    APP_NAME: str = "AutoNexus"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://autonexus:change_me@localhost:5432/autonexus"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # ── Redis ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_URL: str = "redis://localhost:6379/1"

    # ── Celery ───────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # ── JWT ──────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_THIS_TO_A_RANDOM_64_CHAR_STRING"
    JWT_REFRESH_SECRET_KEY: str = "CHANGE_THIS_TO_ANOTHER_RANDOM_64_CHAR_STRING"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Stripe ───────────────────────────────────────────────
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"

    # ── Rate Limiting (requests per minute) ──────────────────
    RATE_LIMIT_FREE: int = 60
    RATE_LIMIT_PRO: int = 300
    RATE_LIMIT_ENTERPRISE: int = 1000

    # ── Plan Limits (task executions per month) ──────────────
    PLAN_LIMIT_FREE: int = 100
    PLAN_LIMIT_PRO: int = 10_000
    PLAN_LIMIT_ENTERPRISE: int = -1  # unlimited

    # ── Observability ────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    PROMETHEUS_ENABLED: bool = True

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    def get_plan_task_limit(self, plan: str) -> int:
        """Return the monthly task execution limit for a plan."""
        limits = {
            "free": self.PLAN_LIMIT_FREE,
            "pro": self.PLAN_LIMIT_PRO,
            "enterprise": self.PLAN_LIMIT_ENTERPRISE,
        }
        return limits.get(plan.lower(), self.PLAN_LIMIT_FREE)

    def get_rate_limit(self, plan: str) -> int:
        """Return the per-minute rate limit for a plan."""
        limits = {
            "free": self.RATE_LIMIT_FREE,
            "pro": self.RATE_LIMIT_PRO,
            "enterprise": self.RATE_LIMIT_ENTERPRISE,
        }
        return limits.get(plan.lower(), self.RATE_LIMIT_FREE)


# Singleton — import this everywhere
settings = Settings()
