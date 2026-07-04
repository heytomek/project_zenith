import type {
  PlanRunAssignmentChange,
  PlanRunIssueChange,
  PlanRunSummary,
  PlanRunUnassignedChange,
  UnassignedWork,
} from "@/lib/api/types";

export type PlannerReviewAction = {
  label: string;
  href: string;
};

export type PlannerIssueGroupKey =
  | "workforce"
  | "demand"
  | "resources"
  | "planner"
  | "summary";

export type PlannerIssueGroup = {
  key: PlannerIssueGroupKey;
  title: string;
  description: string;
  items: Array<{
    message: string;
    actions: PlannerReviewAction[];
  }>;
};

export type UnassignedReviewBucketKey =
  | "dependency"
  | "resources"
  | "workforce"
  | "other";

export type UnassignedReviewBucket = {
  key: UnassignedReviewBucketKey;
  title: string;
  description: string;
  items: Array<{
    item: UnassignedWork;
    actions: PlannerReviewAction[];
  }>;
};

export type PlannerOutcomeStats = {
  assignments: number;
  unassigned: number;
  issues: number;
  dependencyBlocks: number;
  resourceShortages: number;
  workforceGaps: number;
};

const issueGroupMeta: Record<
  PlannerIssueGroupKey,
  { title: string; description: string }
> = {
  workforce: {
    title: "Workforce setup",
    description: "Missing workers or capability inputs that block assignment quality.",
  },
  demand: {
    title: "Demand structure",
    description: "Backlog and dependency problems that need work-order cleanup.",
  },
  resources: {
    title: "Resource setup",
    description: "Materials and equipment configuration issues surfaced during planning.",
  },
  planner: {
    title: "Planner constraints",
    description: "General planner warnings that do not fit another operational bucket.",
  },
  summary: {
    title: "Run notes",
    description: "Summary output from the current dry-run execution.",
  },
};

const unassignedBucketMeta: Record<
  UnassignedReviewBucketKey,
  { title: string; description: string }
> = {
  dependency: {
    title: "Dependency blocks",
    description: "Work orders that stayed out of the schedule because predecessors failed.",
  },
  resources: {
    title: "Resource shortages",
    description: "Work orders blocked by missing material stock or equipment capacity.",
  },
  workforce: {
    title: "Labor and schedule gaps",
    description: "Work orders with no feasible worker match for skills, certifications, or timing.",
  },
  other: {
    title: "Other exceptions",
    description: "Planner outcomes that do not fit the main operational buckets.",
  },
};

function buildHref(pathname: string, query?: Record<string, string | null | undefined>): string {
  if (!query) {
    return pathname;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      search.set(key, value);
    }
  }

  const serialized = search.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function buildWorkersHref(
  organizationId: string,
  selectedWorkerId?: string | null,
): string {
  return buildHref(`/orgs/${organizationId}/workforce/workers`, {
    selectedWorkerId,
  });
}

export function buildWorkOrdersHref(
  organizationId: string,
  selectedWorkOrderId?: string | null,
): string {
  return buildHref(`/orgs/${organizationId}/demand/work-orders`, {
    selectedWorkOrderId,
  });
}

export function buildMaterialsHref(organizationId: string): string {
  return `/orgs/${organizationId}/resources/materials`;
}

export function buildEquipmentHref(
  organizationId: string,
  selectedEquipmentId?: string | null,
): string {
  return buildHref(`/orgs/${organizationId}/resources/equipment`, {
    selectedEquipmentId,
  });
}

export function buildPlannerRunHref(
  organizationId: string,
  query?: {
    scenarioId?: string | null;
  },
): string {
  return buildHref(`/orgs/${organizationId}/planning/run`, query);
}

export function buildPlannerResultsHref(
  organizationId: string,
  query?: {
    runId?: string | null;
    compareToRunId?: string | null;
  },
): string {
  return buildHref(`/orgs/${organizationId}/planning/results`, query);
}

function classifyIssue(message: string): PlannerIssueGroupKey {
  const normalized = message.toLowerCase();

  if (normalized.includes("draft planner created")) {
    return "summary";
  }
  if (normalized.includes("worker")) {
    return "workforce";
  }
  if (normalized.includes("dependency") || normalized.includes("work order")) {
    return "demand";
  }
  if (normalized.includes("material") || normalized.includes("equipment")) {
    return "resources";
  }

  return "planner";
}

function issueActions(
  organizationId: string,
  message: string,
): PlannerReviewAction[] {
  const normalized = message.toLowerCase();

  if (normalized.includes("no workers")) {
    return [{ label: "Open workers", href: buildWorkersHref(organizationId) }];
  }

  if (
    normalized.includes("no work orders")
    || normalized.includes("dependency")
    || normalized.includes("cyclic")
    || normalized.includes("unknown predecessor")
    || normalized.includes("unknown successor")
  ) {
    return [{ label: "Open backlog", href: buildWorkOrdersHref(organizationId) }];
  }

  if (normalized.includes("material")) {
    return [{ label: "Open materials", href: buildMaterialsHref(organizationId) }];
  }

  if (normalized.includes("equipment")) {
    return [{ label: "Open equipment", href: buildEquipmentHref(organizationId) }];
  }

  return [{ label: "Open run form", href: buildPlannerRunHref(organizationId) }];
}

