"""Add crew metadata and planner metrics to plan assignments.

Revision ID: 20260304_0010
Revises: 20260304_0009
Create Date: 2026-03-04 20:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0010"
down_revision: str | None = "20260304_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "plan_assignments",
        sa.Column(
            "crew_worker_ids",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        "plan_assignments",
        sa.Column(
            "crew_worker_names",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        "plan_assignments",
        sa.Column(
            "crew_size_required",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "plan_assignments",
        sa.Column(
            "estimated_travel_minutes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "plan_assignments",
        sa.Column(
            "estimated_overtime_minutes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

def downgrade() -> None:
    op.drop_column("plan_assignments", "estimated_overtime_minutes")
    op.drop_column("plan_assignments", "estimated_travel_minutes")
    op.drop_column("plan_assignments", "crew_size_required")
    op.drop_column("plan_assignments", "crew_worker_names")
    op.drop_column("plan_assignments", "crew_worker_ids")
