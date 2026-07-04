"""Initial organization and identity foundation.

Revision ID: 20260304_0001
Revises:
Create Date: 2026-03-04 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260304_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("organization_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
        sa.UniqueConstraint("slug", name=op.f("uq_organizations_slug")),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
        sa.UniqueConstraint("code", name=op.f("uq_roles_code")),
    )
    op.create_table(
        "locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("location_type", sa.String(length=50), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_locations_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_locations")),
        sa.UniqueConstraint("organization_id", "code", name="uq_locations_organization_id_code"),
    )
    op.create_table(
        "planning_units",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("parent_unit_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_planning_units_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_unit_id"],
            ["planning_units.id"],
            name=op.f("fk_planning_units_parent_unit_id_planning_units"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_planning_units")),
        sa.UniqueConstraint("organization_id", "name", name="uq_planning_units_organization_id_name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_users_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name=op.f("fk_user_roles_role_id_roles")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users")),
        sa.PrimaryKeyConstraint("user_id", "role_id", name=op.f("pk_user_roles")),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_id_role_id"),
    )


def downgrade() -> None:
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("planning_units")
    op.drop_table("locations")
    op.drop_table("roles")
    op.drop_table("organizations")
