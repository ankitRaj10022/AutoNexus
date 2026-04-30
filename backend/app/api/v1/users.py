"""
User management endpoints — CRUD within a tenant.

Admin-only for user creation and role management.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, CurrentTenant, DbSession, require_role
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserListResponse, UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(user: CurrentUser):
    return user


@router.get(
    "",
    response_model=UserListResponse,
    summary="List all users in workspace",
)
async def list_users(
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
):
    result = await db.execute(
        select(User)
        .where(User.tenant_id == tenant.id)
        .offset(skip)
        .limit(limit)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    total = count_result.scalar() or 0

    return UserListResponse(users=users, total=total)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user (admin only)",
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target_user, key, value)

    await db.flush()
    return target_user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a user (admin only)",
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
async def deactivate_user(
    user_id: uuid.UUID,
    user: CurrentUser,
    tenant: CurrentTenant,
    db: DbSession,
):
    if user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself",
        )

    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    target_user.is_active = False
    await db.flush()
