"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCheck,
  ClipboardList,
  Clock3,
  CopyPlus,
  GitCompareArrows,
  HardHat,
  Send,
  ShieldCheck,
  SquarePen,
  Play,
  RotateCcw,
  ScanSearch,
  Waypoints,
  Wrench,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { ApiError, apiDelete, apiRequest } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import {
  assignmentChangeActions,
  buildEquipmentHref,
  buildMaterialsHref,
  buildPlannerResultsHref,
  buildPlannerRunHref,
  buildWorkOrdersHref,
  buildWorkersHref,
  groupPlannerIssues,
  groupUnassignedWork,
  issueChangeActions,
  summarizePlannerOutcome,
  unassignedChangeActions,
} from "@/lib/planner-review";
import type {
  CandidateAssignment,
  PlanActualsReview,
  PlanAssignment,
  PlanAssignmentBulkHandoffAction,
  PlanAssignmentBulkHandoffResult,
  PlanAssignmentCancellationAction,
  PlanAssignmentEvent,
  PlanAssignmentOverrideUpdate,
  PlanDispatchQueue,
  PlanDispatchQueueApplyAction,
  PlanDispatchQueueApplyResult,
  PlanDispatchQueueCreate,
  PlanDispatchQueueTemplate,
  PlanDispatchQueueTemplateCreate,
  PlanAssignmentReassignmentAction,
  PlanRun,
  PlanRunAssignmentChange,
  PlanRunComparison,
  PlanRunIssueChange,
  PlanRunUnassignedChange,
  PlanScenario,
  User,
  Worker,
  WorkOrder,
} from "@/lib/api/types";

type OverrideFormState = {
  worker_id: string;
  crew_worker_ids: string[];
  scheduled_start_at: string;
  scheduled_end_at: string;
  override_reason: string;
  override_note: string;
};

type ExecutionEventFormState = {
  occurred_at: string;
  note: string;
  reason_code: string;
};

type CancellationFormState = {
  occurred_at: string;
  reason: string;
  note: string;
};

type BulkHandoffFormState = {
  handoff_status: "pending" | "ready" | "sent" | "acknowledged";
  occurred_at: string;
  note: string;
};

type DispatchQueueFormState = {
  name: string;
  description: string;
  assignment_status: "any" | "published" | "cancelled";
  execution_status: "any" | "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
  handoff_status: "any" | "pending" | "ready" | "sent" | "acknowledged";
  canned_handoff_status: "none" | "pending" | "ready" | "sent" | "acknowledged";
  allowed_role_codes: string;
};

type DispatchQueueTemplateFormState = {
  name: string;
  description: string;
  assignment_status: "any" | "published" | "cancelled";
  execution_status: "any" | "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
  handoff_status: "any" | "pending" | "ready" | "sent" | "acknowledged";
  canned_handoff_status: "none" | "pending" | "ready" | "sent" | "acknowledged";
  allowed_role_codes: string;
};

type DispatchQueueActionFormState = {
  handoff_status: "queue_default" | "pending" | "ready" | "sent" | "acknowledged";
  occurred_at: string;
  note: string;
};

type DispatchQueueTemplateActionFormState = {
  handoff_status: "template_default" | "pending" | "ready" | "sent" | "acknowledged";
  occurred_at: string;
  note: string;
};

const BLOCKED_REASON_OPTIONS = [
  { value: "site_access", label: "Site access" },
  { value: "materials_shortage", label: "Materials shortage" },
  { value: "equipment_unavailable", label: "Equipment unavailable" },
  { value: "worker_unavailable", label: "Worker unavailable" },
  { value: "dependency_wait", label: "Dependency wait" },
  { value: "safety_hold", label: "Safety hold" },
  { value: "weather", label: "Weather" },
  { value: "other", label: "Other" },
] as const;

function changeTone(changeType: "added" | "removed" | "modified") {
  if (changeType === "added") {
    return "success" as const;
  }
  if (changeType === "removed") {
    return "danger" as const;
  }
  return "warning" as const;
}

function issueTone(changeType: "added" | "removed") {
  return changeType === "added" ? ("warning" as const) : ("success" as const);
}

function changeLabel(changeType: "added" | "removed" | "modified") {
  if (changeType === "added") {
    return "Added";
  }
  if (changeType === "removed") {
    return "Removed";
  }
  return "Modified";
}

function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}

function formatVarianceMinutes(value: number | null): string {
  if (value === null) {
    return "Not recorded";
  }
  if (value > 0) {
    return `+${value} min`;
  }
  if (value < 0) {
    return `${value} min`;
  }
  return "On plan";
}

function varianceTone(value: number | null) {
  if (value === null) {
    return "neutral" as const;
  }
  if (value > 0) {
    return "warning" as const;
  }
  if (value < 0) {
    return "success" as const;
  }
  return "success" as const;
}

function formatChangedFields(fields: string[]): string {
  if (fields.length === 0) {
    return "No field diff";
  }

  return fields
    .map((field) => field.replaceAll("_", " "))
    .join(", ");
}

function formatAssignmentSnapshot(assignment: CandidateAssignment | null): string {
  if (!assignment) {
    return "No assignment";
  }

  const materialCount = Object.keys(assignment.reserved_material_quantities).length;
  const equipmentCount = assignment.reserved_equipment_ids.length;

  return [
    assignment.crew_worker_names.length > 1
      ? assignment.crew_worker_names.join(", ")
      : assignment.worker_name,
    `${formatDateTime(assignment.scheduled_start_at)} -> ${formatDateTime(assignment.scheduled_end_at)}`,
    `${materialCount} material reservations`,
    `${equipmentCount} equipment reservations`,
  ].join(" · ");
}

function formatDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];

  return `${parts.join("-")}T${time.join(":")}`;
}

function parseDateTimeLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseRoleCodesInput(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function formatRoleCodesInput(roleCodes: string[]): string {
  return roleCodes.join(", ");
}

function reviewStatusTone(status: string) {
  if (status === "approved") {
    return "success" as const;
  }
  if (status === "failed") {
    return "danger" as const;
  }
  return "warning" as const;
}

function publicationStatusTone(status: string) {
  if (status === "published") {
    return "success" as const;
  }
  if (status === "failed") {
    return "danger" as const;
  }
  return "warning" as const;
}

function assignmentStatusTone(status: string) {
  if (status === "published") {
    return "success" as const;
  }
  if (status === "cancelled") {
    return "danger" as const;
  }
  return "warning" as const;
}

function assignmentSourceTone(sourceKind: string) {
  if (sourceKind === "manual_override" || sourceKind === "published_reassignment") {
    return "warning" as const;
  }
  if (sourceKind === "published_cancellation") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function executionStatusTone(status: string) {
  if (status === "completed") {
    return "success" as const;
  }
  if (status === "blocked") {
    return "danger" as const;
  }
  if (status === "in_progress") {
    return "warning" as const;
  }
  if (status === "cancelled") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function handoffStatusTone(status: string) {
  if (status === "acknowledged") {
    return "success" as const;
  }
  if (status === "sent") {
    return "warning" as const;
  }
  if (status === "ready") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function handoffStatusLabel(status: string) {
  if (status === "ready") {
    return "handoff: ready";
  }
  if (status === "sent") {
    return "handoff: sent";
  }
  if (status === "acknowledged") {
    return "handoff: acknowledged";
  }
  return "handoff: pending";
}

function executionEventTone(eventType: PlanAssignmentEvent["event_type"]) {
  if (eventType === "completed") {
    return "success" as const;
  }
  if (eventType === "blocked") {
    return "danger" as const;
  }
  if (eventType === "cancelled") {
    return "danger" as const;
  }
  return "warning" as const;
}

function executionEventLabel(eventType: PlanAssignmentEvent["event_type"]) {
  if (eventType === "started") {
    return "Started";
  }
  if (eventType === "blocked") {
    return "Blocked";
  }
  if (eventType === "reassigned") {
    return "Reassigned";
  }
  if (eventType === "cancelled") {
    return "Cancelled";
  }
  if (eventType === "handoff_updated") {
    return "Handoff updated";
  }
  return "Completed";
}

function blockedReasonLabel(reasonCode: string | null | undefined): string {
  if (!reasonCode) {
    return "Unspecified";
  }
  return (
    BLOCKED_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label
    ?? reasonCode.replaceAll("_", " ")
  );
}

function buildSelectionHref(
  organizationId: string,
  runId: string,
  compareToRunId?: string | null,
): string {
  return buildPlannerResultsHref(organizationId, {
    runId,
    compareToRunId,
  });
}

function findWorkOrderTitle(workOrders: WorkOrder[], workOrderId: string): string {
  return workOrders.find((workOrder) => workOrder.id === workOrderId)?.title ?? workOrderId;
}

function AssignmentChangeRow({
  organizationId,
  workOrders,
  change,
}: {
  organizationId: string;
  workOrders: WorkOrder[];
  change: PlanRunAssignmentChange;
}) {
  return (
    <tr key={change.work_order_id}>
      <td>
        <Link
          className="inline-link"
          href={buildWorkOrdersHref(organizationId, change.work_order_id)}
        >
          {change.work_order_title ?? findWorkOrderTitle(workOrders, change.work_order_id)}
        </Link>
      </td>
      <td>
        <StatusChip value={changeLabel(change.change_type)} tone={changeTone(change.change_type)} />
      </td>
      <td>
        <div className="table-copy">
          <strong>
            {change.baseline_assignment?.worker_name ?? "No worker in baseline"}
          </strong>
          <p>{formatAssignmentSnapshot(change.baseline_assignment)}</p>
        </div>
      </td>
      <td>
        <div className="table-copy">
          <strong>
            {change.candidate_assignment?.worker_name ?? "No worker in candidate"}
          </strong>
          <p>{formatAssignmentSnapshot(change.candidate_assignment)}</p>
        </div>
      </td>
      <td>
        <div className="table-copy">
          <strong>{formatChangedFields(change.changed_fields)}</strong>
          <p>
            {assignmentChangeActions(organizationId, change)
              .map((action) => action.label)
              .join(" · ")}
          </p>
        </div>
      </td>
    </tr>
  );
}

function UnassignedChangeItem({
  organizationId,
  workOrders,
  change,
}: {
  organizationId: string;
  workOrders: WorkOrder[];
  change: PlanRunUnassignedChange;
}) {
  const actions = unassignedChangeActions(organizationId, change);

  return (
    <li key={change.work_order_id} className="review-list__item">
      <div className="review-list__copy">
        <strong>
          {change.work_order_title ?? findWorkOrderTitle(workOrders, change.work_order_id)}
        </strong>
        <p>
          Before: {change.baseline_reason ?? "Not unassigned"}
          <br />
          After: {change.candidate_reason ?? "No longer unassigned"}
        </p>
      </div>
      <div className="inline-actions">
        <StatusChip value={changeLabel(change.change_type)} tone={changeTone(change.change_type)} />
        {actions.map((action) => (
          <Link
            key={`${change.work_order_id}-${action.href}`}
            className="ghost-link"
            href={action.href}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </li>
  );
}

function IssueChangeItem({
  organizationId,
  change,
}: {
  organizationId: string;
  change: PlanRunIssueChange;
}) {
  const actions = issueChangeActions(organizationId, change);

  return (
    <li key={`${change.change_type}-${change.message}`} className="review-list__item">
      <div className="review-list__copy">
        <strong>{change.message}</strong>
        <p>
          {change.change_type === "added"
            ? "This warning is new in the candidate run."
            : "This warning was resolved in the candidate run."}
        </p>
      </div>
      <div className="inline-actions">
        <StatusChip
          value={change.change_type === "added" ? "New issue" : "Resolved"}
          tone={issueTone(change.change_type)}
        />
        {actions.map((action) => (
          <Link
            key={`${change.message}-${action.href}`}
            className="ghost-link"
            href={action.href}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function PlannerResultsPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const requestedRunId = searchParams.get("runId");
  const requestedCompareRunId = searchParams.get("compareToRunId");
  const [planRun, setPlanRun] = useState<PlanRun | null>(null);
  const [comparison, setComparison] = useState<PlanRunComparison | null>(null);
  const [actualsReview, setActualsReview] = useState<PlanActualsReview | null>(null);
  const [dispatchQueues, setDispatchQueues] = useState<PlanDispatchQueue[]>([]);
  const [dispatchQueueTemplates, setDispatchQueueTemplates] = useState<PlanDispatchQueueTemplate[]>([]);
  const [selectedDispatchQueueId, setSelectedDispatchQueueId] = useState<string | null>(null);
  const [selectedDispatchQueueAssignments, setSelectedDispatchQueueAssignments] = useState<PlanAssignment[]>([]);
  const [selectedDispatchQueueTemplateId, setSelectedDispatchQueueTemplateId] = useState<string | null>(null);
  const [selectedDispatchQueueTemplateAssignments, setSelectedDispatchQueueTemplateAssignments] = useState<PlanAssignment[]>([]);
  const [recentRuns, setRecentRuns] = useState<PlanRun[]>([]);
  const [assignments, setAssignments] = useState<PlanAssignment[]>([]);
  const [assignmentEvents, setAssignmentEvents] = useState<PlanAssignmentEvent[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    worker_id: "",
    crew_worker_ids: [],
    scheduled_start_at: "",
    scheduled_end_at: "",
    override_reason: "",
    override_note: "",
  });
  const [executionActorName, setExecutionActorName] = useState("local-planner");
  const [executionActorUserId, setExecutionActorUserId] = useState("");
  const [executionEventForm, setExecutionEventForm] = useState<ExecutionEventFormState>({
    occurred_at: "",
    note: "",
    reason_code: BLOCKED_REASON_OPTIONS[0].value,
  });
  const [cancellationForm, setCancellationForm] = useState<CancellationFormState>({
    occurred_at: "",
    reason: "",
    note: "",
  });
  const [bulkHandoffForm, setBulkHandoffForm] = useState<BulkHandoffFormState>({
    handoff_status: "ready",
    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
    note: "",
  });
  const [dispatchQueueForm, setDispatchQueueForm] = useState<DispatchQueueFormState>({
    name: "",
    description: "",
    assignment_status: "published",
    execution_status: "blocked",
    handoff_status: "pending",
    canned_handoff_status: "ready",
    allowed_role_codes: "",
  });
  const [dispatchQueueTemplateForm, setDispatchQueueTemplateForm] = useState<DispatchQueueTemplateFormState>({
    name: "",
    description: "",
    assignment_status: "published",
    execution_status: "not_started",
    handoff_status: "pending",
    canned_handoff_status: "ready",
    allowed_role_codes: "dispatch_manager",
  });
  const [dispatchQueueActionForm, setDispatchQueueActionForm] = useState<DispatchQueueActionFormState>({
    handoff_status: "queue_default",
    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
    note: "",
  });
  const [dispatchQueueTemplateActionForm, setDispatchQueueTemplateActionForm] = useState<DispatchQueueTemplateActionFormState>({
    handoff_status: "template_default",
    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
    note: "",
  });
  const [approvalNote, setApprovalNote] = useState("");
  const [activeComparisonRunId, setActiveComparisonRunId] = useState("");
  const [showDispatchTools, setShowDispatchTools] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, startActionTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [
          workOrdersResponse,
          recentRunsResponse,
          workersResponse,
          usersResponse,
          dispatchQueueTemplatesResponse,
        ] = await Promise.all([
          apiRequest<WorkOrder[]>(`/organizations/${organizationId}/work-orders`),
          apiRequest<PlanRun[]>(`/organizations/${organizationId}/plan-runs`),
          apiRequest<Worker[]>(`/organizations/${organizationId}/workers`),
          apiRequest<User[]>(`/organizations/${organizationId}/users`),
          apiRequest<PlanDispatchQueueTemplate[]>(
            `/organizations/${organizationId}/dispatch-queue-templates`,
          ),
        ]);

        let selectedRun: PlanRun | null = recentRunsResponse[0] ?? null;
        if (requestedRunId) {
          try {
            selectedRun = await apiRequest<PlanRun>(
              `/organizations/${organizationId}/plan-runs/${requestedRunId}`,
            );
          } catch (runError) {
            if (!(runError instanceof ApiError) || runError.status !== 404) {
              throw runError;
            }
          }
        }

        let nextComparisonRunId = "";
        if (selectedRun) {
          const defaultComparisonRunId =
            recentRunsResponse.find((runItem) => runItem.id !== selectedRun.id)?.id ?? "";

          if (requestedCompareRunId === "none") {
            nextComparisonRunId = "";
          } else if (requestedCompareRunId) {
            nextComparisonRunId = requestedCompareRunId;
          } else {
            nextComparisonRunId = defaultComparisonRunId;
          }
        }

        if (selectedRun && nextComparisonRunId === selectedRun.id) {
          nextComparisonRunId = "";
        }

        let assignmentsResponse: PlanAssignment[] = [];
        let dispatchQueuesResponse: PlanDispatchQueue[] = [];
        if (selectedRun) {
          [assignmentsResponse, dispatchQueuesResponse] = await Promise.all([
            apiRequest<PlanAssignment[]>(
              `/organizations/${organizationId}/plan-runs/${selectedRun.id}/assignments`,
            ),
            apiRequest<PlanDispatchQueue[]>(
              `/organizations/${organizationId}/plan-runs/${selectedRun.id}/dispatch-queues`,
            ),
          ]);
        }

        let actualsReviewResponse: PlanActualsReview | null = null;
        if (selectedRun?.publication_status === "published") {
          actualsReviewResponse = await apiRequest<PlanActualsReview>(
            `/organizations/${organizationId}/plan-runs/${selectedRun.id}/actuals-review`,
          );
        }

        let comparisonResponse: PlanRunComparison | null = null;
        if (selectedRun && nextComparisonRunId) {
          try {
            comparisonResponse = await apiRequest<PlanRunComparison>(
              `/organizations/${organizationId}/plan-runs/compare?baseline_run_id=${nextComparisonRunId}&candidate_run_id=${selectedRun.id}`,
            );
          } catch (comparisonError) {
            if (
              !(comparisonError instanceof ApiError)
              || (comparisonError.status !== 404 && comparisonError.status !== 422)
            ) {
              throw comparisonError;
            }
            nextComparisonRunId = "";
          }
        }

        if (cancelled) {
          return;
        }

        setWorkOrders(workOrdersResponse);
        setRecentRuns(recentRunsResponse);
        setWorkers(workersResponse);
        setUsers(usersResponse);
        setPlanRun(selectedRun);
        setAssignments(assignmentsResponse);
        setDispatchQueues(dispatchQueuesResponse);
        setDispatchQueueTemplates(dispatchQueueTemplatesResponse);
        setActualsReview(actualsReviewResponse);
        setComparison(comparisonResponse);
        setActiveComparisonRunId(nextComparisonRunId);
        setSelectedDispatchQueueId((currentSelectedQueueId) => {
          if (
            currentSelectedQueueId
            && dispatchQueuesResponse.some((queue) => queue.id === currentSelectedQueueId)
          ) {
            return currentSelectedQueueId;
          }
          return dispatchQueuesResponse[0]?.id ?? null;
        });
        setSelectedDispatchQueueTemplateId((currentSelectedTemplateId) => {
          if (
            currentSelectedTemplateId
            && dispatchQueueTemplatesResponse.some((template) => template.id === currentSelectedTemplateId)
          ) {
            return currentSelectedTemplateId;
          }
          return dispatchQueueTemplatesResponse[0]?.id ?? null;
        });
        setSelectedAssignmentId((currentSelectedAssignmentId) => {
          if (
            currentSelectedAssignmentId
            && assignmentsResponse.some((assignment) => assignment.id === currentSelectedAssignmentId)
          ) {
            return currentSelectedAssignmentId;
          }
          return assignmentsResponse[0]?.id ?? null;
        });
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load plan-run details.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId, requestedRunId, requestedCompareRunId]);

  useEffect(() => {
    if (!planRun) {
      setApprovalNote("");
      return;
    }

    setApprovalNote(planRun.approval_note ?? "");
  }, [planRun]);

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0] ?? null;
  const selectedAssignmentCrewSize = selectedAssignment ? Math.max(1, selectedAssignment.crew_size_required) : 1;
  const selectedAssignmentCrewIds = selectedAssignment
    ? selectedAssignment.crew_worker_ids.length > 0
      ? selectedAssignment.crew_worker_ids
      : [selectedAssignment.worker_id]
    : [];

  useEffect(() => {
    setSelectedAssignmentIds((currentSelectedIds) => {
      const validSelectedIds = currentSelectedIds.filter((assignmentId) =>
        assignments.some((assignment) => assignment.id === assignmentId),
      );
      if (validSelectedIds.length > 0) {
        return validSelectedIds;
      }
      if (selectedAssignment?.id) {
        return [selectedAssignment.id];
      }
      return [];
    });
  }, [assignments, selectedAssignment?.id]);

  useEffect(() => {
    if (!selectedAssignment) {
      setOverrideForm({
        worker_id: "",
        crew_worker_ids: [],
        scheduled_start_at: "",
        scheduled_end_at: "",
        override_reason: "",
        override_note: "",
      });
      setCancellationForm({
        occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
        reason: "",
        note: "",
      });
      return;
    }

    setOverrideForm({
      worker_id: selectedAssignment.worker_id,
      crew_worker_ids:
        selectedAssignment.crew_worker_ids.length > 0
          ? selectedAssignment.crew_worker_ids
          : [selectedAssignment.worker_id],
      scheduled_start_at: formatDateTimeLocalInput(selectedAssignment.scheduled_start_at),
      scheduled_end_at: formatDateTimeLocalInput(selectedAssignment.scheduled_end_at),
      override_reason: selectedAssignment.override_reason ?? "",
      override_note: selectedAssignment.override_note ?? "",
    });
    setCancellationForm({
      occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
      reason: "",
      note: "",
    });
  }, [selectedAssignment]);

  useEffect(() => {
    const runId = planRun?.id;

    if (!selectedAssignment || planRun?.publication_status !== "published" || !runId) {
      setAssignmentEvents([]);
      setExecutionEventForm({
        occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
        note: "",
        reason_code: BLOCKED_REASON_OPTIONS[0].value,
      });
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await apiRequest<PlanAssignmentEvent[]>(
          `/organizations/${organizationId}/plan-runs/${runId}/assignments/${selectedAssignment.id}/events`,
        );
        if (cancelled) {
          return;
        }
        setAssignmentEvents(response);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load assignment execution events.",
        );
      }
    }

    void loadEvents();

    setExecutionEventForm({
      occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
      note: "",
      reason_code: BLOCKED_REASON_OPTIONS[0].value,
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, planRun?.id, planRun?.publication_status, planRun?.updated_at, selectedAssignment]);

  useEffect(() => {
    const runId = planRun?.id;
    const queueId = selectedDispatchQueueId;

    if (!runId || !queueId) {
      setSelectedDispatchQueueAssignments([]);
      return;
    }

    let cancelled = false;

    async function loadQueueAssignments() {
      try {
        const response = await apiRequest<PlanAssignment[]>(
          `/organizations/${organizationId}/plan-runs/${runId}/dispatch-queues/${queueId}/assignments`,
        );
        if (cancelled) {
          return;
        }
        setSelectedDispatchQueueAssignments(response);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setSelectedDispatchQueueAssignments([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load saved dispatch queue assignments.",
        );
      }
    }

    void loadQueueAssignments();

    return () => {
      cancelled = true;
    };
  }, [organizationId, planRun?.id, selectedDispatchQueueId]);

  useEffect(() => {
    const runId = planRun?.id;
    const templateId = selectedDispatchQueueTemplateId;

    if (!runId || !templateId) {
      setSelectedDispatchQueueTemplateAssignments([]);
      return;
    }

    let cancelled = false;

    async function loadTemplateAssignments() {
      try {
        const response = await apiRequest<PlanAssignment[]>(
          `/organizations/${organizationId}/plan-runs/${runId}/dispatch-queue-templates/${templateId}/assignments`,
        );
        if (cancelled) {
          return;
        }
        setSelectedDispatchQueueTemplateAssignments(response);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setSelectedDispatchQueueTemplateAssignments([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load dispatch queue template assignments.",
        );
      }
    }

    void loadTemplateAssignments();

    return () => {
      cancelled = true;
    };
  }, [organizationId, planRun?.id, selectedDispatchQueueTemplateId]);

  useEffect(() => {
    if (!selectedDispatchQueueTemplateId) {
      return;
    }
    const template = dispatchQueueTemplates.find(
      (templateItem) => templateItem.id === selectedDispatchQueueTemplateId,
    );
    if (!template) {
      return;
    }
    setDispatchQueueTemplateForm({
      name: template.name,
      description: template.description ?? "",
      assignment_status: template.assignment_statuses[0] === "published"
        || template.assignment_statuses[0] === "cancelled"
        ? template.assignment_statuses[0]
        : "any",
      execution_status:
        template.execution_statuses[0] === "not_started"
        || template.execution_statuses[0] === "in_progress"
        || template.execution_statuses[0] === "blocked"
        || template.execution_statuses[0] === "completed"
        || template.execution_statuses[0] === "cancelled"
          ? template.execution_statuses[0]
          : "any",
      handoff_status:
        template.handoff_statuses[0] === "pending"
        || template.handoff_statuses[0] === "ready"
        || template.handoff_statuses[0] === "sent"
        || template.handoff_statuses[0] === "acknowledged"
          ? template.handoff_statuses[0]
          : "any",
      canned_handoff_status: template.canned_handoff_status ?? "none",
      allowed_role_codes: formatRoleCodesInput(template.allowed_role_codes),
    });
    setDispatchQueueTemplateActionForm({
      handoff_status: "template_default",
      occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
      note: "",
    });
  }, [dispatchQueueTemplates, selectedDispatchQueueTemplateId]);

  const reviewStats = planRun ? summarizePlannerOutcome(planRun.summary) : null;
  const issueGroups = planRun
    ? groupPlannerIssues(organizationId, planRun.summary.issues)
    : [];
  const unassignedGroups = planRun
    ? groupUnassignedWork(organizationId, planRun.summary.unassigned)
    : [];
  const comparisonOptions = recentRuns.filter((run) => run.id !== planRun?.id);
  const recoveredWorkOrders =
    comparison?.unassigned_changes.filter((change) => change.change_type === "removed").length ?? 0;
  const newBlockedWorkOrders =
    comparison?.unassigned_changes.filter((change) => change.change_type === "added").length ?? 0;
  const editableWorkers = workers.filter((worker) => worker.status === "active");
  const canApprove = planRun
    ? planRun.status === "completed" && planRun.publication_status !== "published"
    : false;
  const canApproveCurrentDraft = canApprove && planRun?.review_status !== "approved";
  const canPublish =
    planRun?.review_status === "approved" && planRun.publication_status !== "published";
  const canOverrideAssignments = planRun ? planRun.publication_status !== "published" : false;
  const canReassignPublishedAssignment = Boolean(
    planRun
    && selectedAssignment
    && planRun.publication_status === "published"
    && selectedAssignment.assignment_status === "published"
    && selectedAssignment.execution_status !== "completed"
    && selectedAssignment.execution_status !== "in_progress",
  );
  const canCancelPublishedAssignment = Boolean(
    planRun
    && selectedAssignment
    && planRun.publication_status === "published"
    && selectedAssignment.assignment_status === "published"
    && selectedAssignment.execution_status !== "completed"
    && selectedAssignment.execution_status !== "in_progress",
  );
  const canCaptureExecution = planRun?.publication_status === "published";
  const canCaptureExecutionForSelection = Boolean(
    canCaptureExecution
    && selectedAssignment
    && selectedAssignment.assignment_status === "published",
  );
  const canEditAssignmentForm = canOverrideAssignments || canReassignPublishedAssignment;
  const normalizedOverrideCrewIds = Array.from(
    new Set(
      [overrideForm.worker_id, ...overrideForm.crew_worker_ids].filter(
        (workerId): workerId is string => Boolean(workerId),
      ),
    ),
  );
  const hasValidCrewSelection = selectedAssignment
    ? normalizedOverrideCrewIds.length === selectedAssignmentCrewSize
    : false;
  const selectedAssignmentIdSet = new Set(selectedAssignmentIds);
  const selectedAssignmentsForBulk = assignments.filter((assignment) =>
    selectedAssignmentIdSet.has(assignment.id),
  );
  const activeUsers = users.filter((user) => user.status === "active");
  const selectedActorUser =
    activeUsers.find((user) => user.id === executionActorUserId) ?? null;
  const selectedDispatchQueue =
    dispatchQueues.find((queue) => queue.id === selectedDispatchQueueId) ?? null;
  const selectedDispatchQueueTemplate =
    dispatchQueueTemplates.find((template) => template.id === selectedDispatchQueueTemplateId) ?? null;
  const selectedQueueActionHandoffStatus =
    dispatchQueueActionForm.handoff_status === "queue_default"
      ? (selectedDispatchQueue?.canned_handoff_status ?? null)
      : dispatchQueueActionForm.handoff_status;
  const selectedTemplateActionHandoffStatus =
    dispatchQueueTemplateActionForm.handoff_status === "template_default"
      ? (selectedDispatchQueueTemplate?.canned_handoff_status ?? null)
      : dispatchQueueTemplateActionForm.handoff_status;
  const publishedAssignmentIds = assignments
    .filter((assignment) => assignment.assignment_status === "published")
    .map((assignment) => assignment.id);
  const areAllPublishedAssignmentsSelected = publishedAssignmentIds.length > 0
    && publishedAssignmentIds.every((assignmentId) => selectedAssignmentIdSet.has(assignmentId));
  const selectedPublishedAssignmentsForHandoff = selectedAssignmentsForBulk.filter(
    (assignment) => assignment.assignment_status === "published",
  );
  const hasNonPublishedSelectionForHandoff = selectedAssignmentsForBulk.some(
    (assignment) => assignment.assignment_status !== "published",
  );
  const canApplyBulkHandoff = Boolean(
    planRun
    && planRun.publication_status === "published"
    && selectedPublishedAssignmentsForHandoff.length > 0
    && !hasNonPublishedSelectionForHandoff,
  );
  const canApplySelectedQueueAction = Boolean(
    planRun
    && planRun.publication_status === "published"
    && selectedDispatchQueue
    && selectedDispatchQueueAssignments.length > 0
    && selectedQueueActionHandoffStatus,
  );
  const canApplySelectedTemplateAction = Boolean(
    planRun
    && planRun.publication_status === "published"
    && selectedDispatchQueueTemplate
    && selectedDispatchQueueTemplateAssignments.length > 0
    && selectedTemplateActionHandoffStatus,
  );

  function replaceComparison(nextCompareRunId: string) {
    if (!planRun) {
      return;
    }

    router.replace(
      buildSelectionHref(
        organizationId,
        planRun.id,
        nextCompareRunId === "none" ? "none" : nextCompareRunId,
      ),
    );
  }

  async function refreshRunState(runId: string, compareRunId = activeComparisonRunId) {
    const [nextRun, nextAssignments, nextRecentRuns, nextDispatchQueues, nextDispatchQueueTemplates] = await Promise.all([
      apiRequest<PlanRun>(`/organizations/${organizationId}/plan-runs/${runId}`),
      apiRequest<PlanAssignment[]>(`/organizations/${organizationId}/plan-runs/${runId}/assignments`),
      apiRequest<PlanRun[]>(`/organizations/${organizationId}/plan-runs`),
      apiRequest<PlanDispatchQueue[]>(`/organizations/${organizationId}/plan-runs/${runId}/dispatch-queues`),
      apiRequest<PlanDispatchQueueTemplate[]>(
        `/organizations/${organizationId}/dispatch-queue-templates`,
      ),
    ]);

    let nextActualsReview: PlanActualsReview | null = null;
    if (nextRun.publication_status === "published") {
      nextActualsReview = await apiRequest<PlanActualsReview>(
        `/organizations/${organizationId}/plan-runs/${runId}/actuals-review`,
      );
    }

    let nextComparison: PlanRunComparison | null = null;
    let nextComparisonRunId = compareRunId;
    if (compareRunId) {
      try {
        nextComparison = await apiRequest<PlanRunComparison>(
          `/organizations/${organizationId}/plan-runs/compare?baseline_run_id=${compareRunId}&candidate_run_id=${runId}`,
        );
      } catch (comparisonError) {
        if (
          !(comparisonError instanceof ApiError)
          || (comparisonError.status !== 404 && comparisonError.status !== 422)
        ) {
          throw comparisonError;
        }
        nextComparisonRunId = "";
      }
    }

    setPlanRun(nextRun);
    setAssignments(nextAssignments);
    setDispatchQueues(nextDispatchQueues);
    setDispatchQueueTemplates(nextDispatchQueueTemplates);
    setActualsReview(nextActualsReview);
    setRecentRuns(nextRecentRuns);
    setComparison(nextComparison);
    setActiveComparisonRunId(nextComparisonRunId);
    setSelectedDispatchQueueId((currentSelectedQueueId) => {
      if (
        currentSelectedQueueId
        && nextDispatchQueues.some((queue) => queue.id === currentSelectedQueueId)
      ) {
        return currentSelectedQueueId;
      }
      return nextDispatchQueues[0]?.id ?? null;
    });
    setSelectedDispatchQueueTemplateId((currentSelectedTemplateId) => {
      if (
        currentSelectedTemplateId
        && nextDispatchQueueTemplates.some((template) => template.id === currentSelectedTemplateId)
      ) {
        return currentSelectedTemplateId;
      }
      return nextDispatchQueueTemplates[0]?.id ?? null;
    });
    setSelectedAssignmentId((currentSelectedAssignmentId) => {
      if (
        currentSelectedAssignmentId
        && nextAssignments.some((assignment) => assignment.id === currentSelectedAssignmentId)
      ) {
        return currentSelectedAssignmentId;
      }
      return nextAssignments[0]?.id ?? null;
    });
  }

  async function createExecutionEvent(eventType: "started" | "blocked" | "completed") {
    if (!planRun || !selectedAssignment) {
      return;
    }

    await apiRequest<PlanAssignmentEvent>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
      {
        method: "POST",
        body: JSON.stringify({
          event_type: eventType,
          occurred_at: parseDateTimeLocalInput(executionEventForm.occurred_at),
          actor_name: executionActorName.trim() || "local-planner",
          note: executionEventForm.note.trim() || null,
          reason_code: eventType === "blocked" ? executionEventForm.reason_code : null,
        }),
      },
    );

    await refreshRunState(planRun.id);
    const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
    );
    setAssignmentEvents(nextEvents);
  }

  async function reassignPublishedAssignment() {
    if (!planRun || !selectedAssignment) {
      return;
    }

    const crewWorkerIds =
      normalizedOverrideCrewIds.length > 0 ? normalizedOverrideCrewIds : [overrideForm.worker_id];
    const payload: PlanAssignmentReassignmentAction = {
      worker_id: overrideForm.worker_id,
      crew_worker_ids: crewWorkerIds,
      scheduled_start_at: parseDateTimeLocalInput(overrideForm.scheduled_start_at),
      scheduled_end_at: parseDateTimeLocalInput(overrideForm.scheduled_end_at),
      actor_name: executionActorName.trim() || "local-planner",
      reason: overrideForm.override_reason.trim(),
      note: overrideForm.override_note.trim() || null,
      occurred_at: null,
    };

    await apiRequest<PlanAssignment>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/reassign`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
    );
    setAssignmentEvents(nextEvents);
  }

  async function cancelPublishedAssignment() {
    if (!planRun || !selectedAssignment) {
      return;
    }

    const payload: PlanAssignmentCancellationAction = {
      actor_name: executionActorName.trim() || "local-planner",
      reason: cancellationForm.reason.trim(),
      note: cancellationForm.note.trim() || null,
      occurred_at: parseDateTimeLocalInput(cancellationForm.occurred_at),
    };

    await apiRequest<PlanAssignment>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
    );
    setAssignmentEvents(nextEvents);
  }

  async function applyBulkHandoffUpdate() {
    if (!planRun || selectedPublishedAssignmentsForHandoff.length === 0) {
      return;
    }

    const payload: PlanAssignmentBulkHandoffAction = {
      assignment_ids: selectedPublishedAssignmentsForHandoff.map((assignment) => assignment.id),
      handoff_status: bulkHandoffForm.handoff_status,
      actor_name: executionActorName.trim() || "local-planner",
      note: bulkHandoffForm.note.trim() || null,
      occurred_at: parseDateTimeLocalInput(bulkHandoffForm.occurred_at),
    };

    await apiRequest<PlanAssignmentBulkHandoffResult>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/handoff`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    if (selectedAssignment && payload.assignment_ids.includes(selectedAssignment.id)) {
      const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
        `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
      );
      setAssignmentEvents(nextEvents);
    }
  }

  async function createDispatchQueue() {
    if (!planRun) {
      return;
    }

    const payload: PlanDispatchQueueCreate = {
      name: dispatchQueueForm.name.trim(),
      description: dispatchQueueForm.description.trim() || null,
      status: "active",
      assignment_statuses:
        dispatchQueueForm.assignment_status === "any" ? [] : [dispatchQueueForm.assignment_status],
      execution_statuses:
        dispatchQueueForm.execution_status === "any" ? [] : [dispatchQueueForm.execution_status],
      handoff_statuses:
        dispatchQueueForm.handoff_status === "any" ? [] : [dispatchQueueForm.handoff_status],
      source_kinds: [],
      canned_handoff_status:
        dispatchQueueForm.canned_handoff_status === "none"
          ? null
          : dispatchQueueForm.canned_handoff_status,
      allowed_role_codes: parseRoleCodesInput(dispatchQueueForm.allowed_role_codes),
    };

    const createdQueue = await apiRequest<PlanDispatchQueue>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/dispatch-queues`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    await refreshRunState(planRun.id);
    setSelectedDispatchQueueId(createdQueue.id);
    setDispatchQueueForm((currentForm) => ({
      ...currentForm,
      name: "",
      description: "",
    }));
  }

  function resetDispatchQueueTemplateForm() {
    setSelectedDispatchQueueTemplateId(null);
    setDispatchQueueTemplateForm({
      name: "",
      description: "",
      assignment_status: "published",
      execution_status: "not_started",
      handoff_status: "pending",
      canned_handoff_status: "ready",
      allowed_role_codes: "dispatch_manager",
    });
  }

  async function createDispatchQueueTemplate() {
    if (!planRun) {
      return;
    }

    const payload: PlanDispatchQueueTemplateCreate = {
      name: dispatchQueueTemplateForm.name.trim(),
      description: dispatchQueueTemplateForm.description.trim() || null,
      status: "active",
      assignment_statuses:
        dispatchQueueTemplateForm.assignment_status === "any"
          ? []
          : [dispatchQueueTemplateForm.assignment_status],
      execution_statuses:
        dispatchQueueTemplateForm.execution_status === "any"
          ? []
          : [dispatchQueueTemplateForm.execution_status],
      handoff_statuses:
        dispatchQueueTemplateForm.handoff_status === "any"
          ? []
          : [dispatchQueueTemplateForm.handoff_status],
      source_kinds: [],
      canned_handoff_status:
        dispatchQueueTemplateForm.canned_handoff_status === "none"
          ? null
          : dispatchQueueTemplateForm.canned_handoff_status,
      allowed_role_codes: parseRoleCodesInput(dispatchQueueTemplateForm.allowed_role_codes),
    };

    const createdTemplate = await apiRequest<PlanDispatchQueueTemplate>(
      `/organizations/${organizationId}/dispatch-queue-templates`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    setSelectedDispatchQueueTemplateId(createdTemplate.id);
  }

  async function updateDispatchQueueTemplate() {
    if (!planRun || !selectedDispatchQueueTemplate) {
      return;
    }

    const payload: PlanDispatchQueueTemplateCreate = {
      name: dispatchQueueTemplateForm.name.trim(),
      description: dispatchQueueTemplateForm.description.trim() || null,
      status: "active",
      assignment_statuses:
        dispatchQueueTemplateForm.assignment_status === "any"
          ? []
          : [dispatchQueueTemplateForm.assignment_status],
      execution_statuses:
        dispatchQueueTemplateForm.execution_status === "any"
          ? []
          : [dispatchQueueTemplateForm.execution_status],
      handoff_statuses:
        dispatchQueueTemplateForm.handoff_status === "any"
          ? []
          : [dispatchQueueTemplateForm.handoff_status],
      source_kinds: [],
      canned_handoff_status:
        dispatchQueueTemplateForm.canned_handoff_status === "none"
          ? null
          : dispatchQueueTemplateForm.canned_handoff_status,
      allowed_role_codes: parseRoleCodesInput(dispatchQueueTemplateForm.allowed_role_codes),
    };

    await apiRequest<PlanDispatchQueueTemplate>(
      `/organizations/${organizationId}/dispatch-queue-templates/${selectedDispatchQueueTemplate.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
  }

  async function deleteDispatchQueueTemplate(templateId: string) {
    if (!planRun) {
      return;
    }

    await apiDelete(
      `/organizations/${organizationId}/dispatch-queue-templates/${templateId}`,
    );
    await refreshRunState(planRun.id);
  }

  async function instantiateDispatchQueueFromTemplate(templateId: string) {
    if (!planRun) {
      return;
    }

    const createdQueue = await apiRequest<PlanDispatchQueue>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/dispatch-queues`,
      {
        method: "POST",
        body: JSON.stringify({
          template_id: templateId,
        }),
      },
    );

    await refreshRunState(planRun.id);
    setSelectedDispatchQueueId(createdQueue.id);
  }

  async function deleteDispatchQueue(queueId: string) {
    if (!planRun) {
      return;
    }

    await apiDelete(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/dispatch-queues/${queueId}`,
    );
    await refreshRunState(planRun.id);
  }

  async function applySelectedDispatchQueueAction() {
    if (!planRun || !selectedDispatchQueue) {
      return;
    }

    const payload: PlanDispatchQueueApplyAction = {
      handoff_status:
        dispatchQueueActionForm.handoff_status === "queue_default"
          ? null
          : dispatchQueueActionForm.handoff_status,
      actor_name: executionActorName.trim() || "local-planner",
      actor_user_id: executionActorUserId.trim() || null,
      note: dispatchQueueActionForm.note.trim() || null,
      occurred_at: parseDateTimeLocalInput(dispatchQueueActionForm.occurred_at),
    };

    const result = await apiRequest<PlanDispatchQueueApplyResult>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/dispatch-queues/${selectedDispatchQueue.id}/apply-action`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    setSelectedAssignmentIds((currentSelectedIds) => Array.from(new Set([
      ...currentSelectedIds,
      ...result.updated_assignment_ids,
    ])));
    if (
      selectedAssignment
      && result.updated_assignment_ids.includes(selectedAssignment.id)
    ) {
      const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
        `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
      );
      setAssignmentEvents(nextEvents);
    }
  }

  async function applySelectedDispatchQueueTemplateAction() {
    if (!planRun || !selectedDispatchQueueTemplate) {
      return;
    }

    const payload: PlanDispatchQueueApplyAction = {
      handoff_status:
        dispatchQueueTemplateActionForm.handoff_status === "template_default"
          ? null
          : dispatchQueueTemplateActionForm.handoff_status,
      actor_name: executionActorName.trim() || "local-planner",
      actor_user_id: executionActorUserId.trim() || null,
      note: dispatchQueueTemplateActionForm.note.trim() || null,
      occurred_at: parseDateTimeLocalInput(dispatchQueueTemplateActionForm.occurred_at),
    };

    const result = await apiRequest<PlanDispatchQueueApplyResult>(
      `/organizations/${organizationId}/plan-runs/${planRun.id}/dispatch-queue-templates/${selectedDispatchQueueTemplate.id}/apply-action`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    await refreshRunState(planRun.id);
    setSelectedAssignmentIds((currentSelectedIds) => Array.from(new Set([
      ...currentSelectedIds,
      ...result.updated_assignment_ids,
    ])));
    if (
      selectedAssignment
      && result.updated_assignment_ids.includes(selectedAssignment.id)
    ) {
      const nextEvents = await apiRequest<PlanAssignmentEvent[]>(
        `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}/events`,
      );
      setAssignmentEvents(nextEvents);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Review"
        description="Fix draft. Publish plan."
        icon={Waypoints}
        actions={
          <div className="action-row">
            <Link className="ghost-link" href={buildPlannerRunHref(organizationId)}>
              Back to run
            </Link>
            {planRun ? (
              <button
                className="danger-button"
                type="button"
                disabled={isActionPending || planRun.publication_status === "published"}
                onClick={async () => {
                  try {
                    await apiDelete(`/organizations/${organizationId}/plan-runs/${planRun.id}`);
                    const nextRuns = await apiRequest<PlanRun[]>(
                      `/organizations/${organizationId}/plan-runs`,
                    );
                    setRecentRuns(nextRuns);
                    setPlanRun(nextRuns[0] ?? null);
                    setComparison(null);
                    setActiveComparisonRunId("");
                    router.replace(buildPlannerResultsHref(organizationId));
                    setError(null);
                  } catch (deleteError) {
                    setError(
                      deleteError instanceof Error
                        ? deleteError.message
                        : "Unable to delete the plan run.",
                    );
                  }
                }}
              >
                Delete run
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      {!planRun ? (
        <SectionCard title="No plan yet">
          <EmptyState
            title="Run plan"
            action={
              <Link className="primary-button" href={buildPlannerRunHref(organizationId)}>
                Run plan
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Run"
            actions={
              <div className="inline-actions">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isActionPending}
                  onClick={() => {
                    startActionTransition(async () => {
                      try {
                        const rerun = await apiRequest<PlanRun>(
                          `/organizations/${organizationId}/plan-runs/${planRun.id}/rerun`,
                          {
                            method: "POST",
                          },
                        );
                        router.push(
                          buildPlannerResultsHref(organizationId, {
                            runId: rerun.id,
                            compareToRunId: planRun.id,
                          }),
                        );
                      } catch (actionError) {
                        setError(
                          actionError instanceof Error
                            ? actionError.message
                            : "Unable to rerun the plan.",
                        );
                      }
                    });
                  }}
                >
                  <RotateCcw size={16} />
                  {isActionPending ? "Working..." : "Rerun draft"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isActionPending}
                  onClick={() => {
                    startActionTransition(async () => {
                      try {
                        const scenario = await apiRequest<PlanScenario>(
                          `/organizations/${organizationId}/plan-runs/${planRun.id}/save-scenario`,
                          {
                            method: "POST",
                          },
                        );
                        router.push(
                          buildPlannerRunHref(organizationId, {
                            scenarioId: scenario.id,
                          }),
                        );
                      } catch (actionError) {
                        setError(
                          actionError instanceof Error
                            ? actionError.message
                            : "Unable to save the run as a scenario.",
                        );
                      }
                    });
                  }}
                >
                  <CopyPlus size={16} />
                  Save as scenario
                </button>
              </div>
            }
          >
            <div className="chip-row">
              <StatusChip value={planRun.status} tone="success" />
              <StatusChip
                value={`review: ${planRun.review_status}`}
                tone={reviewStatusTone(planRun.review_status)}
              />
              <StatusChip
                value={`publication: ${planRun.publication_status}`}
                tone={publicationStatusTone(planRun.publication_status)}
              />
              <StatusChip value={planRun.scenario_name} />
              <StatusChip value={formatDateTime(planRun.created_at)} />
              <StatusChip value={planRun.run_kind} />
            </div>
            <ul className="plain-list">
              <li>
                Window: {formatDateTime(planRun.planning_request.window_start)} to{" "}
                {formatDateTime(planRun.planning_request.window_end)}
              </li>
              <li>{planRun.planning_request.location_ids.length} locations</li>
              <li>{planRun.planning_request.planning_unit_ids.length} planning units</li>
              <li>Workers: {planRun.planning_request.worker_statuses.join(", ") || "none"}</li>
              <li>Work orders: {planRun.planning_request.work_order_statuses.join(", ") || "none"}</li>
            </ul>
          </SectionCard>

          {reviewStats ? (
            <section className="metric-grid">
              <article className="metric-card metric-card--with-icon">
                <div className="icon-badge">
                  <Waypoints size={18} />
                </div>
                <p>Assignments</p>
                <strong>{reviewStats.assignments}</strong>
                <span>Scheduled work</span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="icon-badge icon-badge--warning">
                  <AlertTriangle size={18} />
                </div>
                <p>Unassigned</p>
                <strong>{reviewStats.unassigned}</strong>
                <span>Needs attention</span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="icon-badge">
                  <Wrench size={18} />
                </div>
                <p>Resource shortages</p>
                <strong>{reviewStats.resourceShortages}</strong>
                <span>Material or equipment</span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="icon-badge">
                  <HardHat size={18} />
                </div>
                <p>Workforce gaps</p>
                <strong>{reviewStats.workforceGaps}</strong>
                <span>Labor or schedule</span>
              </article>
            </section>
          ) : null}

          <section className="lifecycle-strip lifecycle-strip--results" aria-label="Run lifecycle">
            <div className="lifecycle-strip__state">
              <div className="icon-badge icon-badge--accent">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2>Lifecycle</h2>
                <p>
                  {planRun.publication_status === "published"
                    ? "Published"
                    : "Editable"}
                </p>
              </div>
            </div>
            <div className="lifecycle-strip__meta">
              <StatusChip
                value={`review: ${planRun.review_status}`}
                tone={reviewStatusTone(planRun.review_status)}
              />
              <StatusChip
                value={`publication: ${planRun.publication_status}`}
                tone={publicationStatusTone(planRun.publication_status)}
              />
              <StatusChip value={`approved: ${planRun.approved_by_name ?? "pending"}`} />
              <StatusChip value={`published: ${planRun.published_by_name ?? "pending"}`} />
            </div>
            <div className="lifecycle-strip__form">
              <label className="form-field">
                <span className="field-label">Actor</span>
                <input
                  className="form-input"
                  value={executionActorName}
                  onChange={(event) => setExecutionActorName(event.target.value)}
                  placeholder="dispatch-lead"
                />
              </label>
              <label className="form-field">
                <span className="field-label">User</span>
                <select
                  className="form-select"
                  value={executionActorUserId}
                  onChange={(event) => {
                    const nextUserId = event.target.value;
                    setExecutionActorUserId(nextUserId);
                    const matchedUser = activeUsers.find((user) => user.id === nextUserId);
                    if (matchedUser) {
                      setExecutionActorName(matchedUser.display_name);
                    }
                  }}
                >
                  <option value="">Name-only</option>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name} ({user.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Note</span>
                <input
                  className="form-input"
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder="Ready for dispatch."
                />
              </label>
            </div>
            <div className="lifecycle-strip__actions">
              <button
                className="ghost-button"
                type="button"
                disabled={isActionPending || !canApproveCurrentDraft}
                onClick={() => {
                  startActionTransition(async () => {
                    if (!planRun) {
                      return;
                    }
                    try {
                      const approvedRun = await apiRequest<PlanRun>(
                        `/organizations/${organizationId}/plan-runs/${planRun.id}/approve`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            actor_name: executionActorName.trim() || "local-planner",
                            note: approvalNote.trim() || null,
                          }),
                        },
                      );
                      await refreshRunState(approvedRun.id);
                      setError(null);
                    } catch (actionError) {
                      setError(
                        actionError instanceof Error
                          ? actionError.message
                          : "Unable to approve the run.",
                      );
                    }
                  });
                }}
              >
                <CheckCheck size={16} />
                {planRun.review_status === "approved" ? "Approved" : "Approve"}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isActionPending || !canPublish}
                onClick={() => {
                  startActionTransition(async () => {
                    if (!planRun) {
                      return;
                    }
                    try {
                      const publishedRun = await apiRequest<PlanRun>(
                        `/organizations/${organizationId}/plan-runs/${planRun.id}/publish`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            actor_name: executionActorName.trim() || "local-planner",
                          }),
                        },
                      );
                      await refreshRunState(publishedRun.id);
                      setError(null);
                    } catch (actionError) {
                      setError(
                        actionError instanceof Error
                          ? actionError.message
                          : "Unable to publish the run.",
                      );
                    }
                  });
                }}
              >
                <Send size={16} />
                {planRun.publication_status === "published" ? "Published" : "Publish"}
              </button>
            </div>
          </section>

          <section className="workspace-grid workspace-grid--wide-right results-workbench">
            <SectionCard
              title="Assignments"
            >
              {assignments.length === 0 ? (
                <EmptyState
                  title="No assignments"
                  body="Run another draft."
                />
              ) : (
                <div className="assignment-rail" aria-label="Assignments">
                  {assignments.map((assignment) => (
                    <button
                      key={assignment.id}
                      className={`assignment-rail__item${assignment.id === selectedAssignment?.id ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => setSelectedAssignmentId(assignment.id)}
                    >
                      <span>
                        <strong>{findWorkOrderTitle(workOrders, assignment.work_order_id)}</strong>
                        <small>
                          {assignment.crew_worker_ids.length > 1
                            ? `${assignment.crew_worker_names.join(", ")} (${assignment.crew_worker_ids.length})`
                            : assignment.worker_name_snapshot}
                        </small>
                      </span>
                      <span className="assignment-rail__meta">
                        <StatusChip
                          value={assignment.execution_status}
                          tone={executionStatusTone(assignment.execution_status)}
                        />
                        <StatusChip
                          value={handoffStatusLabel(assignment.dispatch_handoff_status)}
                          tone={handoffStatusTone(assignment.dispatch_handoff_status)}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Assignment"
            >
              {!selectedAssignment ? (
                <EmptyState
                  title="No assignment selected"
                  body="Select a row."
                />
              ) : (
                <div className="review-group-stack">
                  <article className="review-group">
                    <div className="review-group__header">
                      <div className="review-group__title">
                        <div className="icon-badge">
                          <SquarePen size={18} />
                        </div>
                        <div>
                          <h3>{findWorkOrderTitle(workOrders, selectedAssignment.work_order_id)}</h3>
                          <p>
                            {selectedAssignment.crew_worker_ids.length > 1 ? "Current crew" : "Current worker"}:{" "}
                            {selectedAssignment.crew_worker_names.length > 0
                              ? selectedAssignment.crew_worker_names.join(", ")
                              : selectedAssignment.worker_name_snapshot}{" "}
                            · Source:{" "}
                            {selectedAssignment.source_kind.replaceAll("_", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="inline-actions">
                        <StatusChip
                          value={selectedAssignment.assignment_status}
                          tone={assignmentStatusTone(selectedAssignment.assignment_status)}
                        />
                        <StatusChip
                          value={selectedAssignment.source_kind}
                          tone={assignmentSourceTone(selectedAssignment.source_kind)}
                        />
                        <StatusChip
                          value={`execution: ${selectedAssignment.execution_status}`}
                          tone={executionStatusTone(selectedAssignment.execution_status)}
                        />
                        <StatusChip
                          value={handoffStatusLabel(selectedAssignment.dispatch_handoff_status)}
                          tone={handoffStatusTone(selectedAssignment.dispatch_handoff_status)}
                        />
                      </div>
                    </div>
                    <div className="chip-row chip-row--tight">
                      {selectedAssignment.matched_skill_codes.map((code) => (
                        <StatusChip key={code} value={`skill: ${code}`} />
                      ))}
                      {selectedAssignment.matched_certification_codes.map((code) => (
                        <StatusChip key={code} value={`cert: ${code}`} />
                      ))}
                    </div>
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="field-label">Lead worker</span>
                        <select
                          className="form-select"
                          value={overrideForm.worker_id}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) =>
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              worker_id: event.target.value,
                              crew_worker_ids: currentForm.crew_worker_ids.includes(event.target.value)
                                ? currentForm.crew_worker_ids
                                : [event.target.value, ...currentForm.crew_worker_ids],
                            }))
                          }
                        >
                          {editableWorkers.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.display_name}
                            </option>
                          ))}
                        </select>
                        <span className="field-helper">
                          Hold Cmd/Ctrl to select multiple crew members.
                        </span>
                      </label>
                      <label className="form-field">
                        <span className="field-label">
                          Crew members ({normalizedOverrideCrewIds.length}/{selectedAssignmentCrewSize})
                        </span>
                        <select
                          className="form-select"
                          multiple
                          value={overrideForm.crew_worker_ids}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) => {
                            const selectedWorkerIds = Array.from(event.target.selectedOptions).map(
                              (option) => option.value,
                            );
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              crew_worker_ids: selectedWorkerIds.includes(currentForm.worker_id)
                                ? selectedWorkerIds
                                : [currentForm.worker_id, ...selectedWorkerIds],
                            }));
                          }}
                        >
                          {editableWorkers.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.display_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="field-label">Override reason</span>
                        <input
                          className="form-input"
                          value={overrideForm.override_reason}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) =>
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              override_reason: event.target.value,
                            }))
                          }
                          placeholder="Explain why the planner output is being changed."
                        />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Scheduled start</span>
                        <input
                          className="form-input"
                          type="datetime-local"
                          value={overrideForm.scheduled_start_at}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) =>
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              scheduled_start_at: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Scheduled end</span>
                        <input
                          className="form-input"
                          type="datetime-local"
                          value={overrideForm.scheduled_end_at}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) =>
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              scheduled_end_at: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field form-field--full">
                        <span className="field-label">Override note</span>
                        <textarea
                          className="form-textarea"
                          value={overrideForm.override_note}
                          disabled={isActionPending || !canEditAssignmentForm}
                          onChange={(event) =>
                            setOverrideForm((currentForm) => ({
                              ...currentForm,
                              override_note: event.target.value,
                            }))
                          }
                          placeholder="Optional context for downstream operators."
                        />
                      </label>
                    </div>
                    <div className="form-actions">
                      {!hasValidCrewSelection ? (
                        <p className="support-copy">
                          Select exactly {selectedAssignmentCrewSize} crew member
                          {selectedAssignmentCrewSize === 1 ? "" : "s"}, including the lead worker.
                        </p>
                      ) : null}
                      {selectedAssignment.assignment_status === "cancelled" ? (
                        <p className="support-copy">
                          This assignment has been cancelled. It remains visible for audit history only.
                        </p>
                      ) : null}
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={
                          isActionPending
                          || !canEditAssignmentForm
                          || editableWorkers.length === 0
                        }
                        onClick={() =>
                          setOverrideForm({
                            worker_id: selectedAssignment.worker_id,
                            crew_worker_ids: selectedAssignmentCrewIds,
                            scheduled_start_at: formatDateTimeLocalInput(
                              selectedAssignment.scheduled_start_at,
                            ),
                            scheduled_end_at: formatDateTimeLocalInput(
                              selectedAssignment.scheduled_end_at,
                            ),
                            override_reason: selectedAssignment.override_reason ?? "",
                            override_note: selectedAssignment.override_note ?? "",
                          })
                        }
                      >
                        Reset form
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          isActionPending
                          || !canEditAssignmentForm
                          || !overrideForm.worker_id
                          || !hasValidCrewSelection
                          || !overrideForm.override_reason.trim()
                        }
                        onClick={() => {
                          startActionTransition(async () => {
                            if (!planRun || !selectedAssignment) {
                              return;
                            }
                            try {
                              if (planRun.publication_status === "published") {
                                await reassignPublishedAssignment();
                              } else {
                                const payload: PlanAssignmentOverrideUpdate = {
                                  worker_id: overrideForm.worker_id,
                                  crew_worker_ids:
                                    normalizedOverrideCrewIds.length > 0
                                      ? normalizedOverrideCrewIds
                                      : [overrideForm.worker_id],
                                  scheduled_start_at: parseDateTimeLocalInput(
                                    overrideForm.scheduled_start_at,
                                  ),
                                  scheduled_end_at: parseDateTimeLocalInput(
                                    overrideForm.scheduled_end_at,
                                  ),
                                  override_reason: overrideForm.override_reason.trim(),
                                  override_note: overrideForm.override_note.trim() || null,
                                  actor_name: executionActorName.trim() || "local-planner",
                                };
                                await apiRequest<PlanAssignment>(
                                  `/organizations/${organizationId}/plan-runs/${planRun.id}/assignments/${selectedAssignment.id}`,
                                  {
                                    method: "PATCH",
                                    body: JSON.stringify(payload),
                                  },
                                );
                                await refreshRunState(planRun.id);
                              }
                              setError(null);
                            } catch (actionError) {
                              setError(
                                actionError instanceof Error
                                  ? actionError.message
                                  : planRun.publication_status === "published"
                                    ? "Unable to reassign the selected published assignment."
                                    : "Unable to override the selected assignment.",
                              );
                            }
                          });
                        }}
                      >
                        <SquarePen size={16} />
                        {planRun?.publication_status === "published" ? "Reassign published work" : "Apply override"}
                      </button>
                    </div>
                    <ul className="plain-list">
                      <li>
                        Actual start: {formatDateTime(selectedAssignment.actual_start_at)} · Actual end:{" "}
                        {formatDateTime(selectedAssignment.actual_end_at)}
                      </li>
                      <li>
                        Actual duration: {selectedAssignment.actual_duration_minutes ?? "Not recorded"} minutes
                      </li>
                      <li>
                        Reserved materials:{" "}
                        {Object.entries(selectedAssignment.reserved_material_quantities)
                          .map(([materialCode, quantity]) => `${materialCode}: ${quantity}`)
                          .join(", ") || "None"}
                      </li>
                      <li>
                        Reserved equipment:{" "}
                        {selectedAssignment.reserved_equipment_ids.join(", ") || "None"}
                      </li>
                      <li>
                        Last override: {selectedAssignment.override_actor_name ?? "Not overridden"} ·{" "}
                        {formatDateTime(selectedAssignment.overridden_at)}
                      </li>
                      <li>
                        Dispatch handoff: {selectedAssignment.dispatch_handoff_status} ·{" "}
                        {selectedAssignment.dispatch_handoff_actor_name ?? "Not recorded"} ·{" "}
                        {formatDateTime(selectedAssignment.dispatch_handoff_at)}
                      </li>
                    </ul>
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="field-label">Cancellation at</span>
                        <input
                          className="form-input"
                          type="datetime-local"
                          value={cancellationForm.occurred_at}
                          disabled={isActionPending || !canCancelPublishedAssignment}
                          onChange={(event) =>
                            setCancellationForm((currentForm) => ({
                              ...currentForm,
                              occurred_at: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Cancellation reason</span>
                        <input
                          className="form-input"
                          value={cancellationForm.reason}
                          disabled={isActionPending || !canCancelPublishedAssignment}
                          onChange={(event) =>
                            setCancellationForm((currentForm) => ({
                              ...currentForm,
                              reason: event.target.value,
                            }))
                          }
                          placeholder="Explain why this published assignment is being cancelled."
                        />
                      </label>
                      <label className="form-field form-field--full">
                        <span className="field-label">Cancellation note</span>
                        <textarea
                          className="form-textarea"
                          value={cancellationForm.note}
                          disabled={isActionPending || !canCancelPublishedAssignment}
                          onChange={(event) =>
                            setCancellationForm((currentForm) => ({
                              ...currentForm,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Optional context for downstream operators."
                        />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={isActionPending || !canCancelPublishedAssignment}
                        onClick={() =>
                          setCancellationForm({
                            occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
                            reason: "",
                            note: "",
                          })
                        }
                      >
                        Reset cancellation form
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        disabled={
                          isActionPending
                          || !canCancelPublishedAssignment
                          || !cancellationForm.reason.trim()
                        }
                        onClick={() => {
                          startActionTransition(async () => {
                            try {
                              await cancelPublishedAssignment();
                              setCancellationForm({
                                occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
                                reason: "",
                                note: "",
                              });
                              setError(null);
                            } catch (actionError) {
                              setError(
                                actionError instanceof Error
                                  ? actionError.message
                                  : "Unable to cancel the selected published assignment.",
                              );
                            }
                          });
                        }}
                      >
                        <AlertTriangle size={16} />
                        Cancel published work
                      </button>
                    </div>
                  </article>

                  <article className="review-group">
                    <div className="review-group__header">
                      <div className="review-group__title">
                        <div className="icon-badge icon-badge--accent">
                          <Play size={18} />
                        </div>
                        <div>
                          <h3>Execution updates</h3>
                          <p>Capture what happened in the field once the run has been published.</p>
                        </div>
                      </div>
                      <StatusChip
                        value={selectedAssignment.execution_status}
                        tone={executionStatusTone(selectedAssignment.execution_status)}
                      />
                    </div>

                    {!canCaptureExecutionForSelection ? (
                      <EmptyState
                        title={
                          selectedAssignment.assignment_status === "cancelled"
                            ? "Cancelled assignments are closed"
                            : "Execution logging unlocks after publication"
                        }
                        body={
                          selectedAssignment.assignment_status === "cancelled"
                            ? "This assignment has been cancelled, so it no longer accepts field execution updates."
                            : "Approve and publish the run first. Then you can record started, blocked, and completed events against this assignment."
                        }
                      />
                    ) : (
                      <>
                        <div className="form-grid">
                          <label className="form-field">
                            <span className="field-label">Occurred at</span>
                            <input
                              className="form-input"
                              type="datetime-local"
                              value={executionEventForm.occurred_at}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setExecutionEventForm((currentForm) => ({
                                  ...currentForm,
                                  occurred_at: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span className="field-label">Blocked reason code</span>
                            <select
                              className="form-select"
                              value={executionEventForm.reason_code}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setExecutionEventForm((currentForm) => ({
                                  ...currentForm,
                                  reason_code: event.target.value,
                                }))
                              }
                            >
                              {BLOCKED_REASON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field form-field--full">
                            <span className="field-label">Execution note</span>
                            <textarea
                              className="form-textarea"
                              value={executionEventForm.note}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setExecutionEventForm((currentForm) => ({
                                  ...currentForm,
                                  note: event.target.value,
                                }))
                              }
                              placeholder="Required for blocked events. Optional for started and completed."
                            />
                          </label>
                        </div>
                        <div className="form-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={
                              isActionPending
                              || !canCaptureExecutionForSelection
                              || selectedAssignment.execution_status === "completed"
                            }
                            onClick={() => {
                              startActionTransition(async () => {
                                try {
                                  await createExecutionEvent("started");
                                  setExecutionEventForm({
                                    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
                                    note: "",
                                    reason_code: BLOCKED_REASON_OPTIONS[0].value,
                                  });
                                  setError(null);
                                } catch (actionError) {
                                  setError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Unable to record the start event.",
                                  );
                                }
                              });
                            }}
                          >
                            <Play size={16} />
                            Record start
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            disabled={
                              isActionPending
                              || !canCaptureExecutionForSelection
                              || selectedAssignment.execution_status === "completed"
                              || !executionEventForm.note.trim()
                            }
                            onClick={() => {
                              startActionTransition(async () => {
                                try {
                                  await createExecutionEvent("blocked");
                                  setExecutionEventForm({
                                    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
                                    note: "",
                                    reason_code: BLOCKED_REASON_OPTIONS[0].value,
                                  });
                                  setError(null);
                                } catch (actionError) {
                                  setError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Unable to record the blocked event.",
                                  );
                                }
                              });
                            }}
                          >
                            <AlertTriangle size={16} />
                            Record blocked
                          </button>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={
                              isActionPending
                              || !canCaptureExecutionForSelection
                              || selectedAssignment.execution_status === "completed"
                            }
                            onClick={() => {
                              startActionTransition(async () => {
                                try {
                                  await createExecutionEvent("completed");
                                  setExecutionEventForm({
                                    occurred_at: formatDateTimeLocalInput(new Date().toISOString()),
                                    note: "",
                                    reason_code: BLOCKED_REASON_OPTIONS[0].value,
                                  });
                                  setError(null);
                                } catch (actionError) {
                                  setError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Unable to record the completion event.",
                                  );
                                }
                              });
                            }}
                          >
                            <CheckCheck size={16} />
                            Record completion
                          </button>
                        </div>

                        {assignmentEvents.length === 0 ? (
                          <p className="empty-state">No execution events recorded yet.</p>
                        ) : (
                          <ul className="review-list">
                            {assignmentEvents.map((event) => (
                              <li key={event.id} className="review-list__item">
                                <div className="review-list__copy">
                                  <strong>
                                    {executionEventLabel(event.event_type)} · {formatDateTime(event.occurred_at)}
                                  </strong>
                                  <p>
                                    Actor: {event.actor_name}
                                    {event.payload_json.reason_code
                                      ? ` · ${blockedReasonLabel(String(event.payload_json.reason_code))}`
                                      : ""}
                                    {event.note ? ` · ${event.note}` : ""}
                                  </p>
                                </div>
                                <div className="inline-actions">
                                  <StatusChip
                                    value={executionEventLabel(event.event_type)}
                                    tone={executionEventTone(event.event_type)}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </article>
                </div>
              )}
            </SectionCard>
          </section>

          <SectionCard
            title="Actuals"
          >
            {planRun.publication_status !== "published" ? (
              <EmptyState
                title="Publish first"
              />
            ) : !actualsReview ? (
              <p className="empty-state">Loading actuals...</p>
            ) : (
              <div className="review-group-stack">
                <section className="metric-grid metric-grid--compact">
                  <article className="metric-card metric-card--with-icon">
                    <div className="icon-badge">
                      <CheckCheck size={18} />
                    </div>
                    <p>Completed</p>
                    <strong>{actualsReview.summary.assignments_completed}</strong>
                    <span>
                      {actualsReview.summary.assignments_total} published
                    </span>
                  </article>
                  <article className="metric-card metric-card--with-icon">
                    <div className="icon-badge icon-badge--warning">
                      <AlertTriangle size={18} />
                    </div>
                    <p>Cancelled</p>
                    <strong>{actualsReview.summary.assignments_cancelled}</strong>
                    <span>Published assignments cancelled after dispatch</span>
                  </article>
                  <article className="metric-card metric-card--with-icon">
                    <div className="icon-badge icon-badge--warning">
                      <Clock3 size={18} />
                    </div>
                    <p>Delayed starts</p>
                    <strong>{actualsReview.summary.delayed_start_count}</strong>
                    <span>Late starts</span>
                  </article>
                  <article className="metric-card metric-card--with-icon">
                    <div className="icon-badge icon-badge--warning">
                      <AlertTriangle size={18} />
                    </div>
                    <p>Blocked events</p>
                    <strong>{actualsReview.summary.blocked_event_count}</strong>
                    <span>Total blocked-state updates recorded in the field</span>
                  </article>
                  <article className="metric-card metric-card--with-icon">
                    <div className="icon-badge">
                      <GitCompareArrows size={18} />
                    </div>
                    <p>Duration variance</p>
                    <strong>{formatSignedDelta(actualsReview.summary.total_duration_variance_minutes)}</strong>
                    <span>Total actual minutes vs planned minutes across completed work</span>
                  </article>
                </section>

                {actualsReview.items.length === 0 ? (
                    <EmptyState
                      title="No published assignments"
                    />
                ) : (
                  <div className="review-group-stack">
                    <DataTable
                      columns={[
                        "Work order",
                        "Worker",
                        "Execution",
                        "Planned",
                        "Actual",
                        "Start delta",
                        "Finish delta",
                        "Duration delta",
                        "Latest update",
                      ]}
                    >
                      {actualsReview.items.map((item) => (
                        <tr
                          key={item.assignment_id}
                          className={item.assignment_id === selectedAssignment?.id ? "is-selected" : ""}
                          onClick={() => setSelectedAssignmentId(item.assignment_id)}
                        >
                          <td>
                            <Link
                              className="inline-link"
                              href={buildWorkOrdersHref(organizationId, item.work_order_id)}
                            >
                              {item.work_order_title}
                            </Link>
                          </td>
                          <td>
                            <Link
                              className="inline-link"
                              href={buildWorkersHref(organizationId, item.worker_id)}
                            >
                              {item.worker_name}
                            </Link>
                          </td>
                          <td>
                            <div className="inline-actions inline-actions--start">
                              <StatusChip
                                value={item.execution_status}
                                tone={executionStatusTone(item.execution_status)}
                              />
                              {item.blocked_event_count > 0 ? (
                                <StatusChip
                                  value={`${item.blocked_event_count} blocked`}
                                  tone="danger"
                                />
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="table-copy">
                              <strong>{formatDateTime(item.scheduled_start_at)}</strong>
                              <p>{formatDateTime(item.scheduled_end_at)}</p>
                            </div>
                          </td>
                          <td>
                            <div className="table-copy">
                              <strong>{formatDateTime(item.actual_start_at)}</strong>
                              <p>{formatDateTime(item.actual_end_at)}</p>
                            </div>
                          </td>
                          <td>
                            <StatusChip
                              value={formatVarianceMinutes(item.start_variance_minutes)}
                              tone={varianceTone(item.start_variance_minutes)}
                            />
                          </td>
                          <td>
                            <StatusChip
                              value={formatVarianceMinutes(item.completion_variance_minutes)}
                              tone={varianceTone(item.completion_variance_minutes)}
                            />
                          </td>
                          <td>
                            <StatusChip
                              value={formatVarianceMinutes(item.duration_variance_minutes)}
                              tone={varianceTone(item.duration_variance_minutes)}
                            />
                          </td>
                          <td>
                            <div className="table-copy">
                              <strong>{item.latest_event_type ? executionEventLabel(item.latest_event_type as PlanAssignmentEvent["event_type"]) : "No updates"}</strong>
                              <p>
                                {formatDateTime(item.latest_event_at)}
                                {item.latest_event_note ? ` · ${item.latest_event_note}` : ""}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </DataTable>

                    <section className="workspace-grid">
                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>Blocked reasons</h3>
                            <p>Structured reason codes from field blockage updates.</p>
                          </div>
                        </div>
                        {actualsReview.blocked_reason_counts.length === 0 ? (
                          <p className="empty-state">No blocked reasons recorded yet.</p>
                        ) : (
                          <ul className="token-list">
                            {actualsReview.blocked_reason_counts.map((reason) => (
                              <li key={reason.reason_code} className="token-row">
                                <div>
                                  <strong>{blockedReasonLabel(reason.reason_code)}</strong>
                                  <p>{reason.reason_code}</p>
                                </div>
                                <StatusChip value={`${reason.count} events`} tone="danger" />
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>

                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>By worker</h3>
                            <p>Execution variance and blockage patterns grouped by assigned worker.</p>
                          </div>
                        </div>
                        <DataTable
                          columns={[
                            "Worker",
                            "Completed",
                            "Blocked",
                            "Delayed starts",
                            "Late finishes",
                            "Duration delta",
                          ]}
                        >
                          {actualsReview.worker_breakdown.map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td>{row.assignments_completed} / {row.assignments_total}</td>
                              <td>{row.blocked_event_count}</td>
                              <td>{row.delayed_start_count}</td>
                              <td>{row.overdue_completion_count}</td>
                              <td>
                                <StatusChip
                                  value={formatSignedDelta(row.total_duration_variance_minutes)}
                                  tone={varianceTone(row.total_duration_variance_minutes)}
                                />
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </article>
                    </section>

                    <section className="workspace-grid">
                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>By site</h3>
                            <p>Where execution drift and blockage are accumulating geographically.</p>
                          </div>
                        </div>
                        <DataTable
                          columns={[
                            "Site",
                            "Completed",
                            "Blocked",
                            "Delayed starts",
                            "Late finishes",
                            "Duration delta",
                          ]}
                        >
                          {actualsReview.location_breakdown.map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td>{row.assignments_completed} / {row.assignments_total}</td>
                              <td>{row.blocked_event_count}</td>
                              <td>{row.delayed_start_count}</td>
                              <td>{row.overdue_completion_count}</td>
                              <td>
                                <StatusChip
                                  value={formatSignedDelta(row.total_duration_variance_minutes)}
                                  tone={varianceTone(row.total_duration_variance_minutes)}
                                />
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </article>

                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>By work type</h3>
                            <p>
                              Current grouping uses service-level policy name when present, then planning unit name as a fallback.
                            </p>
                          </div>
                        </div>
                        <DataTable
                          columns={[
                            "Work type",
                            "Completed",
                            "Blocked",
                            "Delayed starts",
                            "Late finishes",
                            "Duration delta",
                          ]}
                        >
                          {actualsReview.work_type_breakdown.map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td>{row.assignments_completed} / {row.assignments_total}</td>
                              <td>{row.blocked_event_count}</td>
                              <td>{row.delayed_start_count}</td>
                              <td>{row.overdue_completion_count}</td>
                              <td>
                                <StatusChip
                                  value={formatSignedDelta(row.total_duration_variance_minutes)}
                                  tone={varianceTone(row.total_duration_variance_minutes)}
                                />
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </article>
                    </section>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Compare"
          >
            {recentRuns.length < 2 ? (
              <EmptyState
                title="Run another draft"
              />
            ) : (
              <div className="compare-shell">
                <div className="compare-toolbar">
                  <div className="compare-selector-grid">
                    <div className="compare-run-card compare-run-card--candidate">
                      <div className="card__header">
                        <div className="review-group__title">
                          <div className="icon-badge icon-badge--accent">
                            <ArrowUpRight size={18} />
                          </div>
                          <div>
                            <h3>Candidate run</h3>
                            <p>{planRun.scenario_name}</p>
                          </div>
                        </div>
                        <StatusChip value={formatDateTime(planRun.created_at)} />
                      </div>
                    </div>

                    <label className="form-field">
                      <span className="field-label">Baseline run</span>
                      <select
                        className="form-input"
                        value={activeComparisonRunId || "none"}
                        onChange={(event) => replaceComparison(event.target.value)}
                      >
                        <option value="none">No comparison</option>
                        {comparisonOptions.map((run) => (
                          <option key={run.id} value={run.id}>
                            {run.scenario_name} · {formatDateTime(run.created_at)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="inline-actions">
                    {comparison ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          router.replace(
                            buildSelectionHref(
                              organizationId,
                              activeComparisonRunId,
                              planRun.id,
                            ),
                          )
                        }
                      >
                        <GitCompareArrows size={16} />
                        Swap runs
                      </button>
                    ) : null}
                    {activeComparisonRunId ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => replaceComparison("none")}
                      >
                        Clear comparison
                      </button>
                    ) : null}
                  </div>
                </div>

                {!comparison ? (
                    <EmptyState
                      title="Select a draft"
                    />
                ) : (
                  <>
                    <div className="compare-run-pair">
                      <article className="compare-run-card">
                        <div className="card__header">
                          <div className="review-group__title">
                            <div className="icon-badge">
                              <ArrowDownRight size={18} />
                            </div>
                            <div>
                              <h3>Baseline</h3>
                              <p>{comparison.baseline_run.scenario_name}</p>
                            </div>
                          </div>
                          <StatusChip value={formatDateTime(comparison.baseline_run.created_at)} />
                        </div>
                        <p className="compare-run-card__meta">
                          Assignments: {comparison.summary.assignments_before} · Unassigned:{" "}
                          {comparison.summary.unassigned_before} · Issues:{" "}
                          {comparison.summary.issues_before}
                        </p>
                      </article>

                      <article className="compare-run-card compare-run-card--candidate">
                        <div className="card__header">
                          <div className="review-group__title">
                            <div className="icon-badge icon-badge--accent">
                              <ArrowUpRight size={18} />
                            </div>
                            <div>
                              <h3>Candidate</h3>
                              <p>{comparison.candidate_run.scenario_name}</p>
                            </div>
                          </div>
                          <StatusChip value={formatDateTime(comparison.candidate_run.created_at)} />
                        </div>
                        <p className="compare-run-card__meta">
                          Assignments: {comparison.summary.assignments_after} · Unassigned:{" "}
                          {comparison.summary.unassigned_after} · Issues:{" "}
                          {comparison.summary.issues_after}
                        </p>
                      </article>
                    </div>

                    <div className="metric-grid metric-grid--compact">
                      <article className="metric-card metric-card--with-icon">
                        <div className="icon-badge icon-badge--accent">
                          <GitCompareArrows size={18} />
                        </div>
                        <p>Assignment delta</p>
                        <strong>
                          {formatSignedDelta(
                            comparison.summary.assignments_after
                              - comparison.summary.assignments_before,
                          )}
                        </strong>
                        <span>{comparison.summary.assignment_changes} changed work orders</span>
                      </article>
                      <article className="metric-card metric-card--with-icon">
                        <div className="icon-badge">
                          <ArrowUpRight size={18} />
                        </div>
                        <p>Recovered work</p>
                        <strong>{recoveredWorkOrders}</strong>
                        <span>Previously blocked work orders now cleared</span>
                      </article>
                      <article className="metric-card metric-card--with-icon">
                        <div className="icon-badge icon-badge--warning">
                          <ArrowDownRight size={18} />
                        </div>
                        <p>Newly blocked</p>
                        <strong>{newBlockedWorkOrders}</strong>
                        <span>Work orders that became newly unassigned</span>
                      </article>
                      <article className="metric-card metric-card--with-icon">
                        <div className="icon-badge icon-badge--warning">
                          <AlertTriangle size={18} />
                        </div>
                        <p>Issue delta</p>
                        <strong>
                          {formatSignedDelta(
                            comparison.summary.issues_after - comparison.summary.issues_before,
                          )}
                        </strong>
                        <span>{comparison.summary.issue_changes} planner warnings changed</span>
                      </article>
                    </div>

                    <div className="workspace-grid">
                      <article className="review-group">
                        <div className="review-group__header">
                          <div className="review-group__title">
                            <div className="icon-badge">
                              <GitCompareArrows size={18} />
                            </div>
                            <div>
                              <h3>Assignment delta</h3>
                              <p>Worker, schedule, and reservation changes between the two runs.</p>
                            </div>
                          </div>
                          <StatusChip
                            value={`${comparison.assignment_changes.length} changes`}
                            tone={
                              comparison.assignment_changes.length > 0 ? "warning" : "success"
                            }
                          />
                        </div>
                        {comparison.assignment_changes.length === 0 ? (
                          <p className="empty-state">No assignment deltas between these runs.</p>
                        ) : (
                          <DataTable
                            columns={["Work order", "Change", "Baseline", "Candidate", "Focus"]}
                          >
                            {comparison.assignment_changes.map((change) => (
                              <AssignmentChangeRow
                                key={change.work_order_id}
                                organizationId={organizationId}
                                workOrders={workOrders}
                                change={change}
                              />
                            ))}
                          </DataTable>
                        )}
                      </article>

                      <article className="review-group">
                        <div className="review-group__header">
                          <div className="review-group__title">
                            <div className="icon-badge icon-badge--warning">
                              <AlertTriangle size={18} />
                            </div>
                            <div>
                              <h3>Unassigned delta</h3>
                              <p>What became newly blocked, recovered, or changed in the recovery queue.</p>
                            </div>
                          </div>
                          <StatusChip
                            value={`${comparison.unassigned_changes.length} changes`}
                            tone={
                              comparison.unassigned_changes.length > 0 ? "warning" : "success"
                            }
                          />
                        </div>
                        {comparison.unassigned_changes.length === 0 ? (
                          <p className="empty-state">No unassigned-work deltas between these runs.</p>
                        ) : (
                          <ul className="review-list">
                            {comparison.unassigned_changes.map((change) => (
                              <UnassignedChangeItem
                                key={change.work_order_id}
                                organizationId={organizationId}
                                workOrders={workOrders}
                                change={change}
                              />
                            ))}
                          </ul>
                        )}
                      </article>
                    </div>

                    <article className="review-group">
                      <div className="review-group__header">
                        <div className="review-group__title">
                          <div className="icon-badge icon-badge--warning">
                            <ScanSearch size={18} />
                          </div>
                          <div>
                            <h3>Issue delta</h3>
                            <p>Warnings that appeared or disappeared across the compared drafts.</p>
                          </div>
                        </div>
                        <StatusChip
                          value={`${comparison.issue_changes.length} changes`}
                          tone={comparison.issue_changes.length > 0 ? "warning" : "success"}
                        />
                      </div>
                      {comparison.issue_changes.length === 0 ? (
                        <p className="empty-state">No planner-issue deltas between these runs.</p>
                      ) : (
                        <ul className="review-list">
                          {comparison.issue_changes.map((change) => (
                            <IssueChangeItem
                              key={`${change.change_type}-${change.message}`}
                              organizationId={organizationId}
                              change={change}
                            />
                          ))}
                        </ul>
                      )}
                    </article>
                  </>
                )}
              </div>
            )}
          </SectionCard>

          <section className="workspace-grid">
          <SectionCard
              title="Table"
              actions={
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setShowDispatchTools((currentValue) => !currentValue)}
                >
                  <Send size={16} />
                  {showDispatchTools ? "Hide dispatch" : "Dispatch tools"}
                </button>
              }
            >
              {assignments.length === 0 ? (
                <EmptyState
                  title="No assignments"
                  body="Run another draft."
                />
              ) : (
                <>
                  {!showDispatchTools ? (
                    <div className="compact-callout">
                      <span>Dispatch hidden</span>
                      <div className="inline-actions">
                        <StatusChip value={`${dispatchQueueTemplates.length} templates`} tone="neutral" />
                        <StatusChip value={`${dispatchQueues.length} run queues`} tone="neutral" />
                        <StatusChip value={`${selectedAssignmentIds.length} selected`} tone="neutral" />
                      </div>
                    </div>
                  ) : null}
                  {showDispatchTools ? (
                    <>
                  <article className="review-group">
                    <div className="review-group__header">
                      <div className="review-group__title">
                        <div className="icon-badge">
                          <HardHat size={18} />
                        </div>
                        <div>
                          <h3>Dispatch governance</h3>
                          <p>Manage shared queue templates, run-specific queues, and role-gated apply actions.</p>
                        </div>
                      </div>
                      <div className="inline-actions">
                        <StatusChip value={`${dispatchQueueTemplates.length} templates`} tone="neutral" />
                        <StatusChip value={`${dispatchQueues.length} run queues`} tone="neutral" />
                      </div>
                    </div>

                    <div className="review-group-stack">
                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>Shared queue templates</h3>
                            <p>Reusable queue definitions that can be applied or instantiated across runs.</p>
                          </div>
                          {selectedDispatchQueueTemplate ? (
                            <StatusChip value={`editing: ${selectedDispatchQueueTemplate.name}`} tone="warning" />
                          ) : (
                            <StatusChip value="new template" tone="neutral" />
                          )}
                        </div>
                        <div className="form-grid">
                          <label className="form-field">
                            <span className="field-label">Template name</span>
                            <input
                              className="form-input"
                              value={dispatchQueueTemplateForm.name}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Published pending queue"
                            />
                          </label>
                          <label className="form-field">
                            <span className="field-label">Description</span>
                            <input
                              className="form-input"
                              value={dispatchQueueTemplateForm.description}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Reusable governed queue."
                            />
                          </label>
                          <label className="form-field">
                            <span className="field-label">Assignment status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueTemplateForm.assignment_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  assignment_status: event.target.value as DispatchQueueTemplateFormState["assignment_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="published">Published</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Execution status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueTemplateForm.execution_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  execution_status: event.target.value as DispatchQueueTemplateFormState["execution_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="not_started">Not started</option>
                              <option value="in_progress">In progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Handoff status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueTemplateForm.handoff_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  handoff_status: event.target.value as DispatchQueueTemplateFormState["handoff_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="pending">Pending</option>
                              <option value="ready">Ready</option>
                              <option value="sent">Sent</option>
                              <option value="acknowledged">Acknowledged</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Canned handoff action</span>
                            <select
                              className="form-select"
                              value={dispatchQueueTemplateForm.canned_handoff_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  canned_handoff_status: event.target.value as DispatchQueueTemplateFormState["canned_handoff_status"],
                                }))
                              }
                            >
                              <option value="none">None</option>
                              <option value="pending">Pending</option>
                              <option value="ready">Ready</option>
                              <option value="sent">Sent</option>
                              <option value="acknowledged">Acknowledged</option>
                            </select>
                          </label>
                          <label className="form-field form-field--full">
                            <span className="field-label">Allowed role codes</span>
                            <input
                              className="form-input"
                              value={dispatchQueueTemplateForm.allowed_role_codes}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueTemplateForm((currentForm) => ({
                                  ...currentForm,
                                  allowed_role_codes: event.target.value,
                                }))
                              }
                              placeholder="dispatch_manager, dispatch_supervisor"
                            />
                            <span className="field-helper">
                              Leave empty to allow any actor. Comma-separated role codes.
                            </span>
                          </label>
                        </div>
                        <div className="form-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={isActionPending || !dispatchQueueTemplateForm.name.trim() || !planRun}
                            onClick={() => {
                              startActionTransition(async () => {
                                try {
                                  if (selectedDispatchQueueTemplate) {
                                    await updateDispatchQueueTemplate();
                                  } else {
                                    await createDispatchQueueTemplate();
                                  }
                                  setError(null);
                                } catch (actionError) {
                                  setError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Unable to save the dispatch queue template.",
                                  );
                                }
                              });
                            }}
                          >
                            {selectedDispatchQueueTemplate ? "Update template" : "Save template"}
                          </button>
                          {selectedDispatchQueueTemplate ? (
                            <button
                              className="ghost-button"
                              type="button"
                              disabled={isActionPending}
                              onClick={resetDispatchQueueTemplateForm}
                            >
                              New template
                            </button>
                          ) : null}
                        </div>
                        {dispatchQueueTemplates.length === 0 ? (
                          <p className="empty-state">No queue templates yet.</p>
                        ) : (
                          <div className="review-group-stack">
                            <DataTable columns={["Template", "Filters", "Governance", "Canned action", "Run matches", "Actions"]}>
                              {dispatchQueueTemplates.map((template) => (
                                <tr key={template.id}>
                                  <td>
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      onClick={() => setSelectedDispatchQueueTemplateId(template.id)}
                                    >
                                      {template.name}
                                    </button>
                                  </td>
                                  <td>
                                    <div className="inline-actions inline-actions--start">
                                      {template.assignment_statuses.map((value) => (
                                        <StatusChip key={`${template.id}-assignment-${value}`} value={`assignment: ${value}`} />
                                      ))}
                                      {template.execution_statuses.map((value) => (
                                        <StatusChip key={`${template.id}-execution-${value}`} value={`execution: ${value}`} tone={executionStatusTone(value)} />
                                      ))}
                                      {template.handoff_statuses.map((value) => (
                                        <StatusChip key={`${template.id}-handoff-${value}`} value={handoffStatusLabel(value)} tone={handoffStatusTone(value)} />
                                      ))}
                                      {template.assignment_statuses.length === 0
                                      && template.execution_statuses.length === 0
                                      && template.handoff_statuses.length === 0
                                        ? <span>All assignments</span>
                                        : null}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="inline-actions inline-actions--start">
                                      {template.allowed_role_codes.length === 0 ? (
                                        <span>Open apply</span>
                                      ) : (
                                        template.allowed_role_codes.map((roleCode) => (
                                          <StatusChip key={`${template.id}-role-${roleCode}`} value={`role: ${roleCode}`} tone="warning" />
                                        ))
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {template.canned_handoff_status ? (
                                      <StatusChip
                                        value={handoffStatusLabel(template.canned_handoff_status)}
                                        tone={handoffStatusTone(template.canned_handoff_status)}
                                      />
                                    ) : (
                                      "None"
                                    )}
                                  </td>
                                  <td>
                                    {selectedDispatchQueueTemplateId === template.id
                                      ? `${selectedDispatchQueueTemplateAssignments.length} rows`
                                      : "Open template"}
                                  </td>
                                  <td>
                                    <div className="inline-actions">
                                      <button
                                        className="ghost-button"
                                        type="button"
                                        disabled={isActionPending || !planRun}
                                        onClick={() => {
                                          startActionTransition(async () => {
                                            try {
                                              await instantiateDispatchQueueFromTemplate(template.id);
                                              setError(null);
                                            } catch (actionError) {
                                              setError(
                                                actionError instanceof Error
                                                  ? actionError.message
                                                  : "Unable to create a run queue from template.",
                                              );
                                            }
                                          });
                                        }}
                                      >
                                        Create queue
                                      </button>
                                      <button
                                        className="danger-button"
                                        type="button"
                                        disabled={isActionPending}
                                        onClick={() => {
                                          startActionTransition(async () => {
                                            try {
                                              await deleteDispatchQueueTemplate(template.id);
                                              setError(null);
                                            } catch (actionError) {
                                              setError(
                                                actionError instanceof Error
                                                  ? actionError.message
                                                  : "Unable to delete dispatch queue template.",
                                              );
                                            }
                                          });
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </DataTable>
                          </div>
                        )}
                        {selectedDispatchQueueTemplate ? (
                          <div className="review-group-stack">
                            <article className="review-group">
                              <div className="review-group__header">
                                <div>
                                  <h3>{selectedDispatchQueueTemplate.name}</h3>
                                  <p>
                                    {selectedDispatchQueueTemplate.description ?? "No description"} ·{" "}
                                    {selectedDispatchQueueTemplateAssignments.length} matching assignments in this run
                                  </p>
                                </div>
                                <StatusChip
                                  value={selectedTemplateActionHandoffStatus
                                    ? `action: ${selectedTemplateActionHandoffStatus}`
                                    : "action missing"}
                                  tone={selectedTemplateActionHandoffStatus ? handoffStatusTone(selectedTemplateActionHandoffStatus) : "danger"}
                                />
                              </div>
                              <div className="inline-actions inline-actions--start">
                                {selectedDispatchQueueTemplate.allowed_role_codes.length === 0 ? (
                                  <StatusChip value="governance: open" tone="neutral" />
                                ) : (
                                  selectedDispatchQueueTemplate.allowed_role_codes.map((roleCode) => (
                                    <StatusChip key={`selected-template-role-${roleCode}`} value={`role: ${roleCode}`} tone="warning" />
                                  ))
                                )}
                                {selectedActorUser ? (
                                  <StatusChip
                                    value={`actor roles: ${selectedActorUser.roles.map((role) => role.code).join(", ") || "none"}`}
                                    tone="neutral"
                                  />
                                ) : null}
                              </div>
                              <div className="form-grid">
                                <label className="form-field">
                                  <span className="field-label">Action handoff status</span>
                                  <select
                                    className="form-select"
                                    value={dispatchQueueTemplateActionForm.handoff_status}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueTemplateActionForm((currentForm) => ({
                                        ...currentForm,
                                        handoff_status: event.target.value as DispatchQueueTemplateActionFormState["handoff_status"],
                                      }))
                                    }
                                  >
                                    <option value="template_default">Template default</option>
                                    <option value="pending">Pending</option>
                                    <option value="ready">Ready</option>
                                    <option value="sent">Sent</option>
                                    <option value="acknowledged">Acknowledged</option>
                                  </select>
                                </label>
                                <label className="form-field">
                                  <span className="field-label">Occurred at</span>
                                  <input
                                    className="form-input"
                                    type="datetime-local"
                                    value={dispatchQueueTemplateActionForm.occurred_at}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueTemplateActionForm((currentForm) => ({
                                        ...currentForm,
                                        occurred_at: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <label className="form-field form-field--full">
                                  <span className="field-label">Action note</span>
                                  <textarea
                                    className="form-textarea"
                                    value={dispatchQueueTemplateActionForm.note}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueTemplateActionForm((currentForm) => ({
                                        ...currentForm,
                                        note: event.target.value,
                                      }))
                                    }
                                    placeholder="Optional note for template apply events."
                                  />
                                </label>
                              </div>
                              <div className="form-actions">
                                <button
                                  className="ghost-button"
                                  type="button"
                                  disabled={isActionPending || selectedDispatchQueueTemplateAssignments.length === 0}
                                  onClick={() =>
                                    setSelectedAssignmentIds((currentSelectedIds) => Array.from(new Set([
                                      ...currentSelectedIds,
                                      ...selectedDispatchQueueTemplateAssignments.map((assignment) => assignment.id),
                                    ])))
                                  }
                                >
                                  Add template matches to selection
                                </button>
                                <button
                                  className="primary-button"
                                  type="button"
                                  disabled={isActionPending || !canApplySelectedTemplateAction}
                                  onClick={() => {
                                    startActionTransition(async () => {
                                      try {
                                        await applySelectedDispatchQueueTemplateAction();
                                        setError(null);
                                      } catch (actionError) {
                                        setError(
                                          actionError instanceof Error
                                            ? actionError.message
                                            : "Unable to apply the dispatch queue template action.",
                                        );
                                      }
                                    });
                                  }}
                                >
                                  <Send size={16} />
                                  Apply template action
                                </button>
                              </div>
                            </article>
                          </div>
                        ) : null}
                      </article>

                      <article className="review-group">
                        <div className="review-group__header">
                          <div>
                            <h3>Run-scoped queues</h3>
                            <p>Override or complement templates for this run only.</p>
                          </div>
                          <StatusChip value={`${dispatchQueues.length} queues`} tone="neutral" />
                        </div>
                        <div className="form-grid">
                          <label className="form-field">
                            <span className="field-label">Queue name</span>
                            <input
                              className="form-input"
                              value={dispatchQueueForm.name}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Blocked follow-up queue"
                            />
                          </label>
                          <label className="form-field">
                            <span className="field-label">Description</span>
                            <input
                              className="form-input"
                              value={dispatchQueueForm.description}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Optional context for dispatchers."
                            />
                          </label>
                          <label className="form-field">
                            <span className="field-label">Assignment status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueForm.assignment_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  assignment_status: event.target.value as DispatchQueueFormState["assignment_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="published">Published</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Execution status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueForm.execution_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  execution_status: event.target.value as DispatchQueueFormState["execution_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="not_started">Not started</option>
                              <option value="in_progress">In progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Handoff status filter</span>
                            <select
                              className="form-select"
                              value={dispatchQueueForm.handoff_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  handoff_status: event.target.value as DispatchQueueFormState["handoff_status"],
                                }))
                              }
                            >
                              <option value="any">Any</option>
                              <option value="pending">Pending</option>
                              <option value="ready">Ready</option>
                              <option value="sent">Sent</option>
                              <option value="acknowledged">Acknowledged</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="field-label">Canned handoff action</span>
                            <select
                              className="form-select"
                              value={dispatchQueueForm.canned_handoff_status}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  canned_handoff_status: event.target.value as DispatchQueueFormState["canned_handoff_status"],
                                }))
                              }
                            >
                              <option value="none">None</option>
                              <option value="pending">Pending</option>
                              <option value="ready">Ready</option>
                              <option value="sent">Sent</option>
                              <option value="acknowledged">Acknowledged</option>
                            </select>
                          </label>
                          <label className="form-field form-field--full">
                            <span className="field-label">Allowed role codes</span>
                            <input
                              className="form-input"
                              value={dispatchQueueForm.allowed_role_codes}
                              disabled={isActionPending}
                              onChange={(event) =>
                                setDispatchQueueForm((currentForm) => ({
                                  ...currentForm,
                                  allowed_role_codes: event.target.value,
                                }))
                              }
                              placeholder="dispatch_manager, dispatch_supervisor"
                            />
                          </label>
                        </div>
                        <div className="form-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={isActionPending || !dispatchQueueForm.name.trim() || !planRun}
                            onClick={() => {
                              startActionTransition(async () => {
                                try {
                                  await createDispatchQueue();
                                  setError(null);
                                } catch (actionError) {
                                  setError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Unable to create the saved dispatch queue.",
                                  );
                                }
                              });
                            }}
                          >
                            Save queue
                          </button>
                        </div>
                        {dispatchQueues.length === 0 ? (
                          <p className="empty-state">No saved dispatch queues for this run yet.</p>
                        ) : (
                          <div className="review-group-stack">
                            <DataTable columns={["Queue", "Filters", "Governance", "Canned action", "Matches", "Actions"]}>
                              {dispatchQueues.map((queue) => (
                                <tr key={queue.id}>
                                  <td>
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      onClick={() => setSelectedDispatchQueueId(queue.id)}
                                    >
                                      {queue.name}
                                    </button>
                                  </td>
                                  <td>
                                    <div className="inline-actions inline-actions--start">
                                      {queue.assignment_statuses.map((value) => (
                                        <StatusChip key={`${queue.id}-assignment-${value}`} value={`assignment: ${value}`} />
                                      ))}
                                      {queue.execution_statuses.map((value) => (
                                        <StatusChip key={`${queue.id}-execution-${value}`} value={`execution: ${value}`} tone={executionStatusTone(value)} />
                                      ))}
                                      {queue.handoff_statuses.map((value) => (
                                        <StatusChip key={`${queue.id}-handoff-${value}`} value={handoffStatusLabel(value)} tone={handoffStatusTone(value)} />
                                      ))}
                                      {queue.assignment_statuses.length === 0
                                      && queue.execution_statuses.length === 0
                                      && queue.handoff_statuses.length === 0
                                        ? <span>All assignments</span>
                                        : null}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="inline-actions inline-actions--start">
                                      {queue.queue_template_id ? (
                                        <StatusChip value="template-linked" tone="neutral" />
                                      ) : null}
                                      {queue.allowed_role_codes.length === 0 ? (
                                        <span>Open apply</span>
                                      ) : (
                                        queue.allowed_role_codes.map((roleCode) => (
                                          <StatusChip key={`${queue.id}-role-${roleCode}`} value={`role: ${roleCode}`} tone="warning" />
                                        ))
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {queue.canned_handoff_status ? (
                                      <StatusChip
                                        value={handoffStatusLabel(queue.canned_handoff_status)}
                                        tone={handoffStatusTone(queue.canned_handoff_status)}
                                      />
                                    ) : (
                                      "None"
                                    )}
                                  </td>
                                  <td>
                                    {selectedDispatchQueueId === queue.id
                                      ? `${selectedDispatchQueueAssignments.length} rows`
                                      : "Open queue"}
                                  </td>
                                  <td>
                                    <button
                                      className="danger-button"
                                      type="button"
                                      disabled={isActionPending}
                                      onClick={() => {
                                        startActionTransition(async () => {
                                          try {
                                            await deleteDispatchQueue(queue.id);
                                            setError(null);
                                          } catch (actionError) {
                                            setError(
                                              actionError instanceof Error
                                                ? actionError.message
                                                : "Unable to delete the saved dispatch queue.",
                                            );
                                          }
                                        });
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </DataTable>
                          </div>
                        )}
                        {selectedDispatchQueue ? (
                          <div className="review-group-stack">
                            <article className="review-group">
                              <div className="review-group__header">
                                <div>
                                  <h3>{selectedDispatchQueue.name}</h3>
                                  <p>
                                    {selectedDispatchQueue.description ?? "No description"} ·{" "}
                                    {selectedDispatchQueueAssignments.length} matching assignments
                                  </p>
                                </div>
                                <StatusChip
                                  value={selectedQueueActionHandoffStatus
                                    ? `action: ${selectedQueueActionHandoffStatus}`
                                    : "action missing"}
                                  tone={selectedQueueActionHandoffStatus ? handoffStatusTone(selectedQueueActionHandoffStatus) : "danger"}
                                />
                              </div>
                              <div className="inline-actions inline-actions--start">
                                {selectedDispatchQueue.allowed_role_codes.length === 0 ? (
                                  <StatusChip value="governance: open" tone="neutral" />
                                ) : (
                                  selectedDispatchQueue.allowed_role_codes.map((roleCode) => (
                                    <StatusChip key={`selected-queue-role-${roleCode}`} value={`role: ${roleCode}`} tone="warning" />
                                  ))
                                )}
                                {selectedActorUser ? (
                                  <StatusChip
                                    value={`actor roles: ${selectedActorUser.roles.map((role) => role.code).join(", ") || "none"}`}
                                    tone="neutral"
                                  />
                                ) : null}
                              </div>
                              <div className="form-grid">
                                <label className="form-field">
                                  <span className="field-label">Action handoff status</span>
                                  <select
                                    className="form-select"
                                    value={dispatchQueueActionForm.handoff_status}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueActionForm((currentForm) => ({
                                        ...currentForm,
                                        handoff_status: event.target.value as DispatchQueueActionFormState["handoff_status"],
                                      }))
                                    }
                                  >
                                    <option value="queue_default">Queue default</option>
                                    <option value="pending">Pending</option>
                                    <option value="ready">Ready</option>
                                    <option value="sent">Sent</option>
                                    <option value="acknowledged">Acknowledged</option>
                                  </select>
                                </label>
                                <label className="form-field">
                                  <span className="field-label">Occurred at</span>
                                  <input
                                    className="form-input"
                                    type="datetime-local"
                                    value={dispatchQueueActionForm.occurred_at}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueActionForm((currentForm) => ({
                                        ...currentForm,
                                        occurred_at: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <label className="form-field form-field--full">
                                  <span className="field-label">Action note</span>
                                  <textarea
                                    className="form-textarea"
                                    value={dispatchQueueActionForm.note}
                                    disabled={isActionPending}
                                    onChange={(event) =>
                                      setDispatchQueueActionForm((currentForm) => ({
                                        ...currentForm,
                                        note: event.target.value,
                                      }))
                                    }
                                    placeholder="Optional note for queue action event entries."
                                  />
                                </label>
                              </div>
                              <div className="form-actions">
                                <button
                                  className="ghost-button"
                                  type="button"
                                  disabled={isActionPending || selectedDispatchQueueAssignments.length === 0}
                                  onClick={() =>
                                    setSelectedAssignmentIds((currentSelectedIds) => Array.from(new Set([
                                      ...currentSelectedIds,
                                      ...selectedDispatchQueueAssignments.map((assignment) => assignment.id),
                                    ])))
                                  }
                                >
                                  Add matches to selection
                                </button>
                                <button
                                  className="primary-button"
                                  type="button"
                                  disabled={isActionPending || !canApplySelectedQueueAction}
                                  onClick={() => {
                                    startActionTransition(async () => {
                                      try {
                                        await applySelectedDispatchQueueAction();
                                        setError(null);
                                      } catch (actionError) {
                                        setError(
                                          actionError instanceof Error
                                            ? actionError.message
                                            : "Unable to apply the saved dispatch queue action.",
                                        );
                                      }
                                    });
                                  }}
                                >
                                  <Send size={16} />
                                  Apply queue action
                                </button>
                              </div>
                            </article>
                          </div>
                        ) : null}
                      </article>
                    </div>
                  </article>
                  {planRun?.publication_status === "published" ? (
                    <article className="review-group">
                      <div className="review-group__header">
                        <div className="review-group__title">
                          <div className="icon-badge icon-badge--warning">
                            <Send size={18} />
                          </div>
                          <div>
                            <h3>Bulk handoff</h3>
                            <p>Update dispatch handoff state for selected published assignments.</p>
                          </div>
                        </div>
                        <StatusChip
                          value={`${selectedPublishedAssignmentsForHandoff.length} selected`}
                          tone={selectedPublishedAssignmentsForHandoff.length > 0 ? "warning" : "neutral"}
                        />
                      </div>
                      <div className="form-grid">
                        <label className="form-field">
                          <span className="field-label">Handoff status</span>
                          <select
                            className="form-select"
                            value={bulkHandoffForm.handoff_status}
                            disabled={isActionPending}
                            onChange={(event) =>
                              setBulkHandoffForm((currentForm) => ({
                                ...currentForm,
                                handoff_status: event.target.value as BulkHandoffFormState["handoff_status"],
                              }))
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="ready">Ready</option>
                            <option value="sent">Sent</option>
                            <option value="acknowledged">Acknowledged</option>
                          </select>
                        </label>
                        <label className="form-field">
                          <span className="field-label">Occurred at</span>
                          <input
                            className="form-input"
                            type="datetime-local"
                            value={bulkHandoffForm.occurred_at}
                            disabled={isActionPending}
                            onChange={(event) =>
                              setBulkHandoffForm((currentForm) => ({
                                ...currentForm,
                                occurred_at: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field form-field--full">
                          <span className="field-label">Handoff note</span>
                          <textarea
                            className="form-textarea"
                            value={bulkHandoffForm.note}
                            disabled={isActionPending}
                            onChange={(event) =>
                              setBulkHandoffForm((currentForm) => ({
                                ...currentForm,
                                note: event.target.value,
                              }))
                            }
                            placeholder="Optional dispatch note recorded on selected assignments."
                          />
                        </label>
                      </div>
                      <div className="form-actions">
                        {hasNonPublishedSelectionForHandoff ? (
                          <p className="support-copy">
                            Bulk handoff updates only apply to published assignments. Remove draft/cancelled rows from the selection.
                          </p>
                        ) : null}
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={isActionPending || publishedAssignmentIds.length === 0}
                          onClick={() => {
                            if (areAllPublishedAssignmentsSelected) {
                              setSelectedAssignmentIds((currentSelectedIds) =>
                                currentSelectedIds.filter(
                                  (assignmentId) => !publishedAssignmentIds.includes(assignmentId),
                                ),
                              );
                              return;
                            }
                            setSelectedAssignmentIds((currentSelectedIds) => Array.from(new Set([
                              ...currentSelectedIds,
                              ...publishedAssignmentIds,
                            ])));
                          }}
                        >
                          {areAllPublishedAssignmentsSelected ? "Clear published selection" : "Select all published"}
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={isActionPending || !canApplyBulkHandoff}
                          onClick={() => {
                            startActionTransition(async () => {
                              try {
                                await applyBulkHandoffUpdate();
                                setError(null);
                              } catch (actionError) {
                                setError(
                                  actionError instanceof Error
                                    ? actionError.message
                                    : "Unable to update dispatch handoff state for selected assignments.",
                                );
                              }
                            });
                          }}
                        >
                          <Send size={16} />
                          Apply to selected
                        </button>
                      </div>
                    </article>
                  ) : null}
                    </>
                  ) : null}
                  <DataTable
                    columns={[
                      "Select",
                      "Work order",
                      "Worker",
                      "Review",
                      "Window",
                      "Materials",
                      "Equipment",
                    ]}
                  >
                    {assignments.map((assignment) => {
                      const isSelectedForBulk = selectedAssignmentIdSet.has(assignment.id);
                      return (
                        <tr
                          key={assignment.id}
                          className={assignment.id === selectedAssignment?.id ? "is-selected" : ""}
                          onClick={() => setSelectedAssignmentId(assignment.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelectedForBulk}
                              onChange={(event) => {
                                const isChecked = event.target.checked;
                                setSelectedAssignmentIds((currentSelectedIds) => {
                                  if (isChecked) {
                                    return Array.from(new Set([...currentSelectedIds, assignment.id]));
                                  }
                                  return currentSelectedIds.filter(
                                    (assignmentId) => assignmentId !== assignment.id,
                                  );
                                });
                              }}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </td>
                          <td>
                            <Link
                              className="inline-link"
                              href={buildWorkOrdersHref(organizationId, assignment.work_order_id)}
                            >
                              {findWorkOrderTitle(workOrders, assignment.work_order_id)}
                            </Link>
                          </td>
                          <td>
                            <Link
                              className="inline-link"
                              href={buildWorkersHref(organizationId, assignment.worker_id)}
                            >
                              {assignment.crew_worker_ids.length > 1
                                ? `${assignment.crew_worker_names.join(", ")} (${assignment.crew_worker_ids.length})`
                                : assignment.worker_name_snapshot}
                            </Link>
                          </td>
                          <td>
                            <div className="inline-actions inline-actions--start">
                              <StatusChip
                                value={assignment.assignment_status}
                                tone={assignmentStatusTone(assignment.assignment_status)}
                              />
                              <StatusChip
                                value={assignment.source_kind}
                                tone={assignmentSourceTone(assignment.source_kind)}
                              />
                              <StatusChip
                                value={assignment.execution_status}
                                tone={executionStatusTone(assignment.execution_status)}
                              />
                              <StatusChip
                                value={handoffStatusLabel(assignment.dispatch_handoff_status)}
                                tone={handoffStatusTone(assignment.dispatch_handoff_status)}
                              />
                            </div>
                          </td>
                          <td>
                            {formatDateTime(assignment.scheduled_start_at)}
                            {" -> "}
                            {formatDateTime(assignment.scheduled_end_at)}
                          </td>
                          <td>
                            {Object.entries(assignment.reserved_material_quantities)
                              .map(([materialCode, quantity]) => `${materialCode}: ${quantity}`)
                              .join(", ") || "None"}
                          </td>
                          <td>
                            {assignment.reserved_equipment_ids.length > 0 ? (
                              <div className="inline-actions inline-actions--start">
                                {assignment.reserved_equipment_ids.map((equipmentId) => (
                                  <Link
                                    key={equipmentId}
                                    className="inline-link"
                                    href={buildEquipmentHref(organizationId, equipmentId)}
                                  >
                                    {equipmentId}
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              "None"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Recovery"
            >
              {unassignedGroups.length === 0 ? (
                <p className="empty-state">No unassigned work in the latest draft.</p>
              ) : (
                <div className="review-group-stack">
                  {unassignedGroups.map((group) => (
                    <article key={group.key} className="review-group">
                      <div className="review-group__header">
                        <div>
                          <h3>{group.title}</h3>
                          <p>{group.description}</p>
                        </div>
                        <StatusChip
                          value={`${group.items.length} items`}
                          tone={group.items.length > 0 ? "warning" : "neutral"}
                        />
                      </div>
                      <ul className="review-list">
                        {group.items.map(({ item, actions }) => (
                          <li key={`${item.work_order_id}-${item.reason}`} className="review-list__item">
                            <div className="review-list__copy">
                              <strong>{findWorkOrderTitle(workOrders, item.work_order_id)}</strong>
                              <p>{item.reason}</p>
                            </div>
                            <div className="inline-actions">
                              {actions.map((action) => (
                                <Link
                                  key={`${item.work_order_id}-${action.href}`}
                                  className="ghost-link"
                                  href={action.href}
                                >
                                  {action.label}
                                </Link>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          </section>

          <section className="workspace-grid workspace-grid--wide-right">
            <SectionCard
              title="Runs"
            >
              {recentRuns.length === 0 ? (
                <p className="empty-state">No recent runs are available yet.</p>
              ) : (
                <ul className="token-list">
                  {recentRuns.slice(0, 8).map((run) => (
                    <li
                      key={run.id}
                      className={`token-row ${run.id === planRun.id ? "is-selected" : ""}`}
                    >
                      <div>
                        <strong>{run.scenario_name}</strong>
                        <p>
                          {formatDateTime(run.created_at)} · {run.summary.assignments.length} assignments
                          {" · "}
                          {run.summary.unassigned.length} unassigned
                        </p>
                      </div>
                      <div className="inline-actions">
                        <StatusChip
                          value={run.review_status}
                          tone={reviewStatusTone(run.review_status)}
                        />
                        <StatusChip
                          value={run.publication_status}
                          tone={publicationStatusTone(run.publication_status)}
                        />
                        {run.id === planRun.id ? (
                          <StatusChip value="Current" />
                        ) : (
                          <>
                            <Link
                              className="ghost-link"
                              href={buildSelectionHref(organizationId, run.id)}
                            >
                              Open
                            </Link>
                            <Link
                              className="ghost-link"
                              href={buildSelectionHref(organizationId, planRun.id, run.id)}
                            >
                              Compare
                            </Link>
                          </>
                        )}
                        {run.id === activeComparisonRunId ? (
                          <StatusChip value="Baseline" tone="warning" />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Issues"
            >
              {issueGroups.length > 0 ? (
                <div className="review-group-stack">
                  {issueGroups.map((group) => (
                    <article key={group.key} className="review-group">
                      <div className="review-group__header">
                        <div className="review-group__title">
                          <div className="icon-badge">
                            {group.key === "workforce" ? (
                              <HardHat size={18} />
                            ) : group.key === "demand" ? (
                              <ClipboardList size={18} />
                            ) : group.key === "resources" ? (
                              <Wrench size={18} />
                            ) : (
                              <ScanSearch size={18} />
                            )}
                          </div>
                          <div>
                            <h3>{group.title}</h3>
                            <p>{group.description}</p>
                          </div>
                        </div>
                        <StatusChip value={`${group.items.length} issues`} />
                      </div>
                      <ul className="review-list">
                        {group.items.map((item) => (
                          <li key={item.message} className="review-list__item">
                            <div className="review-list__copy">
                              <strong>{item.message}</strong>
                            </div>
                            <div className="inline-actions">
                              {item.actions.map((action) => (
                                <Link
                                  key={`${item.message}-${action.href}`}
                                  className="ghost-link"
                                  href={action.href}
                                >
                                  {action.label}
                                </Link>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No planner issues were reported for this run.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Next"
            >
              <div className="action-grid">
                <Link className="action-card" href={buildWorkersHref(organizationId)}>
                  <div className="icon-badge">
                    <HardHat size={18} />
                  </div>
                  <h3>Adjust workforce inputs</h3>
                  <p>Review worker skills, certifications, and availability windows.</p>
                </Link>
                <Link className="action-card" href={buildWorkOrdersHref(organizationId)}>
                  <div className="icon-badge">
                    <ClipboardList size={18} />
                  </div>
                  <h3>Fix demand records</h3>
                  <p>Update requirements, timing, and dependencies in the backlog.</p>
                </Link>
                <Link className="action-card" href={buildMaterialsHref(organizationId)}>
                  <div className="icon-badge">
                    <Wrench size={18} />
                  </div>
                  <h3>Inspect resources</h3>
                  <p>Check material stock and equipment coverage for blocked work orders.</p>
                </Link>
                <Link className="action-card" href={buildPlannerRunHref(organizationId)}>
                  <div className="icon-badge">
                    <ScanSearch size={18} />
                  </div>
                  <h3>Rerun the planner</h3>
                  <p>After changes land, run a fresh draft and compare the delta.</p>
                </Link>
              </div>
            </SectionCard>
          </section>
        </>
      )}
    </div>
  );
}
