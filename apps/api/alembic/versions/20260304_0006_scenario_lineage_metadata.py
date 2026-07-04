"""Add scenario metadata and lineage fields.

Revision ID: 20260304_0006
Revises: 20260304_0005
Create Date: 2026-03-04 08:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0006"
down_revision: str | None = "20260304_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("plan_scenarios", recreate="always") as batch_op:
        batch_op.add_column(sa.Column("base_scenario_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("source_run_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "scenario_type",
                sa.String(length=32),
                nullable=False,
                server_default="manual",
            )
        )
        batch_op.add_column(
            sa.Column(
                "labels",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.create_foreign_key(
            op.f("fk_plan_scenarios_base_scenario_id_plan_scenarios"),
            "plan_scenarios",
            ["base_scenario_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            op.f("fk_plan_scenarios_source_run_id_plan_runs"),
            "plan_runs",
            ["source_run_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("plan_scenarios", recreate="always") as batch_op:
        batch_op.drop_constraint(
            op.f("fk_plan_scenarios_source_run_id_plan_runs"),
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            op.f("fk_plan_scenarios_base_scenario_id_plan_scenarios"),
            type_="foreignkey",
        )
        batch_op.drop_column("labels")
        batch_op.drop_column("scenario_type")
        batch_op.drop_column("notes")
        batch_op.drop_column("source_run_id")
        batch_op.drop_column("base_scenario_id")
