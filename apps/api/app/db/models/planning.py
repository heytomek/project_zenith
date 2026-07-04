from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.demand import WorkOrder
    from app.db.models.organization import Organization
    from app.db.models.resources import Equipment, InventoryPosition, Material
    from app.db.models.workforce import Worker


class PlanningHorizon(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "planning_horizons"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_planning_horizons_organization_id_name"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    start_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped[Organization] = relationship(back_populates="planning_horizons")


class PlanScenario(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_scenarios"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_plan_scenarios_organization_id_name"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    base_scenario_id = mapped_column(ForeignKey("plan_scenarios.id"), nullable=True)
    source_run_id = mapped_column(ForeignKey("plan_runs.id", use_alter=True), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scenario_type: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    labels: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    planning_request: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)

    organization: Mapped[Organization] = relationship(back_populates="plan_scenarios")
    plan_runs: Mapped[list[PlanRun]] = relationship(
        back_populates="scenario",
        foreign_keys="PlanRun.scenario_id",
    )


class PlanRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_runs"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    scenario_id = mapped_column(ForeignKey("plan_scenarios.id"), nullable=True)
    scenario_name: Mapped[str] = mapped_column(String(255), nullable=False)
    run_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    publication_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    approval_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    planning_request: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)

    organization: Mapped[Organization] = relationship(back_populates="plan_runs")
    scenario: Mapped[PlanScenario | None] = relationship(
        back_populates="plan_runs",
        foreign_keys=[scenario_id],
    )
    assignments: Mapped[list[PlanAssignment]] = relationship(
        back_populates="plan_run",
        cascade="all, delete-orphan",
        order_by="PlanAssignment.scheduled_start_at",
    )


class PlanDispatchQueueTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_dispatch_queue_templates"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_plan_dispatch_queue_templates_organization_id_name",
        ),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    assignment_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    execution_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    handoff_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source_kinds: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    canned_handoff_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    allowed_role_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class PlanDispatchQueue(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_dispatch_queues"
    __table_args__ = (
        UniqueConstraint("plan_run_id", "name", name="uq_plan_dispatch_queues_plan_run_id_name"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    queue_template_id = mapped_column(ForeignKey("plan_dispatch_queue_templates.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    assignment_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    execution_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    handoff_statuses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source_kinds: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    canned_handoff_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    allowed_role_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class PlanAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_assignments"
    __table_args__ = (
        UniqueConstraint("plan_run_id", "work_order_id", name="uq_plan_assignments_plan_run_id_work_order_id"),
    )

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    worker_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    crew_worker_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    crew_worker_names: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    crew_size_required: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    assignment_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="planner")
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    matched_skill_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    matched_certification_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    reserved_material_quantities: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False, default=dict)
    reserved_equipment_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    scheduled_start_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_travel_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_overtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    execution_status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_started")
    actual_start_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latest_execution_event_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    overridden_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatch_handoff_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    dispatch_handoff_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispatch_handoff_actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dispatch_handoff_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="plan_assignments")
    plan_run: Mapped[PlanRun] = relationship(back_populates="assignments")
    work_order: Mapped[WorkOrder] = relationship()
    worker: Mapped[Worker] = relationship()
    events: Mapped[list[PlanAssignmentEvent]] = relationship(
        back_populates="plan_assignment",
        cascade="all, delete-orphan",
        order_by="PlanAssignmentEvent.occurred_at",
    )
    worker_reservations: Mapped[list[PlanWorkerReservation]] = relationship(
        back_populates="plan_assignment",
        cascade="all, delete-orphan",
    )
    material_reservations: Mapped[list[PlanMaterialReservation]] = relationship(
        back_populates="plan_assignment",
        cascade="all, delete-orphan",
    )
    equipment_reservations: Mapped[list[PlanEquipmentReservation]] = relationship(
        back_populates="plan_assignment",
        cascade="all, delete-orphan",
    )


class PlanAssignmentEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_assignment_events"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    plan_assignment_id = mapped_column(ForeignKey("plan_assignments.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    occurred_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)

    organization: Mapped[Organization] = relationship(back_populates="plan_assignment_events")
    plan_run: Mapped[PlanRun] = relationship()
    plan_assignment: Mapped[PlanAssignment] = relationship(back_populates="events")


class PlanWorkerReservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_worker_reservations"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    plan_assignment_id = mapped_column(ForeignKey("plan_assignments.id"), nullable=False)
    work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    worker_id = mapped_column(ForeignKey("workers.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    reserved_start_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_end_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="plan_worker_reservations")
    plan_run: Mapped[PlanRun] = relationship()
    plan_assignment: Mapped[PlanAssignment] = relationship(back_populates="worker_reservations")
    work_order: Mapped[WorkOrder] = relationship()
    worker: Mapped[Worker] = relationship(back_populates="plan_worker_reservations")


class PlanMaterialReservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_material_reservations"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    plan_assignment_id = mapped_column(ForeignKey("plan_assignments.id"), nullable=False)
    work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    material_id = mapped_column(ForeignKey("materials.id"), nullable=False)
    inventory_position_id = mapped_column(ForeignKey("inventory_positions.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    released_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="plan_material_reservations")
    plan_run: Mapped[PlanRun] = relationship()
    plan_assignment: Mapped[PlanAssignment] = relationship(back_populates="material_reservations")
    work_order: Mapped[WorkOrder] = relationship()
    material: Mapped[Material] = relationship(back_populates="plan_material_reservations")
    inventory_position: Mapped[InventoryPosition] = relationship(
        back_populates="plan_material_reservations"
    )


class PlanEquipmentReservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_equipment_reservations"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plan_run_id = mapped_column(ForeignKey("plan_runs.id"), nullable=False)
    plan_assignment_id = mapped_column(ForeignKey("plan_assignments.id"), nullable=False)
    work_order_id = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    equipment_id = mapped_column(ForeignKey("equipment.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    reserved_start_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_end_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="plan_equipment_reservations")
    plan_run: Mapped[PlanRun] = relationship()
    plan_assignment: Mapped[PlanAssignment] = relationship(back_populates="equipment_reservations")
    work_order: Mapped[WorkOrder] = relationship()
    equipment: Mapped[Equipment] = relationship(back_populates="plan_equipment_reservations")
