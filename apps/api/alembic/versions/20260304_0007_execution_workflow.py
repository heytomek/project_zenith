"""Add plan assignment persistence and run review/publication state.

Revision ID: 20260304_0007
Revises: 20260304_0006
Create Date: 2026-03-04 10:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0007"
down_revision: str | None = "20260304_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("plan_runs", recreate="always") as batch_op:
        batch_op.add_column(
            sa.Column("review_status", sa.String(length=32), nullable=False, server_default="draft")
        )
        batch_op.add_column(
            sa.Column(
                "publication_status",
                sa.String(length=32),
                nullable=False,
                server_default="draft",
            )
        )
        batch_op.add_column(sa.Column("approval_note", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("approved_by_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("published_by_name", sa.String(length=255), nullable=True))

    op.create_table(
        "plan_assignments",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_run_id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("worker_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("assignment_status", sa.String(length=32), nullable=False),
        sa.Column("source_kind", sa.String(length=32), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("matched_skill_codes", sa.JSON(), nullable=False),
        sa.Column("matched_certification_codes", sa.JSON(), nullable=False),
        sa.Column("reserved_material_quantities", sa.JSON(), nullable=False),
        sa.Column("reserved_equipment_ids", sa.JSON(), nullable=False),
        sa.Column("scheduled_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("override_note", sa.Text(), nullable=True),
        sa.Column("override_actor_name", sa.String(length=255), nullable=True),
        sa.Column("overridden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_assignments_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_run_id"],
            ["plan_runs.id"],
            name=op.f("fk_plan_assignments_plan_run_id_plan_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_plan_assignments_work_order_id_work_orders"),
        ),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["workers.id"],
            name=op.f("fk_plan_assignments_worker_id_workers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_assignments")),
        sa.UniqueConstraint(
            "plan_run_id",
            "work_order_id",
            name="uq_plan_assignments_plan_run_id_work_order_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("plan_assignments")

    with op.batch_alter_table("plan_runs", recreate="always") as batch_op:
        batch_op.drop_column("published_by_name")
        batch_op.drop_column("published_at")
        batch_op.drop_column("approved_by_name")
        batch_op.drop_column("approved_at")
        batch_op.drop_column("approval_note")
        batch_op.drop_column("publication_status")
        batch_op.drop_column("review_status")
