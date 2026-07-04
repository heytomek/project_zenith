"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  HardHat,
  PackageCheck,
  Waypoints,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiRequest } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import type {
  Equipment,
  InventoryPosition,
  Location,
  OperationsReport,
  Organization,
  PlanRun,
  PlanningUnit,
  WorkOrder,
  Worker,
} from "@/lib/api/types";

type PlanningStage = "setup" | "ready" | "draft" | "published" | "actuals";

type OverviewState = {
  organization: Organization | null;
  locations: Location[];
  planningUnits: PlanningUnit[];
  workers: Worker[];
  workOrders: WorkOrder[];
  inventoryPositions: InventoryPosition[];
  equipment: Equipment[];
  planRuns: PlanRun[];
  operationsReport: OperationsReport | null;
};

type ReadinessItem = {
  title: string;
  body: string;
  ok: boolean;
  href: string;
  action: string;
  count: string;
};

const emptyOverviewState: OverviewState = {
  organization: null,
  locations: [],
  planningUnits: [],
  workers: [],
  workOrders: [],
  inventoryPositions: [],
  equipment: [],
  planRuns: [],
  operationsReport: null,
};

function readinessTone(ok: boolean): "success" | "warning" {
  return ok ? "success" : "warning";
}

function stageTone(stage: PlanningStage): "success" | "warning" | "danger" | undefined {
  if (stage === "setup") {
    return "warning";
  }
  if (stage === "actuals" || stage === "published") {
    return "success";
  }
  return undefined;
}

