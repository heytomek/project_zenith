"""Add dispatch queue templates and role-gated apply controls.

Revision ID: 20260304_0014
Revises: 20260304_0013
Create Date: 2026-03-05 00:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0014"
down_revision: str | None = "20260304_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_dispatch_queue_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("assignment_statuses", sa.JSON(), nullable=False),
        sa.Column("execution_statuses", sa.JSON(), nullable=False),
        sa.Column("handoff_statuses", sa.JSON(), nullable=False),
        sa.Column("source_kinds", sa.JSON(), nullable=False),
        sa.Column("canned_handoff_status", sa.String(length=32), nullable=True),
        sa.Column("allowed_role_codes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_plan_dispatch_queue_templates_organization_id_name",
        ),
    )

    with op.batch_alter_table("plan_dispatch_queues", schema=None) as batch_op:
        batch_op.add_column(sa.Column("queue_template_id", sa.UUID(), nullable=True))
        batch_op.add_column(
            sa.Column("allowed_role_codes", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.create_foreign_key(
            "fk_plan_dispatch_queues_queue_template_id",
            "plan_dispatch_queue_templates",
            ["queue_template_id"],
            ["id"],
        )
def downgrade() -> None:
    with op.batch_alter_table("plan_dispatch_queues", schema=None) as batch_op:
        batch_op.drop_constraint("fk_plan_dispatch_queues_queue_template_id", type_="foreignkey")
        batch_op.drop_column("allowed_role_codes")
        batch_op.drop_column("queue_template_id")
    op.drop_table("plan_dispatch_queue_templates")
