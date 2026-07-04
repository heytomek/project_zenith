"""Add persisted planning scenarios and plan runs.

Revision ID: 20260304_0005
Revises: 20260304_0004
Create Date: 2026-03-04 05:15:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0005"
down_revision: str | None = "20260304_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_scenarios",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("planning_request", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_scenarios_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_scenarios")),
        sa.UniqueConstraint("organization_id", "name", name="uq_plan_scenarios_organization_id_name"),
    )
    op.create_table(
        "plan_runs",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=True),
        sa.Column("scenario_name", sa.String(length=255), nullable=False),
        sa.Column("run_kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("planning_request", sa.JSON(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_runs_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["plan_scenarios.id"],
            name=op.f("fk_plan_runs_scenario_id_plan_scenarios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_runs")),
    )


def downgrade() -> None:
    op.drop_table("plan_runs")
    op.drop_table("plan_scenarios")