function classifyUnassignedReason(reason: string): UnassignedReviewBucketKey {
  const normalized = reason.toLowerCase();

  if (normalized.includes("dependency") || normalized.includes("predecessor")) {
    return "dependency";
  }
  if (normalized.includes("material") || normalized.includes("equipment")) {
    return "resources";
  }
  if (
    normalized.includes("worker")
    || normalized.includes("skill")
    || normalized.includes("certification")
    || normalized.includes("schedule")
  ) {
    return "workforce";
  }

  return "other";
}

function unassignedActions(
  organizationId: string,
  item: UnassignedWork,
): PlannerReviewAction[] {
  const normalized = item.reason.toLowerCase();
  const actions: PlannerReviewAction[] = [
    {
      label: "Open work order",
      href: buildWorkOrdersHref(organizationId, item.work_order_id),
    },
  ];

  if (
    normalized.includes("worker")
    || normalized.includes("skill")
    || normalized.includes("certification")
    || normalized.includes("schedule")
  ) {
    actions.push({
      label: "Open workers",
      href: buildWorkersHref(organizationId),
    });
  }

  if (normalized.includes("material")) {
    actions.push({
      label: "Open materials",
      href: buildMaterialsHref(organizationId),
    });
  }

  if (normalized.includes("equipment")) {
    actions.push({
      label: "Open equipment",
      href: buildEquipmentHref(organizationId),
    });
  }

  return actions;
}

export function assignmentChangeActions(
  organizationId: string,
  change: PlanRunAssignmentChange,
): PlannerReviewAction[] {
  const actions: PlannerReviewAction[] = [
    {
      label: "Open work order",
      href: buildWorkOrdersHref(organizationId, change.work_order_id),
    },
  ];

  const candidateWorkerId = change.candidate_assignment?.worker_id;
  const baselineWorkerId = change.baseline_assignment?.worker_id;

  if (candidateWorkerId) {
    actions.push({
      label: "Open current worker",
      href: buildWorkersHref(organizationId, candidateWorkerId),
    });
  }

  if (baselineWorkerId && baselineWorkerId !== candidateWorkerId) {
    actions.push({
      label: "Open previous worker",
      href: buildWorkersHref(organizationId, baselineWorkerId),
    });
  }

  const materialCount =
    Object.keys(change.candidate_assignment?.reserved_material_quantities ?? {}).length
    + Object.keys(change.baseline_assignment?.reserved_material_quantities ?? {}).length;
  if (materialCount > 0) {
    actions.push({
      label: "Open materials",
      href: buildMaterialsHref(organizationId),
    });
  }

  const equipmentCount =
    (change.candidate_assignment?.reserved_equipment_ids.length ?? 0)
    + (change.baseline_assignment?.reserved_equipment_ids.length ?? 0);
  if (equipmentCount > 0) {
    actions.push({
      label: "Open equipment",
      href: buildEquipmentHref(organizationId),
    });
  }

  return actions;
}

export function unassignedChangeActions(
  organizationId: string,
  change: PlanRunUnassignedChange,
): PlannerReviewAction[] {
  return unassignedActions(organizationId, {
    work_order_id: change.work_order_id,
    reason: change.candidate_reason ?? change.baseline_reason ?? "Planner exception",
  });
}

export function issueChangeActions(
  organizationId: string,
  change: PlanRunIssueChange,
): PlannerReviewAction[] {
  return issueActions(organizationId, change.message);
}

export function groupPlannerIssues(
  organizationId: string,
  issues: string[],
): PlannerIssueGroup[] {
  const buckets = new Map<PlannerIssueGroupKey, PlannerIssueGroup["items"]>();

  for (const message of issues) {
    const key = classifyIssue(message);
    const current = buckets.get(key) ?? [];
    current.push({
      message,
      actions: issueActions(organizationId, message),
    });
    buckets.set(key, current);
  }

  return Array.from(buckets.entries()).map(([key, items]) => ({
    key,
    title: issueGroupMeta[key].title,
    description: issueGroupMeta[key].description,
    items,
  }));
}

export function groupUnassignedWork(
  organizationId: string,
  items: UnassignedWork[],
): UnassignedReviewBucket[] {
  const buckets = new Map<UnassignedReviewBucketKey, UnassignedReviewBucket["items"]>();

  for (const item of items) {
    const key = classifyUnassignedReason(item.reason);
    const current = buckets.get(key) ?? [];
    current.push({
      item,
      actions: unassignedActions(organizationId, item),
    });
    buckets.set(key, current);
  }

  return Array.from(buckets.entries()).map(([key, bucketItems]) => ({
    key,
    title: unassignedBucketMeta[key].title,
    description: unassignedBucketMeta[key].description,
    items: bucketItems,
  }));
}

export function summarizePlannerOutcome(summary: PlanRunSummary): PlannerOutcomeStats {
  const counts = new Map<UnassignedReviewBucketKey, number>();

  for (const item of summary.unassigned) {
    const key = classifyUnassignedReason(item.reason);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    assignments: summary.assignments.length,
    unassigned: summary.unassigned.length,
    issues: summary.issues.length,
    dependencyBlocks: counts.get("dependency") ?? 0,
    resourceShortages: counts.get("resources") ?? 0,
    workforceGaps: counts.get("workforce") ?? 0,
  };
}
