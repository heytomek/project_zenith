"""Add saved dispatch queue definitions.

Revision ID: 20260304_0013
Revises: 20260304_0012
Create Date: 2026-03-04 23:55:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0013"
down_revision: str | None = "20260304_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_dispatch_queues",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("plan_run_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("assignment_statuses", sa.JSON(), nullable=False),
        sa.Column("execution_statuses", sa.JSON(), nullable=False),
        sa.Column("handoff_statuses", sa.JSON(), nullable=False),
        sa.Column("source_kinds", sa.JSON(), nullable=False),
        sa.Column("canned_handoff_status", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["plan_run_id"], ["plan_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_run_id", "name", name="uq_plan_dispatch_queues_plan_run_id_name"),
    )


def downgrade() -> None:
    op.drop_table("plan_dispatch_queues")
