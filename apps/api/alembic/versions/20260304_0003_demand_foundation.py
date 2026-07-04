"""Add demand and work-definition tables.

Revision ID: 20260304_0003
Revises: 20260304_0002
Create Date: 2026-03-04 01:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0003"
down_revision: str | None = "20260304_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_level_policies",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("target_minutes", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_service_level_policies_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service_level_policies")),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_service_level_policies_organization_id_name",
        ),
    )
    op.create_table(
        "work_orders",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("planning_unit_id", sa.Uuid(), nullable=True),
        sa.Column("service_level_policy_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("requested_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
            name=op.f("fk_work_orders_location_id_locations"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_work_orders_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["planning_unit_id"],
            ["planning_units.id"],
            name=op.f("fk_work_orders_planning_unit_id_planning_units"),
        ),
        sa.ForeignKeyConstraint(
            ["service_level_policy_id"],
            ["service_level_policies.id"],
            name=op.f("fk_work_orders_service_level_policy_id_service_level_policies"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_work_orders")),
    )
    op.create_table(
        "work_order_dependencies",
        sa.Column("predecessor_work_order_id", sa.Uuid(), nullable=False),
        sa.Column("successor_work_order_id", sa.Uuid(), nullable=False),
        sa.Column("dependency_type", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["predecessor_work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_work_order_dependencies_predecessor_work_order_id_work_orders"),
        ),
        sa.ForeignKeyConstraint(
            ["successor_work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_work_order_dependencies_successor_work_order_id_work_orders"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_work_order_dependencies")),
        sa.UniqueConstraint(
            "predecessor_work_order_id",
            "successor_work_order_id",
            name="uq_work_order_dependencies_predecessor_successor",
        ),
    )
    op.create_table(
        "work_requirements",
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("requirement_type", sa.String(length=64), nullable=False),
        sa.Column("reference_id", sa.Uuid(), nullable=True),
        sa.Column("min_level", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_orders.id"],
            name=op.f("fk_work_requirements_work_order_id_work_orders"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_work_requirements")),
    )


def downgrade() -> None:
    op.drop_table("work_requirements")
    op.drop_table("work_order_dependencies")
    op.drop_table("work_orders")
    op.drop_table("service_level_policies")
