"""
User model with RBAC roles.

Users belong to a workspace (tenant) and have one of three roles
that determine their access level within the platform.
"""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import Enum, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBaseModel

if TYPE_CHECKING:
    from app.models.tenant import Workspace
    from app.models.api_key import APIKey


class UserRole(str, enum.Enum):
    """Role-Based Access Control roles."""
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"


class User(TenantBaseModel):
    """
    Platform user scoped to a workspace.

    Roles:
    - Admin: Full access, user management, billing
    - Developer: Create/edit/execute workflows
    - Viewer: Read-only access to workflows and executions
    """

    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_tenant_email", "tenant_id", "email", unique=True),
    )

    email: Mapped[str] = mapped_column(
        String(320), nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.DEVELOPER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)

    # ── Relationships ────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="users"
    )
    api_keys: Mapped[List["APIKey"]] = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"
