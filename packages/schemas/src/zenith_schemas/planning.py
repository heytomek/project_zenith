from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AvailabilityWindowFact(BaseModel):
    start_at: datetime
    end_at: datetime
    availability_type: str


class WorkerFact(BaseModel):
    worker_id: str
    display_name: str
    employment_type: str = "full_time"
    daily_regular_capacity_minutes: int = Field(default=480, ge=0)
    planning_regular_capacity_minutes: int | None = Field(default=None, ge=0)
    home_location_id: str | None = None
    home_location_latitude: float | None = None
    home_location_longitude: float | None = None
    skill_codes: list[str] = Field(default_factory=list)
    skill_levels: dict[str, int] = Field(default_factory=dict)
    certification_codes: list[str] = Field(default_factory=list)
    available: bool = True
    availability_windows: list[AvailabilityWindowFact] = Field(default_factory=list)


class MaterialAvailabilityFact(BaseModel):
    material_code: str
    location_id: str
    available_quantity: int = Field(ge=0)


class EquipmentUnitFact(BaseModel):
    equipment_id: str
    equipment_type_code: str
    location_id: str
    available: bool = True
    availability_windows: list[AvailabilityWindowFact] = Field(default_factory=list)


class WorkOrderFact(BaseModel):
    work_order_id: str
    title: str
    location_id: str | None = None
    required_skill_codes: list[str] = Field(default_factory=list)
    required_skill_quantities: dict[str, int] = Field(default_factory=dict)
    required_skill_levels: dict[str, int] = Field(default_factory=dict)
    required_certification_codes: list[str] = Field(default_factory=list)
    required_certification_quantities: dict[str, int] = Field(default_factory=dict)
    required_worker_count: int = Field(default=1, ge=1)
    required_material_quantities: dict[str, int] = Field(default_factory=dict)
    required_equipment_type_quantities: dict[str, int] = Field(default_factory=dict)
    priority: int = 0
    requested_start_at: datetime | None = None
    due_at: datetime | None = None
    location_latitude: float | None = None
    location_longitude: float | None = None


class WorkOrderDependencyFact(BaseModel):
    predecessor_work_order_id: str
    successor_work_order_id: str
    dependency_type: str


class PlanningRequest(BaseModel):
    scenario_name: str = "phase-zero"
    window_start: datetime | None = None
    window_end: datetime | None = None
    workers: list[WorkerFact] = Field(default_factory=list)
    materials: list[MaterialAvailabilityFact] = Field(default_factory=list)
    equipment_units: list[EquipmentUnitFact] = Field(default_factory=list)
    work_orders: list[WorkOrderFact] = Field(default_factory=list)
    dependencies: list[WorkOrderDependencyFact] = Field(default_factory=list)


class OrganizationPlanningRequest(BaseModel):
    scenario_name: str = "organization-dry-run"
    planning_horizon_id: UUID | None = None
    worker_ids: list[UUID] = Field(default_factory=list)
    work_order_ids: list[UUID] = Field(default_factory=list)
    location_ids: list[UUID] = Field(default_factory=list)
    planning_unit_ids: list[UUID] = Field(default_factory=list)
    worker_statuses: list[str] = Field(default_factory=lambda: ["active"])
    work_order_statuses: list[str] = Field(default_factory=lambda: ["open", "in_progress"])
    window_start: datetime | None = None
    window_end: datetime | None = None


class CandidateAssignment(BaseModel):
    work_order_id: str
    worker_id: str
    worker_name: str
    crew_worker_ids: list[str] = Field(default_factory=list)
    crew_worker_names: list[str] = Field(default_factory=list)
    crew_size_required: int = Field(default=1, ge=1)
    score: int
    matched_skill_codes: list[str] = Field(default_factory=list)
    matched_certification_codes: list[str] = Field(default_factory=list)
    reserved_material_quantities: dict[str, int] = Field(default_factory=dict)
    reserved_equipment_ids: list[str] = Field(default_factory=list)
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    estimated_travel_minutes: int = Field(default=0, ge=0)
    estimated_overtime_minutes: int = Field(default=0, ge=0)


