"""
Pydantic schemas for authentication endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Registration ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    workspace_name: str = Field(min_length=1, max_length=255)


class RegisterResponse(BaseModel):
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── Login ────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# ── Refresh ──────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    refresh_token: str
