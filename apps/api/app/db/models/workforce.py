from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.organization import Location, Organization, PlanningUnit
    from app.db.models.planning import PlanWorkerReservation


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_skills_organization_id_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="skills")
    worker_skills: Mapped[list[WorkerSkill]] = relationship(back_populates="skill")


class Certification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "certifications"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_certifications_organization_id_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="certifications")
    worker_certifications: Mapped[list[WorkerCertification]] = relationship(
        back_populates="certification"
    )


class Worker(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workers"
    __table_args__ = (
        UniqueConstraint("organization_id", "worker_code", name="uq_workers_organization_id_worker_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    worker_code: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employment_type: Mapped[str] = mapped_column(String(50), nullable=False, default="full_time")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    home_location_id = mapped_column(ForeignKey("locations.id"), nullable=True)
    home_planning_unit_id = mapped_column(ForeignKey("planning_units.id"), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="workers")
    home_location: Mapped[Location | None] = relationship(back_populates="workers")
    home_planning_unit: Mapped[PlanningUnit | None] = relationship(back_populates="workers")
    worker_skills: Mapped[list[WorkerSkill]] = relationship(
        back_populates="worker",
        cascade="all, delete-orphan",
    )
    worker_certifications: Mapped[list[WorkerCertification]] = relationship(
        back_populates="worker",
        cascade="all, delete-orphan",
    )
    availability_calendars: Mapped[list[AvailabilityCalendar]] = relationship(
        back_populates="worker",
        cascade="all, delete-orphan",
    )
    shift_templates: Mapped[list[WorkerShiftTemplate]] = relationship(
        back_populates="worker",
        cascade="all, delete-orphan",
    )
    plan_worker_reservations: Mapped[list[PlanWorkerReservation]] = relationship(
        back_populates="worker"
    )


class WorkerSkill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "worker_skills"
    __table_args__ = (
        UniqueConstraint("worker_id", "skill_id", name="uq_worker_skills_worker_id_skill_id"),
    )

    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    skill_id = mapped_column(ForeignKey("skills.id"), nullable=False)
    proficiency_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)

    worker: Mapped[Worker] = relationship(back_populates="worker_skills")
    skill: Mapped[Skill] = relationship(back_populates="worker_skills")


class WorkerCertification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "worker_certifications"
    __table_args__ = (
        UniqueConstraint(
            "worker_id",
            "certification_id",
            name="uq_worker_certifications_worker_id_certification_id",
        ),
    )

    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    certification_id = mapped_column(ForeignKey("certifications.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    worker: Mapped[Worker] = relationship(back_populates="worker_certifications")
    certification: Mapped[Certification] = relationship(back_populates="worker_certifications")


class AvailabilityCalendar(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "availability_calendars"

    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    worker: Mapped[Worker] = relationship(back_populates="availability_calendars")
    windows: Mapped[list[AvailabilityWindow]] = relationship(
        back_populates="calendar",
        cascade="all, delete-orphan",
    )


class AvailabilityWindow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "availability_windows"

    calendar_id = mapped_column(ForeignKey("availability_calendars.id"), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    availability_type: Mapped[str] = mapped_column(String(32), nullable=False)

    calendar: Mapped[AvailabilityCalendar] = relationship(back_populates="windows")


class WorkerShiftTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "worker_shift_templates"
    __table_args__ = (
        UniqueConstraint(
            "worker_id",
            "name",
            "day_of_week",
            name="uq_worker_shift_templates_worker_id_name_day",
        ),
    )

    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_minute_local: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute_local: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    worker: Mapped[Worker] = relationship(back_populates="shift_templates")
    break_rules: Mapped[list[WorkerShiftBreakRule]] = relationship(
        back_populates="shift_template",
        cascade="all, delete-orphan",
    )


class WorkerShiftBreakRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "worker_shift_break_rules"
    __table_args__ = (
        UniqueConstraint(
            "shift_template_id",
            "name",
            "start_minute_local",
            name="uq_worker_shift_break_rules_template_name_start",
        ),
    )

    shift_template_id = mapped_column(ForeignKey("worker_shift_templates.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_minute_local: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    shift_template: Mapped[WorkerShiftTemplate] = relationship(back_populates="break_rules")
