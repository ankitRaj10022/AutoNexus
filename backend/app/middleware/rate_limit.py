"""
Redis-based sliding window rate limiter per tenant.
"""
from __future__ import annotations
import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from app.core.config import settings

class RateLimitMiddleware(BaseHTTPMiddleware):
    SKIP_PATHS = {"/health", "/ready", "/metrics"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Extract tenant info from JWT for rate limiting
        tenant_id = "anonymous"
        plan = "free"
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                from app.core.security import decode_access_token
                payload = decode_access_token(auth[7:])
                tenant_id = payload.get("tenant_id", "anonymous")
            except Exception:
                pass

        limit = settings.get_rate_limit(plan)
        key = f"ratelimit:{tenant_id}:{int(time.time()) // 60}"

        try:
            redis_client = request.app.state.redis
            current = await redis_client.incr(key)
            if current == 1:
                await redis_client.expire(key, 60)
            if current > limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                    headers={"Retry-After": "60", "X-RateLimit-Limit": str(limit)})
        except Exception:
            pass  # fail open if Redis is unavailable

        response = await call_next(request)
        return response
