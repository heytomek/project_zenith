from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.demand import ServiceLevelPolicy, WorkOrder
    from app.db.models.identity import User
    from app.db.models.planning import (
        PlanAssignment,
        PlanAssignmentEvent,
        PlanEquipmentReservation,
        PlanMaterialReservation,
        PlanningHorizon,
        PlanRun,
        PlanScenario,
        PlanWorkerReservation,
    )
    from app.db.models.resources import Equipment, EquipmentType, InventoryPosition, Material
    from app.db.models.workforce import Certification, Skill, Worker


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    organization_type: Mapped[str] = mapped_column(String(50), nullable=False, default="organization")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    planning_units: Mapped[list["PlanningUnit"]] = relationship(back_populates="organization")
    locations: Mapped[list["Location"]] = relationship(back_populates="organization")
    users: Mapped[list["User"]] = relationship(back_populates="organization")
    skills: Mapped[list["Skill"]] = relationship(back_populates="organization")
    certifications: Mapped[list["Certification"]] = relationship(back_populates="organization")
    materials: Mapped[list["Material"]] = relationship(back_populates="organization")
    equipment_types: Mapped[list["EquipmentType"]] = relationship(back_populates="organization")
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="organization")
    planning_horizons: Mapped[list["PlanningHorizon"]] = relationship(
        back_populates="organization"
    )
    plan_scenarios: Mapped[list["PlanScenario"]] = relationship(back_populates="organization")
    plan_runs: Mapped[list["PlanRun"]] = relationship(back_populates="organization")
    plan_assignments: Mapped[list["PlanAssignment"]] = relationship(back_populates="organization")
    plan_assignment_events: Mapped[list["PlanAssignmentEvent"]] = relationship(
        back_populates="organization"
    )
    plan_worker_reservations: Mapped[list["PlanWorkerReservation"]] = relationship(
        back_populates="organization"
    )
    plan_material_reservations: Mapped[list["PlanMaterialReservation"]] = relationship(
        back_populates="organization"
    )
    plan_equipment_reservations: Mapped[list["PlanEquipmentReservation"]] = relationship(
        back_populates="organization"
    )
    service_level_policies: Mapped[list["ServiceLevelPolicy"]] = relationship(
        back_populates="organization"
    )
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="organization")
    workers: Mapped[list["Worker"]] = relationship(back_populates="organization")


class PlanningUnit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "planning_units"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_planning_units_organization_id_name"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    parent_unit_id = mapped_column(ForeignKey("planning_units.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(50), nullable=False, default="team")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped["Organization"] = relationship(back_populates="planning_units")
    parent_unit: Mapped["PlanningUnit | None"] = relationship(
        remote_side="PlanningUnit.id",
        back_populates="child_units",
    )
    child_units: Mapped[list["PlanningUnit"]] = relationship(back_populates="parent_unit")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="planning_unit")
    workers: Mapped[list["Worker"]] = relationship(back_populates="home_planning_unit")


class Location(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_locations_organization_id_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    location_type: Mapped[str] = mapped_column(String(50), nullable=False, default="site")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped["Organization"] = relationship(back_populates="locations")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="location")
    workers: Mapped[list["Worker"]] = relationship(back_populates="home_location")
    inventory_positions: Mapped[list["InventoryPosition"]] = relationship(back_populates="location")
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="location")
