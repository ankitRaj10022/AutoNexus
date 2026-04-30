"""
Authentication endpoints — register, login, refresh, logout.

Registration creates both a workspace (tenant) and the first admin user.
"""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, HTTPException, status
from jose import JWTError
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.tenant import PlanType, Workspace
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth")


def _slugify(name: str) -> str:
    """Convert workspace name to URL-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", name.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug[:100]


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new workspace and admin user",
)
async def register(payload: RegisterRequest, db: DbSession):
    # Check if email already exists globally
    existing = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create workspace
    slug = _slugify(payload.workspace_name)
    # Ensure unique slug
    slug_check = await db.execute(
        select(Workspace).where(Workspace.slug == slug)
    )
    if slug_check.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    workspace = Workspace(
        name=payload.workspace_name,
        slug=slug,
        plan=PlanType.FREE,
    )
    db.add(workspace)
    await db.flush()  # get workspace.id

    # Create admin user
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.ADMIN,
        tenant_id=workspace.id,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access_token = create_access_token(user.id, workspace.id, user.role.value)
    refresh_token = create_refresh_token(user.id, workspace.id)

    return RegisterResponse(
        user_id=user.id,
        workspace_id=workspace.id,
        email=user.email,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens",
)
async def login(payload: LoginRequest, db: DbSession):
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id, user.tenant_id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.tenant_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token using refresh token",
)
async def refresh(payload: RefreshRequest, db: DbSession):
    try:
        token_data = decode_refresh_token(payload.refresh_token)
        if token_data.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = uuid.UUID(token_data["sub"])
        tenant_id = uuid.UUID(token_data["tenant_id"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Verify user still exists and is active
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
            detail="User not found",
        )

    access_token = create_access_token(user.id, user.tenant_id, user.role.value)
    new_refresh_token = create_refresh_token(user.id, user.tenant_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", summary="Logout (client-side token discard)")
async def logout(user: CurrentUser):
    """
    Logout endpoint. With stateless JWT, the client discards the tokens.
    For production, implement a token blacklist in Redis.
    """
    return {"message": "Successfully logged out"}