class UnassignedWork(BaseModel):
    work_order_id: str
    reason: str


class PlanRunSummary(BaseModel):
    status: Literal["draft", "completed", "failed"]
    assignments: list[CandidateAssignment] = Field(default_factory=list)
    unassigned: list[UnassignedWork] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class PlanScenarioBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    notes: str | None = None
    labels: list[str] = Field(default_factory=list)
    status: str = Field(default="active", min_length=1, max_length=32)
    planning_request: OrganizationPlanningRequest


class PlanningHorizonBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    start_at: datetime
    end_at: datetime
    status: str = Field(default="active", min_length=1, max_length=32)


class PlanningHorizonCreate(PlanningHorizonBase):
    pass


class PlanningHorizonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class PlanningHorizonRead(PlanningHorizonBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class PlanScenarioCreate(PlanScenarioBase):
    pass


class PlanScenarioUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    notes: str | None = None
    labels: list[str] | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    planning_request: OrganizationPlanningRequest | None = None


class PlanScenarioRead(PlanScenarioBase, ORMModel):
    id: UUID
    organization_id: UUID
    scenario_type: str
    base_scenario_id: UUID | None = None
    source_run_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class PlanRunCreate(OrganizationPlanningRequest):
    scenario_id: UUID | None = None


class PlanRunRead(ORMModel):
    id: UUID
    organization_id: UUID
    scenario_id: UUID | None
    scenario_name: str
    run_kind: str
    status: str
    review_status: str
    publication_status: str
    approval_note: str | None = None
    approved_at: datetime | None = None
    approved_by_name: str | None = None
    published_at: datetime | None = None
    published_by_name: str | None = None
    planning_request: OrganizationPlanningRequest
    summary: PlanRunSummary
    created_at: datetime
    updated_at: datetime


class PlanAssignmentRead(ORMModel):
    id: UUID
    organization_id: UUID
    plan_run_id: UUID
    work_order_id: UUID
    worker_id: UUID
    worker_name_snapshot: str
    crew_worker_ids: list[str] = Field(default_factory=list)
    crew_worker_names: list[str] = Field(default_factory=list)
    crew_size_required: int = Field(default=1, ge=1)
    assignment_status: str
    source_kind: str
    score: int
    matched_skill_codes: list[str] = Field(default_factory=list)
    matched_certification_codes: list[str] = Field(default_factory=list)
    reserved_material_quantities: dict[str, int] = Field(default_factory=dict)
    reserved_equipment_ids: list[str] = Field(default_factory=list)
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    estimated_travel_minutes: int = Field(default=0, ge=0)
    estimated_overtime_minutes: int = Field(default=0, ge=0)
    execution_status: str
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    actual_duration_minutes: int | None = None
    latest_execution_event_at: datetime | None = None
    override_reason: str | None = None
    override_note: str | None = None
    override_actor_name: str | None = None
    overridden_at: datetime | None = None
    dispatch_handoff_status: str
    dispatch_handoff_note: str | None = None
    dispatch_handoff_actor_name: str | None = None
    dispatch_handoff_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PlanAssignmentEventRead(ORMModel):
    id: UUID
    organization_id: UUID
    plan_run_id: UUID
    plan_assignment_id: UUID
    event_type: Literal[
        "started",
        "blocked",
        "completed",
        "reassigned",
        "cancelled",
        "handoff_updated",
    ]
    occurred_at: datetime
    actor_name: str
    note: str | None = None
    payload_json: dict[str, object] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class PlanAssignmentOverrideUpdate(BaseModel):
    worker_id: UUID
    crew_worker_ids: list[UUID] | None = None
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    override_reason: str = Field(min_length=1, max_length=500)
    override_note: str | None = None
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)


class PlanRunApprovalAction(BaseModel):
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    note: str | None = None


class PlanRunPublishAction(BaseModel):
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    published_at: datetime | None = None


