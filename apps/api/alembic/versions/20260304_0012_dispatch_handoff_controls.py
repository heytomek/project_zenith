"""Add dispatch handoff control fields to plan assignments.

Revision ID: 20260304_0012
Revises: 20260304_0011
Create Date: 2026-03-04 23:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0012"
down_revision: str | None = "20260304_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "plan_assignments",
        sa.Column(
            "dispatch_handoff_status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "plan_assignments",
        sa.Column("dispatch_handoff_note", sa.Text(), nullable=True),
    )
    op.add_column(
        "plan_assignments",
        sa.Column("dispatch_handoff_actor_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "plan_assignments",
        sa.Column("dispatch_handoff_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plan_assignments", "dispatch_handoff_at")
    op.drop_column("plan_assignments", "dispatch_handoff_actor_name")
    op.drop_column("plan_assignments", "dispatch_handoff_note")
    op.drop_column("plan_assignments", "dispatch_handoff_status")
