"""Add execution events and assignment actuals fields.

Revision ID: 20260304_0008
Revises: 20260304_0007
Create Date: 2026-03-04 11:25:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0008"
down_revision: str | None = "20260304_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("plan_assignments", recreate="always") as batch_op:
        batch_op.add_column(
            sa.Column(
                "execution_status",
                sa.String(length=32),
                nullable=False,
                server_default="not_started",
            )
        )
        batch_op.add_column(sa.Column("actual_start_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("actual_end_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("actual_duration_minutes", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("latest_execution_event_at", sa.DateTime(timezone=True), nullable=True)
        )

    op.create_table(
        "plan_assignment_events",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_run_id", sa.Uuid(), nullable=False),
        sa.Column("plan_assignment_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_name", sa.String(length=255), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_assignment_events_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_assignment_id"],
            ["plan_assignments.id"],
            name=op.f("fk_plan_assignment_events_plan_assignment_id_plan_assignments"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_run_id"],
            ["plan_runs.id"],
            name=op.f("fk_plan_assignment_events_plan_run_id_plan_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_assignment_events")),
    )


def downgrade() -> None:
    op.drop_table("plan_assignment_events")

    with op.batch_alter_table("plan_assignments", recreate="always") as batch_op:
        batch_op.drop_column("latest_execution_event_at")
        batch_op.drop_column("actual_duration_minutes")
        batch_op.drop_column("actual_end_at")
        batch_op.drop_column("actual_start_at")
        batch_op.drop_column("execution_status")
