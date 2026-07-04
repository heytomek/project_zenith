"""Add persistent worker, material, and equipment reservations.

Revision ID: 20260304_0009
Revises: 20260304_0008
Create Date: 2026-03-04 18:15:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0009"
down_revision: str | None = "20260304_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_worker_reservations",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_run_id", sa.Uuid(), nullable=False),
        sa.Column("plan_assignment_id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("reserved_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reserved_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_worker_reservations_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_run_id"],
            ["plan_runs.id"],
            name=op.f("fk_plan_worker_reservations_plan_run_id_plan_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_assignment_id"],
            ["plan_assignments.id"],
            name=op.f("fk_plan_worker_reservations_plan_assignment_id_plan_assignments"),
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_plan_worker_reservations_work_order_id_work_orders"),
        ),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["workers.id"],
            name=op.f("fk_plan_worker_reservations_worker_id_workers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_worker_reservations")),
    )

    op.create_table(
        "plan_material_reservations",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_run_id", sa.Uuid(), nullable=False),
        sa.Column("plan_assignment_id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("material_id", sa.Uuid(), nullable=False),
        sa.Column("inventory_position_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_material_reservations_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_run_id"],
            ["plan_runs.id"],
            name=op.f("fk_plan_material_reservations_plan_run_id_plan_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_assignment_id"],
            ["plan_assignments.id"],
            name=op.f("fk_plan_material_reservations_plan_assignment_id_plan_assignments"),
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_plan_material_reservations_work_order_id_work_orders"),
        ),
        sa.ForeignKeyConstraint(
            ["material_id"],
            ["materials.id"],
            name=op.f("fk_plan_material_reservations_material_id_materials"),
        ),
        sa.ForeignKeyConstraint(
            ["inventory_position_id"],
            ["inventory_positions.id"],
            name=op.f("fk_plan_material_reservations_inventory_position_id_inventory_positions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_material_reservations")),
    )

    op.create_table(
        "plan_equipment_reservations",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_run_id", sa.Uuid(), nullable=False),
        sa.Column("plan_assignment_id", sa.Uuid(), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("reserved_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reserved_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_plan_equipment_reservations_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_run_id"],
            ["plan_runs.id"],
            name=op.f("fk_plan_equipment_reservations_plan_run_id_plan_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_assignment_id"],
            ["plan_assignments.id"],
            name=op.f("fk_plan_equipment_reservations_plan_assignment_id_plan_assignments"),
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_plan_equipment_reservations_work_order_id_work_orders"),
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.id"],
            name=op.f("fk_plan_equipment_reservations_equipment_id_equipment"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_equipment_reservations")),
    )


def downgrade() -> None:
    op.drop_table("plan_equipment_reservations")
    op.drop_table("plan_material_reservations")
    op.drop_table("plan_worker_reservations")
