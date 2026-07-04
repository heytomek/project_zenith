export type ApiErrorResponse = {
  detail?: string;
};

export type HealthResponse = {
  service: string;
  version: string;
  environment: string;
  database_backend: string;
  configured_tables: string[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PlanningUnit = {
  id: string;
  organization_id: string;
  name: string;
  unit_type: string;
  status: string;
  parent_unit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  location_type: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
};

export type User = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  status: string;
  roles: RoleSummary[];
  created_at: string;
  updated_at: string;
};

export type Skill = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SkillSummary = {
  id: string;
  code: string;
  name: string;
};

export type Certification = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  expires: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CertificationSummary = {
  id: string;
  code: string;
  name: string;
};

export type Worker = {
  id: string;
  organization_id: string;
  worker_code: string;
  display_name: string;
  employment_type: string;
  status: string;
  home_location_id: string | null;
  home_planning_unit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkerSkill = {
  id: string;
  worker_id: string;
  skill_id: string;
  proficiency_level: number;
  verified: boolean;
  source: string | null;
  skill: SkillSummary;
  created_at: string;
  updated_at: string;
};

export type WorkerCertification = {
  id: string;
  worker_id: string;
  certification_id: string;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  certification: CertificationSummary;
  created_at: string;
  updated_at: string;
};

export type AvailabilityCalendar = {
  id: string;
  worker_id: string;
  name: string;
  timezone: string;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AvailabilityWindow = {
  id: string;
  calendar_id: string;
  start_at: string;
  end_at: string;
  availability_type: string;
  created_at: string;
  updated_at: string;
};

export type WorkerShiftTemplate = {
  id: string;
  worker_id: string;
  name: string;
  timezone: string;
  day_of_week: number;
  start_minute_local: number;
  end_minute_local: number;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WorkerShiftBreakRule = {
  id: string;
  shift_template_id: string;
  name: string;
  start_minute_local: number;
  duration_minutes: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PlanningHorizon = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  timezone: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WorkOrder = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  requested_start_at: string | null;
  due_at: string | null;
  location_id: string;
  planning_unit_id: string | null;
  service_level_policy_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceLevelPolicy = {
  id: string;
  organization_id: string;
  name: string;
  scope: string;
  target_minutes: number;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WorkRequirement = {
  id: string;
  work_order_id: string;
  requirement_type: string;
  reference_id: string | null;
  min_level: number | null;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderDependency = {
  id: string;
  predecessor_work_order_id: string;
  successor_work_order_id: string;
  dependency_type: string;
  created_at: string;
  updated_at: string;
};

export type Material = {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  material_type: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MaterialSummary = {
  id: string;
  sku: string;
  name: string;
};

export type InventoryPosition = {
  id: string;
  material_id: string;
  location_id: string;
  on_hand_quantity: number;
  reserved_quantity: number;
  material: MaterialSummary;
  created_at: string;
  updated_at: string;
};

export type EquipmentTypeSummary = {
  id: string;
  code: string;
  name: string;
};

export type Equipment = {
  id: string;
  organization_id: string;
  equipment_type_id: string;
  location_id: string;
  equipment_code: string;
  serial_number: string | null;
  status: string;
  equipment_type: EquipmentTypeSummary;
  created_at: string;
  updated_at: string;
};

export type EquipmentType = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EquipmentAvailabilityCalendar = {
  id: string;
  equipment_id: string;
  name: string;
  timezone: string;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EquipmentAvailabilityWindow = {
  id: string;
  calendar_id: string;
  start_at: string;
  end_at: string;
  availability_type: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationPlanningRequest = {
  scenario_name: string;
  planning_horizon_id: string | null;
  worker_ids: string[];
  work_order_ids: string[];
  location_ids: string[];
  planning_unit_ids: string[];
  worker_statuses: string[];
  work_order_statuses: string[];
  window_start: string | null;
  window_end: string | null;
};

export type PlanScenario = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  notes: string | null;
  labels: string[];
  scenario_type: string;
  base_scenario_id: string | null;
  source_run_id: string | null;
  status: string;
  planning_request: OrganizationPlanningRequest;
  created_at: string;
  updated_at: string;
};

export type PlanScenarioCreate = {
  name: string;
  description: string | null;
  notes: string | null;
  labels: string[];
  status: string;
  planning_request: OrganizationPlanningRequest;
};

export type CandidateAssignment = {
  work_order_id: string;
  worker_id: string;
  worker_name: string;
  crew_worker_ids: string[];
  crew_worker_names: string[];
  crew_size_required: number;
  score: number;
  matched_skill_codes: string[];
  matched_certification_codes: string[];
  reserved_material_quantities: Record<string, number>;
  reserved_equipment_ids: string[];
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  estimated_travel_minutes: number;
  estimated_overtime_minutes: number;
};

export type UnassignedWork = {
  work_order_id: string;
  reason: string;
};

export type PlanRunSummary = {
  status: "draft" | "completed" | "failed";
  assignments: CandidateAssignment[];
  unassigned: UnassignedWork[];
  issues: string[];
};

export type PlanRun = {
  id: string;
  organization_id: string;
  scenario_id: string | null;
  scenario_name: string;
  run_kind: string;
  status: string;
  review_status: string;
  publication_status: string;
  approval_note: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  published_at: string | null;
  published_by_name: string | null;
  planning_request: OrganizationPlanningRequest;
  summary: PlanRunSummary;
  created_at: string;
  updated_at: string;
};

export type PlanRunCreate = OrganizationPlanningRequest & {
  scenario_id: string | null;
};

export type PlanAssignment = {
  id: string;
  organization_id: string;
  plan_run_id: string;
  work_order_id: string;
  worker_id: string;
  worker_name_snapshot: string;
  crew_worker_ids: string[];
  crew_worker_names: string[];
  crew_size_required: number;
  assignment_status: string;
  source_kind: string;
  score: number;
  matched_skill_codes: string[];
  matched_certification_codes: string[];
  reserved_material_quantities: Record<string, number>;
  reserved_equipment_ids: string[];
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  estimated_travel_minutes: number;
  estimated_overtime_minutes: number;
  execution_status: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_duration_minutes: number | null;
  latest_execution_event_at: string | null;
  override_reason: string | null;
  override_note: string | null;
  override_actor_name: string | null;
  overridden_at: string | null;
  dispatch_handoff_status: string;
  dispatch_handoff_note: string | null;
  dispatch_handoff_actor_name: string | null;
  dispatch_handoff_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanAssignmentEvent = {
  id: string;
  organization_id: string;
  plan_run_id: string;
  plan_assignment_id: string;
  event_type:
    | "started"
    | "blocked"
    | "completed"
    | "reassigned"
    | "cancelled"
    | "handoff_updated";
  occurred_at: string;
  actor_name: string;
  note: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlanAssignmentCancellationAction = {
  actor_name: string;
  reason: string;
  note: string | null;
  occurred_at: string | null;
};

export type PlanAssignmentOverrideUpdate = {
  worker_id: string;
  crew_worker_ids: string[] | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  override_reason: string;
  override_note: string | null;
  actor_name: string;
};

export type PlanAssignmentReassignmentAction = {
  worker_id: string;
  crew_worker_ids: string[] | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actor_name: string;
  reason: string;
  note: string | null;
  occurred_at: string | null;
};

export type PlanAssignmentBulkHandoffAction = {
  assignment_ids: string[];
  handoff_status: "pending" | "ready" | "sent" | "acknowledged";
  actor_name: string;
  note: string | null;
  occurred_at: string | null;
};

export type PlanAssignmentBulkHandoffResult = {
  run_id: string;
  handoff_status: "pending" | "ready" | "sent" | "acknowledged";
  occurred_at: string;
  updated_count: number;
  updated_assignment_ids: string[];
};

export type PlanDispatchQueue = {
  id: string;
  organization_id: string;
  plan_run_id: string;
  queue_template_id: string | null;
  name: string;
  description: string | null;
  status: string;
  assignment_statuses: string[];
  execution_statuses: string[];
  handoff_statuses: string[];
  source_kinds: string[];
  canned_handoff_status?: "pending" | "ready" | "sent" | "acknowledged" | null;
  allowed_role_codes: string[];
  created_at: string;
  updated_at: string;
};

export type PlanDispatchQueueTemplate = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  assignment_statuses: string[];
  execution_statuses: string[];
  handoff_statuses: string[];
  source_kinds: string[];
  canned_handoff_status: "pending" | "ready" | "sent" | "acknowledged" | null;
  allowed_role_codes: string[];
  created_at: string;
  updated_at: string;
};

export type PlanDispatchQueueTemplateCreate = {
  name: string;
  description: string | null;
  status: string;
  assignment_statuses: string[];
  execution_statuses: string[];
  handoff_statuses: string[];
  source_kinds: string[];
  canned_handoff_status: "pending" | "ready" | "sent" | "acknowledged" | null;
  allowed_role_codes: string[];
};

export type PlanDispatchQueueCreate = {
  template_id?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  assignment_statuses?: string[] | null;
  execution_statuses?: string[] | null;
  handoff_statuses?: string[] | null;
  source_kinds?: string[] | null;
  canned_handoff_status: "pending" | "ready" | "sent" | "acknowledged" | null;
  allowed_role_codes?: string[] | null;
};

export type PlanDispatchQueueApplyAction = {
  handoff_status: "pending" | "ready" | "sent" | "acknowledged" | null;
  actor_name: string;
  actor_user_id?: string | null;
  note: string | null;
  occurred_at: string | null;
};

export type PlanDispatchQueueApplyResult = {
  queue_id: string;
  run_id: string;
  source_kind: "run_queue" | "template";
  matched_count: number;
  matched_assignment_ids: string[];
  handoff_status: "pending" | "ready" | "sent" | "acknowledged";
  updated_count: number;
  updated_assignment_ids: string[];
};

export type PlanRunReference = {
  id: string;
  scenario_id: string | null;
  scenario_name: string;
  status: string;
  created_at: string;
};

export type PlanRunAssignmentChange = {
  work_order_id: string;
  work_order_title: string | null;
  change_type: "added" | "removed" | "modified";
  changed_fields: string[];
  baseline_assignment: CandidateAssignment | null;
  candidate_assignment: CandidateAssignment | null;
};

export type PlanRunUnassignedChange = {
  work_order_id: string;
  work_order_title: string | null;
  change_type: "added" | "removed" | "modified";
  baseline_reason: string | null;
  candidate_reason: string | null;
};

export type PlanRunIssueChange = {
  message: string;
  change_type: "added" | "removed";
};

export type PlanRunComparisonSummary = {
  assignments_before: number;
  assignments_after: number;
  unassigned_before: number;
  unassigned_after: number;
  issues_before: number;
  issues_after: number;
  assignment_changes: number;
  unassigned_changes: number;
  issue_changes: number;
  newly_assigned_work_orders: number;
  newly_unassigned_work_orders: number;
};

export type PlanRunComparison = {
  baseline_run: PlanRunReference;
  candidate_run: PlanRunReference;
  summary: PlanRunComparisonSummary;
  assignment_changes: PlanRunAssignmentChange[];
  unassigned_changes: PlanRunUnassignedChange[];
  issue_changes: PlanRunIssueChange[];
};

export type PlanActualsReviewSummary = {
  assignments_total: number;
  assignments_not_started: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_completed: number;
  assignments_cancelled: number;
  delayed_start_count: number;
  overdue_completion_count: number;
  blocked_event_count: number;
  total_duration_variance_minutes: number;
};

export type PlanActualsReviewItem = {
  assignment_id: string;
  work_order_id: string;
  work_order_title: string;
  worker_id: string;
  worker_name: string;
  assignment_status: string;
  execution_status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  start_variance_minutes: number | null;
  completion_variance_minutes: number | null;
  duration_variance_minutes: number | null;
  blocked_event_count: number;
  latest_event_type: string | null;
  latest_event_at: string | null;
  latest_event_note: string | null;
};

export type PlanActualsReview = {
  run: PlanRunReference;
  summary: PlanActualsReviewSummary;
  items: PlanActualsReviewItem[];
  blocked_reason_counts: { reason_code: string; count: number }[];
  worker_breakdown: {
    label: string;
    assignments_total: number;
    assignments_completed: number;
    assignments_in_progress: number;
    assignments_blocked: number;
    assignments_not_started: number;
    assignments_cancelled: number;
    delayed_start_count: number;
    overdue_completion_count: number;
    blocked_event_count: number;
    total_duration_variance_minutes: number;
  }[];
  location_breakdown: {
    label: string;
    assignments_total: number;
    assignments_completed: number;
    assignments_in_progress: number;
    assignments_blocked: number;
    assignments_not_started: number;
    assignments_cancelled: number;
    delayed_start_count: number;
    overdue_completion_count: number;
    blocked_event_count: number;
    total_duration_variance_minutes: number;
  }[];
  work_type_breakdown: {
    label: string;
    assignments_total: number;
    assignments_completed: number;
    assignments_in_progress: number;
    assignments_blocked: number;
    assignments_not_started: number;
    assignments_cancelled: number;
    delayed_start_count: number;
    overdue_completion_count: number;
    blocked_event_count: number;
    total_duration_variance_minutes: number;
  }[];
};

export type OperationsReportFilters = {
  window_start: string | null;
  window_end: string | null;
  location_id: string | null;
  planning_unit_id: string | null;
};

export type OperationsReportSummary = {
  published_runs_count: number;
  assignments_total: number;
  assignments_completed: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_not_started: number;
  assignments_cancelled: number;
  delayed_start_count: number;
  overdue_completion_count: number;
  blocked_event_count: number;
  total_planned_minutes: number;
  total_actual_minutes: number;
  total_duration_variance_minutes: number;
  active_worker_reservations: number;
  active_equipment_reservations: number;
  active_material_reservations: number;
  active_reserved_material_units: number;
  consumed_material_units: number;
};

export type OperationsPublishedRunItem = {
  run_id: string;
  scenario_name: string;
  published_at: string | null;
  published_by_name: string | null;
  assignments_total: number;
  assignments_completed: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_not_started: number;
  assignments_cancelled: number;
  blocked_event_count: number;
  active_reservations: number;
};

export type OperationsWorkerBreakdownItem = {
  worker_id: string;
  worker_name: string;
  assignments_total: number;
  assignments_completed: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_not_started: number;
  assignments_cancelled: number;
  blocked_event_count: number;
  planned_minutes: number;
  actual_minutes: number;
  active_reservations: number;
};

export type OperationsLocationBreakdownItem = {
  location_id: string | null;
  location_name: string;
  assignments_total: number;
  assignments_completed: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_not_started: number;
  assignments_cancelled: number;
  blocked_event_count: number;
  planned_minutes: number;
  actual_minutes: number;
  active_reservations: number;
};

export type OperationsMaterialBreakdownItem = {
  material_id: string;
  material_code: string;
  material_name: string;
  location_id: string;
  location_name: string;
  assignments_total: number;
  on_hand_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  active_reserved_quantity: number;
  consumed_quantity: number;
};

export type OperationsEquipmentBreakdownItem = {
  equipment_id: string;
  equipment_code: string;
  equipment_type_code: string;
  equipment_type_name: string;
  location_id: string;
  location_name: string;
  assignments_total: number;
  active_reservations: number;
  reserved_minutes: number;
};

export type OperationsAssignmentRow = {
  run_id: string;
  scenario_name: string;
  published_at: string | null;
  work_order_id: string;
  work_order_title: string;
  location_id: string | null;
  location_name: string | null;
  planning_unit_id: string | null;
  planning_unit_name: string | null;
  worker_id: string;
  worker_name: string;
  assignment_status: string;
  execution_status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  planned_duration_minutes: number | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_duration_minutes: number | null;
  start_variance_minutes: number | null;
  completion_variance_minutes: number | null;
  duration_variance_minutes: number | null;
  blocked_event_count: number;
  active_worker_reservation: boolean;
  active_equipment_reservations: number;
  active_material_reserved_quantity: number;
  consumed_material_quantity: number;
  reserved_equipment_ids: string[];
  reserved_material_quantities: Record<string, number>;
};

export type OperationsBottleneckItem = {
  category: "worker" | "location" | "material" | "equipment";
  label: string;
  secondary_label: string | null;
  detail: string;
  severity_score: number;
  assignments_total: number;
  assignments_blocked: number;
  blocked_event_count: number;
  delayed_start_count: number;
  active_reservations: number;
  utilization_percent: number | null;
};

export type OperationsTrendPoint = {
  bucket_start: string;
  bucket_end: string;
  bucket_label: string;
  assignments_total: number;
  assignments_completed: number;
  assignments_in_progress: number;
  assignments_blocked: number;
  assignments_not_started: number;
  assignments_cancelled: number;
  blocked_event_count: number;
  total_planned_minutes: number;
  total_actual_minutes: number;
  total_duration_variance_minutes: number;
  active_worker_reservations: number;
  active_equipment_reservations: number;
  active_material_reserved_units: number;
  consumed_material_units: number;
  equipment_reserved_minutes: number;
};

export type OperationsReport = {
  filters: OperationsReportFilters;
  summary: OperationsReportSummary;
  published_runs: OperationsPublishedRunItem[];
  worker_breakdown: OperationsWorkerBreakdownItem[];
  location_breakdown: OperationsLocationBreakdownItem[];
  material_breakdown: OperationsMaterialBreakdownItem[];
  equipment_breakdown: OperationsEquipmentBreakdownItem[];
  bottlenecks: OperationsBottleneckItem[];
  trend_granularity: "day" | "week";
  trends: OperationsTrendPoint[];
  assignment_rows: OperationsAssignmentRow[];
};