export default function OverviewPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [state, setState] = useState<OverviewState>(emptyOverviewState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    async function loadOverview() {
      try {
        const [
          organization,
          locations,
          planningUnits,
          workers,
          workOrders,
          inventoryPositions,
          equipment,
          planRuns,
        ] = await Promise.all([
          apiRequest<Organization>(`/organizations/${organizationId}`),
          apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
          apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
          apiRequest<Worker[]>(`/organizations/${organizationId}/workers`),
          apiRequest<WorkOrder[]>(`/organizations/${organizationId}/work-orders`),
          apiRequest<InventoryPosition[]>(
            `/organizations/${organizationId}/inventory-positions`,
          ),
          apiRequest<Equipment[]>(`/organizations/${organizationId}/equipment`),
          apiRequest<PlanRun[]>(`/organizations/${organizationId}/plan-runs`),
        ]);

        let operationsReport: OperationsReport | null = null;
        try {
          operationsReport = await apiRequest<OperationsReport>(
            `/organizations/${organizationId}/reports/operations`,
          );
        } catch {
          operationsReport = null;
        }

        setState({
          organization,
          locations,
          planningUnits,
          workers,
          workOrders,
          inventoryPositions,
          equipment,
          planRuns,
          operationsReport,
        });
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load plan context.",
        );
      }
    }

    void loadOverview();
  }, [organizationId]);

  const activeWorkers = state.workers.filter((worker) => worker.status === "active");
  const openWorkOrders = state.workOrders.filter((workOrder) =>
    ["open", "in_progress"].includes(workOrder.status),
  );
  const lowStockPositions = state.inventoryPositions.filter(
    (inventoryPosition) =>
      inventoryPosition.on_hand_quantity - inventoryPosition.reserved_quantity <= 3,
  );
  const activeEquipment = state.equipment.filter((equipment) => equipment.status === "active");
  const latestRun = state.planRuns[0] ?? null;
  const latestRunHref = `/orgs/${organizationId}/planning/results${
    latestRun ? `?runId=${latestRun.id}` : ""
  }`;
  const latestExceptionCount = latestRun
    ? latestRun.summary.unassigned.length + latestRun.summary.issues.length
    : 0;
  const actualsSummary = state.operationsReport?.summary;
  const hasActuals = actualsSummary
    ? actualsSummary.assignments_completed
      + actualsSummary.assignments_in_progress
      + actualsSummary.assignments_blocked
      + actualsSummary.assignments_cancelled
      + actualsSummary.blocked_event_count
      > 0
    : false;

  const readinessItems = useMemo<ReadinessItem[]>(() => [
    {
      title: "Structure",
      body: "Sites and planning units",
      ok: state.locations.length > 0 && state.planningUnits.length > 0,
      href: `/orgs/${organizationId}/settings/organization`,
      action: "Add structure",
      count: `${state.locations.length}/${state.planningUnits.length}`,
    },
    {
      title: "People",
      body: "Active workers",
      ok: activeWorkers.length > 0,
      href: `/orgs/${organizationId}/workforce/workers`,
      action: "Add people",
      count: String(activeWorkers.length),
    },
    {
      title: "Work",
      body: "Open work orders",
      ok: openWorkOrders.length > 0,
      href: `/orgs/${organizationId}/demand/work-orders`,
      action: "Add work",
      count: String(openWorkOrders.length),
    },
    {
      title: "Resources",
      body: "Materials or equipment",
      ok: state.inventoryPositions.length > 0 || activeEquipment.length > 0,
      href: `/orgs/${organizationId}/resources/materials`,
      action: "Add resources",
      count: `${state.inventoryPositions.length + activeEquipment.length}`,
    },
  ], [
    activeEquipment.length,
    activeWorkers.length,
    openWorkOrders.length,
    organizationId,
    state.inventoryPositions.length,
    state.locations.length,
    state.planningUnits.length,
  ]);

  const firstBlocker = readinessItems.find((item) => !item.ok);
  const stage: PlanningStage = firstBlocker
    ? "setup"
    : !latestRun
      ? "ready"
      : hasActuals
        ? "actuals"
        : latestRun.publication_status === "published"
          ? "published"
          : "draft";

  const command = {
    setup: {
      label: "setup",
      title: firstBlocker ? firstBlocker.action : "Finish setup",
      body: firstBlocker ? firstBlocker.body : "Missing input",
      href: firstBlocker?.href ?? `/orgs/${organizationId}/settings/organization`,
      action: firstBlocker?.action ?? "Finish setup",
    },
    ready: {
      label: "ready",
      title: "Run plan",
      body: "Core inputs exist",
      href: `/orgs/${organizationId}/planning/run`,
      action: "Run plan",
    },
    draft: {
      label: "draft",
      title: latestExceptionCount > 0 ? "Review exceptions" : "Review plan",
      body: latestExceptionCount > 0 ? `${latestExceptionCount} exceptions` : "Draft ready",
      href: latestRunHref,
      action: latestExceptionCount > 0 ? "Review exceptions" : "Review plan",
    },
    published: {
      label: "published",
      title: "Record actuals",
      body: "Plan is live",
      href: latestRunHref,
      action: "Record actuals",
    },
    actuals: {
      label: "actuals",
      title: "View actuals",
      body: "Field data is coming in",
      href: `/orgs/${organizationId}/planning/reports`,
      action: "View actuals",
    },
  }[stage];

  return (
    <div className="page-stack">
      <PageHeader
        title="Today"
        description="Turn work into a publishable plan."
        chips={
          <>
            <StatusChip value={command.label} tone={stageTone(stage)} />
            {state.organization ? <StatusChip value={state.organization.status} /> : null}
            {latestRun ? <StatusChip value={latestRun.publication_status} /> : null}
          </>
        }
        actions={
          <div className="action-row">
            <Link className="primary-button" href={command.href}>
              <ArrowRight size={16} />
              {command.action}
            </Link>
          </div>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="planner-command panel" aria-label="next step">
        <div className="planner-command__copy">
          <span>{command.label}</span>
          <h2>{command.title}</h2>
          <p>{command.body}</p>
        </div>
        <Link className="primary-button" href={command.href}>
          {command.action}
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="purpose-flow" aria-label="zenith flow">
        <div>
          <span>Input</span>
          <strong>Work</strong>
        </div>
        <div>
          <span>Capacity</span>
          <strong>People + resources</strong>
        </div>
        <div>
          <span>Output</span>
          <strong>Plan</strong>
        </div>
        <div>
          <span>Feedback</span>
          <strong>Actuals</strong>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card metric-card--with-icon">
          <div className="icon-badge">
            <ClipboardList size={18} />
          </div>
          <p>Work</p>
          <strong>{openWorkOrders.length}</strong>
          <span>{state.workOrders.length} total</span>
        </article>
        <article className="metric-card metric-card--with-icon">
          <div className="icon-badge">
            <HardHat size={18} />
          </div>
          <p>People</p>
          <strong>{activeWorkers.length}</strong>
          <span>{state.workers.length} total</span>
        </article>
        <article className="metric-card metric-card--with-icon">
          <div className="icon-badge">
            <Waypoints size={18} />
          </div>
          <p>Plan</p>
          <strong>{latestRun ? latestRun.summary.assignments.length : 0}</strong>
          <span>{latestRun ? latestRun.review_status : "Not run"}</span>
        </article>
        <article className="metric-card metric-card--with-icon">
          <div className="icon-badge icon-badge--warning">
            <AlertTriangle size={18} />
          </div>
          <p>Exceptions</p>
          <strong>{latestExceptionCount}</strong>
          <span>{lowStockPositions.length} low stock</span>
        </article>
      </section>

      <section className="overview-grid">
        <SectionCard title="Inputs">
          <div className="input-status-grid">
            {readinessItems.map((item) => (
              <Link key={item.title} className="input-status" href={item.href}>
                <span className={`readiness-item__icon readiness-item__icon--${readinessTone(item.ok)}`}>
                  {item.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
                <StatusChip
                  value={item.ok ? item.count : "Missing"}
                  tone={readinessTone(item.ok)}
                />
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Latest plan"
          actions={
            latestRun ? (
              <Link className="ghost-link" href={latestRunHref}>
                Review
              </Link>
            ) : null
          }
        >
          {latestRun ? (
            <div className="review-group">
              <div className="review-group__header">
                <div>
                  <h3>{latestRun.scenario_name}</h3>
                  <p>{formatDateTime(latestRun.created_at)}</p>
                </div>
                <div className="inline-actions">
                  <StatusChip value={latestRun.review_status} tone="success" />
                  <StatusChip value={latestRun.publication_status} />
                </div>
              </div>
              <ul className="plain-list">
                <li>{latestRun.summary.assignments.length} assignments</li>
                <li>{latestRun.summary.unassigned.length} unassigned</li>
                <li>{latestRun.summary.issues.length} issues</li>
              </ul>
            </div>
          ) : (
            <div className="empty-state">
              <PackageCheck size={22} />
              <h3>No plan yet</h3>
              <Link className="primary-button" href={`/orgs/${organizationId}/planning/run`}>
                Run plan
              </Link>
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
