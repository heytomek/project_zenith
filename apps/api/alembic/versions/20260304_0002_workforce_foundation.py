"""Add workforce foundation tables.

Revision ID: 20260304_0002
Revises: 20260304_0001
Create Date: 2026-03-04 00:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260304_0002"
down_revision: str | None = "20260304_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "certifications",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("expires", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_certifications_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certifications")),
        sa.UniqueConstraint("organization_id", "code", name="uq_certifications_organization_id_code"),
    )
    op.create_table(
        "skills",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_skills_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_skills")),
        sa.UniqueConstraint("organization_id", "code", name="uq_skills_organization_id_code"),
    )
    op.create_table(
        "workers",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("worker_code", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("employment_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("home_location_id", sa.Uuid(), nullable=True),
        sa.Column("home_planning_unit_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["home_location_id"],
            ["locations.id"],
            name=op.f("fk_workers_home_location_id_locations"),
        ),
        sa.ForeignKeyConstraint(
            ["home_planning_unit_id"],
            ["planning_units.id"],
            name=op.f("fk_workers_home_planning_unit_id_planning_units"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_workers_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workers")),
        sa.UniqueConstraint("organization_id", "worker_code", name="uq_workers_organization_id_worker_code"),
    )
    op.create_table(
        "availability_calendars",
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["workers.id"],
            name=op.f("fk_availability_calendars_worker_id_workers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_availability_calendars")),
    )
    op.create_table(
        "worker_certifications",
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("certification_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["certification_id"],
            ["certifications.id"],
            name=op.f("fk_worker_certifications_certification_id_certifications"),
        ),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["workers.id"],
            name=op.f("fk_worker_certifications_worker_id_workers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_worker_certifications")),
        sa.UniqueConstraint(
            "worker_id",
            "certification_id",
            name="uq_worker_certifications_worker_id_certification_id",
        ),
    )
    op.create_table(
        "worker_skills",
        sa.Column("worker_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column("proficiency_level", sa.Integer(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], name=op.f("fk_worker_skills_skill_id_skills")),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"], name=op.f("fk_worker_skills_worker_id_workers")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_worker_skills")),
        sa.UniqueConstraint("worker_id", "skill_id", name="uq_worker_skills_worker_id_skill_id"),
    )
    op.create_table(
        "availability_windows",
        sa.Column("calendar_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("availability_type", sa.String(length=32), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["calendar_id"],
            ["availability_calendars.id"],
            name=op.f("fk_availability_windows_calendar_id_availability_calendars"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_availability_windows")),
    )


def downgrade() -> None:
    op.drop_table("availability_windows")
    op.drop_table("worker_skills")
    op.drop_table("worker_certifications")
    op.drop_table("availability_calendars")
    op.drop_table("workers")
    op.drop_table("skills")
    op.drop_table("certifications")
