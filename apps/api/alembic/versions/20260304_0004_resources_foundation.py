"""Add materials, inventory, and equipment tables.

Revision ID: 20260304_0004
Revises: 20260304_0003
Create Date: 2026-03-04 02:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0004"
down_revision: str | None = "20260304_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit_of_measure", sa.String(length=32), nullable=False),
        sa.Column("material_type", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_materials_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_materials")),
        sa.UniqueConstraint("organization_id", "sku", name="uq_materials_organization_id_sku"),
    )
    op.create_table(
        "equipment_types",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_equipment_types_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment_types")),
        sa.UniqueConstraint("organization_id", "code", name="uq_equipment_types_organization_id_code"),
    )
    op.create_table(
        "inventory_positions",
        sa.Column("material_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("on_hand_quantity", sa.Integer(), nullable=False),
        sa.Column("reserved_quantity", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
            name=op.f("fk_inventory_positions_location_id_locations"),
        ),
        sa.ForeignKeyConstraint(
            ["material_id"],
            ["materials.id"],
            name=op.f("fk_inventory_positions_material_id_materials"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_positions")),
        sa.UniqueConstraint("material_id", "location_id", name="uq_inventory_positions_material_id_location_id"),
    )
    op.create_table(
        "equipment",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("equipment_type_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("equipment_code", sa.String(length=64), nullable=False),
        sa.Column("serial_number", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["equipment_type_id"],
            ["equipment_types.id"],
            name=op.f("fk_equipment_equipment_type_id_equipment_types"),
        ),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
            name=op.f("fk_equipment_location_id_locations"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_equipment_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment")),
        sa.UniqueConstraint("organization_id", "equipment_code", name="uq_equipment_organization_id_equipment_code"),
    )
    op.create_table(
        "equipment_availability_calendars",
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.id"],
            name=op.f("fk_equipment_availability_calendars_equipment_id_equipment"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment_availability_calendars")),
    )
    op.create_table(
        "equipment_availability_windows",
        sa.Column("calendar_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("availability_type", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["calendar_id"],
            ["equipment_availability_calendars.id"],
            name=op.f("fk_equipment_availability_windows_calendar_id_equipment_availability_calendars"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment_availability_windows")),
    )


def downgrade() -> None:
    op.drop_table("equipment_availability_windows")
    op.drop_table("equipment_availability_calendars")
    op.drop_table("equipment")
    op.drop_table("inventory_positions")
    op.drop_table("equipment_types")
    op.drop_table("materials")
