"""
FastAPI dependency injection — auth, tenant scoping, role enforcement.

These dependencies are composed into route handlers to enforce
authentication, tenant isolation, and RBAC in a declarative way.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token, verify_api_key
from app.models.api_key import APIKey
from app.models.user import User, UserRole
from app.models.tenant import Workspace

# ── Security Scheme ──────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ── Get Current User ─────────────────────────────────────────
async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Extract and validate user from JWT Bearer token.
    Raises 401 if token is missing, invalid, or user not found.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tenant_id"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from DB (validates user still exists and is active)
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return user


# ── Get Current Tenant ───────────────────────────────────────
async def get_current_tenant(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workspace:
    """Resolve the workspace (tenant) for the authenticated user."""
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == user.tenant_id,
            Workspace.is_active.is_(True),
        )
    )
    workspace = result.scalar_one_or_none()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or disabled",
        )

    return workspace


# ── Role Enforcement ─────────────────────────────────────────
def require_role(*roles: UserRole):
    """
    Dependency factory that enforces role-based access.

    Usage:
        @router.post("/users", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """

    async def _check_role(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in roles)}",
            )
        return user

    return _check_role


# ── API Key Authentication ───────────────────────────────────
async def get_api_key_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Authenticate via X-API-Key header.
    Used for webhook triggers and programmatic access.
    """
    api_key_raw = request.headers.get("X-API-Key")
    if not api_key_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-API-Key header)",
        )

    # Find all active keys and check hash
    import hashlib
    key_hash = hashlib.sha256(api_key_raw.encode()).hexdigest()

    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active.is_(True),
        )
    )
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    # Check expiration
    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
        )

    # Update last used timestamp
    api_key.last_used_at = datetime.now(timezone.utc)
    await db.flush()

    # Fetch the key's owner
    result = await db.execute(
        select(User).where(User.id == api_key.user_id, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key owner not found",
        )

    return user


# ── Convenience Type Aliases ─────────────────────────────────
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTenant = Annotated[Workspace, Depends(get_current_tenant)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