class PlanAssignmentEventCreate(BaseModel):
    event_type: Literal["started", "blocked", "completed"]
    occurred_at: datetime | None = None
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    note: str | None = None
    reason_code: str | None = Field(default=None, min_length=1, max_length=64)


class PlanAssignmentCancellationAction(BaseModel):
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    reason: str = Field(min_length=1, max_length=500)
    note: str | None = None
    occurred_at: datetime | None = None


class PlanAssignmentReassignmentAction(BaseModel):
    worker_id: UUID
    crew_worker_ids: list[UUID] | None = None
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    reason: str = Field(min_length=1, max_length=500)
    note: str | None = None
    occurred_at: datetime | None = None


class PlanAssignmentBulkHandoffAction(BaseModel):
    assignment_ids: list[UUID] = Field(min_length=1)
    handoff_status: Literal["pending", "ready", "sent", "acknowledged"]
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    note: str | None = None
    occurred_at: datetime | None = None


class PlanAssignmentBulkHandoffResult(BaseModel):
    run_id: UUID
    handoff_status: Literal["pending", "ready", "sent", "acknowledged"]
    occurred_at: datetime
    updated_count: int
    updated_assignment_ids: list[UUID] = Field(default_factory=list)


class PlanDispatchQueueBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: str = Field(default="active", min_length=1, max_length=32)
    assignment_statuses: list[str] = Field(default_factory=list)
    execution_statuses: list[str] = Field(default_factory=list)
    handoff_statuses: list[str] = Field(default_factory=list)
    source_kinds: list[str] = Field(default_factory=list)
    canned_handoff_status: Literal["pending", "ready", "sent", "acknowledged"] | None = None
    allowed_role_codes: list[str] = Field(default_factory=list)


class PlanDispatchQueueTemplateCreate(PlanDispatchQueueBase):
    pass


class PlanDispatchQueueTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    assignment_statuses: list[str] | None = None
    execution_statuses: list[str] | None = None
    handoff_statuses: list[str] | None = None
    source_kinds: list[str] | None = None
    canned_handoff_status: Literal["pending", "ready", "sent", "acknowledged"] | None = None
    allowed_role_codes: list[str] | None = None


