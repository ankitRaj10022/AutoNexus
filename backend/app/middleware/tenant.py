"""
Tenant-aware middleware.

Sets the current tenant_id in contextvars so that all downstream
code (services, queries) can access it without explicit parameter passing.
"""

from __future__ import annotations

import contextvars
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# ── Context Variable ─────────────────────────────────────────
_tenant_id_ctx: contextvars.ContextVar[uuid.UUID | None] = contextvars.ContextVar(
    "tenant_id", default=None
)
_request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def get_tenant_id_from_context() -> uuid.UUID | None:
    """Get the current request's tenant_id from context."""
    return _tenant_id_ctx.get()


def get_request_id_from_context() -> str | None:
    """Get the current request's correlation ID from context."""
    return _request_id_ctx.get()


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts tenant_id from the JWT token in the
    Authorization header and sets it in contextvars.

    Skips tenant extraction for public endpoints (health, auth, docs).
    """

    SKIP_PATHS = {
        "/health",
        "/ready",
        "/metrics",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
    }

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Generate request ID for correlation
        request_id = request.headers.get(
            "X-Request-ID", str(uuid.uuid4())
        )
        _request_id_ctx.set(request_id)

        # Skip tenant extraction for public endpoints
        if request.url.path in self.SKIP_PATHS:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

        # Extract tenant_id from JWT if present
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_access_token

                token = auth_header[7:]
                payload = decode_access_token(token)
                tenant_id = uuid.UUID(payload.get("tenant_id", ""))
                _tenant_id_ctx.set(tenant_id)
            except Exception:
                # Let the route-level dependency handle auth errors
                pass

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
