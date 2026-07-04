from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.organization import Location, Organization
    from app.db.models.planning import PlanEquipmentReservation, PlanMaterialReservation


class Material(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "materials"
    __table_args__ = (
        UniqueConstraint("organization_id", "sku", name="uq_materials_organization_id_sku"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(32), nullable=False, default="unit")
    material_type: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="materials")
    inventory_positions: Mapped[list[InventoryPosition]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
    )
    plan_material_reservations: Mapped[list[PlanMaterialReservation]] = relationship(
        back_populates="material"
    )


class InventoryPosition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_positions"
    __table_args__ = (
        UniqueConstraint("material_id", "location_id", name="uq_inventory_positions_material_id_location_id"),
    )

    material_id = mapped_column(ForeignKey("materials.id"), nullable=False)
    location_id = mapped_column(ForeignKey("locations.id"), nullable=False)
    on_hand_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    material: Mapped[Material] = relationship(back_populates="inventory_positions")
    location: Mapped[Location] = relationship(back_populates="inventory_positions")
    plan_material_reservations: Mapped[list[PlanMaterialReservation]] = relationship(
        back_populates="inventory_position"
    )


class EquipmentType(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "equipment_types"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_equipment_types_organization_id_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="equipment_types")
    equipment: Mapped[list[Equipment]] = relationship(back_populates="equipment_type")


class Equipment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "equipment"
    __table_args__ = (
        UniqueConstraint("organization_id", "equipment_code", name="uq_equipment_organization_id_equipment_code"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    equipment_type_id = mapped_column(ForeignKey("equipment_types.id"), nullable=False)
    location_id = mapped_column(ForeignKey("locations.id"), nullable=False)
    equipment_code: Mapped[str] = mapped_column(String(64), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="equipment")
    equipment_type: Mapped[EquipmentType] = relationship(back_populates="equipment")
    location: Mapped[Location] = relationship(back_populates="equipment")
    availability_calendars: Mapped[list[EquipmentAvailabilityCalendar]] = relationship(
        back_populates="equipment",
        cascade="all, delete-orphan",
    )
    plan_equipment_reservations: Mapped[list[PlanEquipmentReservation]] = relationship(
        back_populates="equipment"
    )


class EquipmentAvailabilityCalendar(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "equipment_availability_calendars"

    equipment_id = mapped_column(ForeignKey("equipment.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    equipment: Mapped[Equipment] = relationship(back_populates="availability_calendars")
    windows: Mapped[list[EquipmentAvailabilityWindow]] = relationship(
        back_populates="calendar",
        cascade="all, delete-orphan",
    )


class EquipmentAvailabilityWindow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "equipment_availability_windows"

    calendar_id = mapped_column(ForeignKey("equipment_availability_calendars.id"), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    availability_type: Mapped[str] = mapped_column(String(32), nullable=False)

    calendar: Mapped[EquipmentAvailabilityCalendar] = relationship(back_populates="windows")
