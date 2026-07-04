from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.organization import Location, Organization, PlanningUnit


class ServiceLevelPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "service_level_policies"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_service_level_policies_organization_id_name"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[str] = mapped_column(String(64), nullable=False, default="work_order")
    target_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="service_level_policies")
    work_orders: Mapped[list[WorkOrder]] = relationship(back_populates="service_level_policy")


class WorkOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "work_orders"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    location_id = mapped_column(ForeignKey("locations.id"), nullable=False)
    planning_unit_id = mapped_column(ForeignKey("planning_units.id"), nullable=True)
    service_level_policy_id = mapped_column(ForeignKey("service_level_policies.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requested_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="work_orders")
    location: Mapped[Location] = relationship(back_populates="work_orders")
    planning_unit: Mapped[PlanningUnit | None] = relationship(back_populates="work_orders")
    service_level_policy: Mapped[ServiceLevelPolicy | None] = relationship(
        back_populates="work_orders"
    )
    requirements: Mapped[list[WorkRequirement]] = relationship(
        back_populates="work_order",
        cascade="all, delete-orphan",
    )
    predecessor_dependencies: Mapped[list[WorkOrderDependency]] = relationship(
        foreign_keys="WorkOrderDependency.predecessor_work_order_id",
        back_populates="predecessor_work_order",
        cascade="all, delete-orphan",
    )
    successor_dependencies: Mapped[list[WorkOrderDependency]] = relationship(
        foreign_keys="WorkOrderDependency.successor_work_order_id",
        back_populates="successor_work_order",
        cascade="all, delete-orphan",
    )


class WorkRequirement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "work_requirements"

    work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    requirement_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_id: Mapped[object | None] = mapped_column(Uuid, nullable=True)
    min_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order: Mapped[WorkOrder] = relationship(back_populates="requirements")


class WorkOrderDependency(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "work_order_dependencies"
    __table_args__ = (
        UniqueConstraint(
            "predecessor_work_order_id",
            "successor_work_order_id",
            name="uq_work_order_dependencies_predecessor_successor",
        ),
    )

    predecessor_work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    successor_work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    dependency_type: Mapped[str] = mapped_column(String(64), nullable=False, default="finish_to_start")

    predecessor_work_order: Mapped[WorkOrder] = relationship(
        foreign_keys=[predecessor_work_order_id],
        back_populates="predecessor_dependencies",
    )
    successor_work_order: Mapped[WorkOrder] = relationship(
        foreign_keys=[successor_work_order_id],
        back_populates="successor_dependencies",
    )