class PlanDispatchQueueTemplateRead(PlanDispatchQueueBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class PlanDispatchQueueCreate(BaseModel):
    template_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    assignment_statuses: list[str] | None = None
    execution_statuses: list[str] | None = None
    handoff_statuses: list[str] | None = None
    source_kinds: list[str] | None = None
    canned_handoff_status: Literal["pending", "ready", "sent", "acknowledged"] | None = None
    allowed_role_codes: list[str] | None = None


class PlanDispatchQueueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    assignment_statuses: list[str] | None = None
    execution_statuses: list[str] | None = None
    handoff_statuses: list[str] | None = None
    source_kinds: list[str] | None = None
    canned_handoff_status: Literal["pending", "ready", "sent", "acknowledged"] | None = None
    allowed_role_codes: list[str] | None = None


class PlanDispatchQueueRead(PlanDispatchQueueBase, ORMModel):
    id: UUID
    organization_id: UUID
    plan_run_id: UUID
    queue_template_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class PlanDispatchQueueApplyAction(BaseModel):
    handoff_status: Literal["pending", "ready", "sent", "acknowledged"] | None = None
    actor_name: str = Field(default="local-planner", min_length=1, max_length=255)
    actor_user_id: UUID | None = None
    note: str | None = None
    occurred_at: datetime | None = None


class PlanDispatchQueueApplyResult(BaseModel):
    queue_id: UUID
    run_id: UUID
    source_kind: Literal["run_queue", "template"] = "run_queue"
    matched_count: int
    matched_assignment_ids: list[UUID] = Field(default_factory=list)
    handoff_status: Literal["pending", "ready", "sent", "acknowledged"]
    updated_count: int
    updated_assignment_ids: list[UUID] = Field(default_factory=list)


class PlanRunReference(BaseModel):
    id: UUID
    scenario_id: UUID | None = None
    scenario_name: str
    status: str
    created_at: datetime


class PlanRunAssignmentChange(BaseModel):
    work_order_id: str
    work_order_title: str | None = None
    change_type: Literal["added", "removed", "modified"]
    changed_fields: list[str] = Field(default_factory=list)
    baseline_assignment: CandidateAssignment | None = None
    candidate_assignment: CandidateAssignment | None = None


class PlanRunUnassignedChange(BaseModel):
    work_order_id: str
    work_order_title: str | None = None
    change_type: Literal["added", "removed", "modified"]
    baseline_reason: str | None = None
    candidate_reason: str | None = None


class PlanRunIssueChange(BaseModel):
    message: str
    change_type: Literal["added", "removed"]


class PlanRunComparisonSummary(BaseModel):
    assignments_before: int
    assignments_after: int
    unassigned_before: int
    unassigned_after: int
    issues_before: int
    issues_after: int
    assignment_changes: int
    unassigned_changes: int
    issue_changes: int
    newly_assigned_work_orders: int
    newly_unassigned_work_orders: int


class PlanRunComparisonRead(BaseModel):
    baseline_run: PlanRunReference
    candidate_run: PlanRunReference
    summary: PlanRunComparisonSummary
    assignment_changes: list[PlanRunAssignmentChange] = Field(default_factory=list)
    unassigned_changes: list[PlanRunUnassignedChange] = Field(default_factory=list)
    issue_changes: list[PlanRunIssueChange] = Field(default_factory=list)


class PlanActualsReviewSummary(BaseModel):
    assignments_total: int
    assignments_not_started: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_completed: int
    assignments_cancelled: int = 0
    delayed_start_count: int
    overdue_completion_count: int
    blocked_event_count: int
    total_duration_variance_minutes: int


class PlanActualsReasonCount(BaseModel):
    reason_code: str
    count: int


class PlanActualsBreakdownItem(BaseModel):
    label: str
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    delayed_start_count: int
    overdue_completion_count: int
    blocked_event_count: int
    total_duration_variance_minutes: int


class PlanActualsReviewItem(BaseModel):
    assignment_id: UUID
    work_order_id: UUID
    work_order_title: str
    worker_id: UUID
    worker_name: str
    assignment_status: str
    execution_status: str
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    planned_duration_minutes: int | None = None
    actual_duration_minutes: int | None = None
    start_variance_minutes: int | None = None
    completion_variance_minutes: int | None = None
    duration_variance_minutes: int | None = None
    blocked_event_count: int = 0
    latest_event_type: str | None = None
    latest_event_at: datetime | None = None
    latest_event_note: str | None = None


class PlanActualsReviewRead(BaseModel):
    run: PlanRunReference
    summary: PlanActualsReviewSummary
    items: list[PlanActualsReviewItem] = Field(default_factory=list)
    blocked_reason_counts: list[PlanActualsReasonCount] = Field(default_factory=list)
    worker_breakdown: list[PlanActualsBreakdownItem] = Field(default_factory=list)
    location_breakdown: list[PlanActualsBreakdownItem] = Field(default_factory=list)
    work_type_breakdown: list[PlanActualsBreakdownItem] = Field(default_factory=list)


class OperationsReportFilters(BaseModel):
    window_start: datetime | None = None
    window_end: datetime | None = None
    location_id: UUID | None = None
    planning_unit_id: UUID | None = None


class OperationsReportSummary(BaseModel):
    published_runs_count: int
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    delayed_start_count: int
    overdue_completion_count: int
    blocked_event_count: int
    total_planned_minutes: int
    total_actual_minutes: int
    total_duration_variance_minutes: int
    active_worker_reservations: int
    active_equipment_reservations: int
    active_material_reservations: int
    active_reserved_material_units: int
    consumed_material_units: int


class OperationsPublishedRunItem(BaseModel):
    run_id: UUID
    scenario_name: str
    published_at: datetime | None = None
    published_by_name: str | None = None
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    blocked_event_count: int
    active_reservations: int


class OperationsWorkerBreakdownItem(BaseModel):
    worker_id: UUID
    worker_name: str
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    blocked_event_count: int
    planned_minutes: int
    actual_minutes: int
    active_reservations: int


class OperationsLocationBreakdownItem(BaseModel):
    location_id: UUID | None = None
    location_name: str
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    blocked_event_count: int
    planned_minutes: int
    actual_minutes: int
    active_reservations: int


class OperationsMaterialBreakdownItem(BaseModel):
    material_id: UUID
    material_code: str
    material_name: str
    location_id: UUID
    location_name: str
    assignments_total: int
    on_hand_quantity: int
    reserved_quantity: int
    available_quantity: int
    active_reserved_quantity: int
    consumed_quantity: int


class OperationsEquipmentBreakdownItem(BaseModel):
    equipment_id: UUID
    equipment_code: str
    equipment_type_code: str
    equipment_type_name: str
    location_id: UUID
    location_name: str
    assignments_total: int
    active_reservations: int
    reserved_minutes: int


class OperationsAssignmentRow(BaseModel):
    run_id: UUID
    scenario_name: str
    published_at: datetime | None = None
    work_order_id: UUID
    work_order_title: str
    location_id: UUID | None = None
    location_name: str | None = None
    planning_unit_id: UUID | None = None
    planning_unit_name: str | None = None
    worker_id: UUID
    worker_name: str
    assignment_status: str
    execution_status: str
    scheduled_start_at: datetime | None = None
    scheduled_end_at: datetime | None = None
    planned_duration_minutes: int | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    actual_duration_minutes: int | None = None
    start_variance_minutes: int | None = None
    completion_variance_minutes: int | None = None
    duration_variance_minutes: int | None = None
    blocked_event_count: int
    active_worker_reservation: bool
    active_equipment_reservations: int
    active_material_reserved_quantity: int
    consumed_material_quantity: int
    reserved_equipment_ids: list[str] = Field(default_factory=list)
    reserved_material_quantities: dict[str, int] = Field(default_factory=dict)


class OperationsBottleneckItem(BaseModel):
    category: Literal["worker", "location", "material", "equipment"]
    label: str
    secondary_label: str | None = None
    detail: str
    severity_score: int = Field(ge=0)
    assignments_total: int
    assignments_blocked: int
    blocked_event_count: int = 0
    delayed_start_count: int = 0
    active_reservations: int = 0
    utilization_percent: float | None = None


class OperationsTrendPoint(BaseModel):
    bucket_start: datetime
    bucket_end: datetime
    bucket_label: str
    assignments_total: int
    assignments_completed: int
    assignments_in_progress: int
    assignments_blocked: int
    assignments_not_started: int
    assignments_cancelled: int = 0
    blocked_event_count: int
    total_planned_minutes: int
    total_actual_minutes: int
    total_duration_variance_minutes: int
    active_worker_reservations: int
    active_equipment_reservations: int
    active_material_reserved_units: int
    consumed_material_units: int
    equipment_reserved_minutes: int


class OperationsReportRead(BaseModel):
    filters: OperationsReportFilters
    summary: OperationsReportSummary
    published_runs: list[OperationsPublishedRunItem] = Field(default_factory=list)
    worker_breakdown: list[OperationsWorkerBreakdownItem] = Field(default_factory=list)
    location_breakdown: list[OperationsLocationBreakdownItem] = Field(default_factory=list)
    material_breakdown: list[OperationsMaterialBreakdownItem] = Field(default_factory=list)
    equipment_breakdown: list[OperationsEquipmentBreakdownItem] = Field(default_factory=list)
    bottlenecks: list[OperationsBottleneckItem] = Field(default_factory=list)
    trend_granularity: Literal["day", "week"] = "day"
    trends: list[OperationsTrendPoint] = Field(default_factory=list)
    assignment_rows: list[OperationsAssignmentRow] = Field(default_factory=list)
