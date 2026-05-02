"""Initial migration

Revision ID: 693f87a99268
Revises: 2b916250b761
Create Date: 2026-04-30 08:47:07.903893
"""

from typing import Sequence


revision: str = "693f87a99268"
down_revision: str | None = "2b916250b761"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
