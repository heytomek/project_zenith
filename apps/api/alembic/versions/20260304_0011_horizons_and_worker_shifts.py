"""Add planning horizons and worker shift/break templates.

Revision ID: 20260304_0011
Revises: 20260304_0010
Create Date: 2026-03-04 22:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0011"
down_revision: str | None = "20260304_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planning_horizons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_planning_horizons_organization_id_name",
        ),
    )

    op.create_table(
        "worker_shift_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("worker_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_minute_local", sa.Integer(), nullable=False),
        sa.Column("end_minute_local", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "worker_id",
            "name",
            "day_of_week",
            name="uq_worker_shift_templates_worker_id_name_day",
        ),
    )

    op.create_table(
        "worker_shift_break_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("shift_template_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("start_minute_local", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shift_template_id"], ["worker_shift_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "shift_template_id",
            "name",
            "start_minute_local",
            name="uq_worker_shift_break_rules_template_name_start",
        ),
    )


def downgrade() -> None:
    op.drop_table("worker_shift_break_rules")
    op.drop_table("worker_shift_templates")
    op.drop_table("planning_horizons")
