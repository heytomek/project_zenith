"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  FileDown,
  HardHat,
  MapPinned,
  Package,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiRequest } from "@/lib/api/client";
import { formatDateTime, toIsoOrNull, toDateTimeLocalValue } from "@/lib/format";
import type {
  Location,
  OperationsAssignmentRow,
  OperationsBottleneckItem,
  OperationsReport,
  OperationsTrendPoint,
  PlanningUnit,
} from "@/lib/api/types";

type ReportFilterForm = {
  windowStart: string;
  windowEnd: string;
  locationId: string;
  planningUnitId: string;
};

function buildQuery(form: ReportFilterForm): string {
  const params = new URLSearchParams();
  const windowStart = toIsoOrNull(form.windowStart);
  const windowEnd = toIsoOrNull(form.windowEnd);

  if (windowStart) {
    params.set("window_start", windowStart);
  }
  if (windowEnd) {
    params.set("window_end", windowEnd);
  }
  if (form.locationId) {
    params.set("location_id", form.locationId);
  }
  if (form.planningUnitId) {
    params.set("planning_unit_id", form.planningUnitId);
  }

  return params.toString();
}

function executionTone(status: string) {
  if (status === "completed") {
    return "success" as const;
  }
  if (status === "blocked") {
    return "danger" as const;
  }
  if (status === "cancelled") {
    return "danger" as const;
  }
  if (status === "in_progress") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  return `${value} min`;
}

function formatSignedMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  if (value > 0) {
    return `+${value} min`;
  }
  return `${value} min`;
}

function reservationSummary(row: OperationsAssignmentRow): string {
  return [
    row.active_worker_reservation ? "worker active" : "worker released",
    `${row.active_equipment_reservations} equipment active`,
    `${row.active_material_reserved_quantity} material reserved`,
    `${row.consumed_material_quantity} material consumed`,
  ].join(" · ");
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

function bottleneckTone(score: number) {
  if (score >= 35) {
    return "danger" as const;
  }
  if (score >= 18) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function bottleneckLabel(category: OperationsBottleneckItem["category"]): string {
  if (category === "worker") {
    return "Worker";
  }
  if (category === "location") {
    return "Site";
  }
  if (category === "material") {
    return "Material";
  }
  return "Equipment";
}

function BottleneckIcon({ category }: { category: OperationsBottleneckItem["category"] }) {
  if (category === "worker") {
    return <Users size={18} />;
  }
  if (category === "location") {
    return <MapPinned size={18} />;
  }
  if (category === "material") {
    return <Package size={18} />;
  }
  return <Wrench size={18} />;
}

function trendBarSegmentWidth(
  value: number,
  total: number,
): string {
  if (total <= 0 || value <= 0) {
    return "0%";
  }
  return `${(value / total) * 100}%`;
}

export default function PlanningReportsPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigating, startTransition] = useTransition();
  const [filters, setFilters] = useState<ReportFilterForm>({
    windowStart: "",
    windowEnd: "",
    locationId: "",
    planningUnitId: "",
  });

  const requestedFilters = useMemo(
    () => ({
      windowStart: searchParams.get("window_start")
        ? toDateTimeLocalValue(searchParams.get("window_start"))
        : "",
      windowEnd: searchParams.get("window_end")
        ? toDateTimeLocalValue(searchParams.get("window_end"))
        : "",
      locationId: searchParams.get("location_id") ?? "",
      planningUnitId: searchParams.get("planning_unit_id") ?? "",
    }),
    [searchParams],
  );

  useEffect(() => {
    setFilters(requestedFilters);
  }, [requestedFilters]);

  useEffect(() => {
    let cancelled = false;
    const query = buildQuery(requestedFilters);
    const reportPath = query
      ? `/organizations/${organizationId}/reports/operations?${query}`
      : `/organizations/${organizationId}/reports/operations`;

    setLoading(true);
    setError(null);

    void Promise.all([
      apiRequest<OperationsReport>(reportPath),
      apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
      apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
    ])
      .then(([nextReport, nextLocations, nextPlanningUnits]) => {
        if (cancelled) {
          return;
        }
        setReport(nextReport);
        setLocations(nextLocations);
        setPlanningUnits(nextPlanningUnits);
      })
      .catch((nextError: Error) => {
        if (cancelled) {
          return;
        }
        setError(nextError.message);
        setReport(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, requestedFilters]);

  const exportHref = useMemo(() => {
    const query = buildQuery(requestedFilters);
    const path = `/api/v1/organizations/${organizationId}/reports/operations/export.csv`;
    return query ? `${path}?${query}` : path;
  }, [organizationId, requestedFilters]);

  const maxTrendAssignments = useMemo(() => {
    if (!report || report.trends.length === 0) {
      return 1;
    }
    return Math.max(...report.trends.map((point) => point.assignments_total), 1);
  }, [report]);

  function applyFilters() {
    const query = buildQuery(filters);
    startTransition(() => {
      router.replace(
        query
          ? `/orgs/${organizationId}/planning/reports?${query}`
          : `/orgs/${organizationId}/planning/reports`,
      );
    });
  }

  function resetFilters() {
    startTransition(() => {
      router.replace(`/orgs/${organizationId}/planning/reports`);
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Actuals"
        description="Compare plan to field."
        icon={BarChart3}
        chips={
          report ? (
            <>
              <StatusChip tone="success" value={`${report.summary.published_runs_count} published runs`} />
              <StatusChip tone="warning" value={`${report.summary.active_worker_reservations} active labor holds`} />
              <StatusChip tone="warning" value={`${report.summary.active_equipment_reservations} active equipment holds`} />
            </>
          ) : null
        }
        actions={
          <div className="inline-actions">
            <a className="ghost-link" href={exportHref}>
              <FileDown size={16} />
              Export CSV
            </a>
          </div>
        }
      />

      <SectionCard
        title="Scope"
        actions={
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={resetFilters} disabled={navigating}>
              Reset
            </button>
            <button className="primary-button" type="button" onClick={applyFilters} disabled={navigating}>
              Apply filters
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span className="field-label">Window Start</span>
            <input
              className="form-input"
              type="datetime-local"
              value={filters.windowStart}
              onChange={(event) =>
                setFilters((current) => ({ ...current, windowStart: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span className="field-label">Window End</span>
            <input
              className="form-input"
              type="datetime-local"
              value={filters.windowEnd}
              onChange={(event) =>
                setFilters((current) => ({ ...current, windowEnd: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span className="field-label">Location</span>
            <select
              className="form-select"
              value={filters.locationId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, locationId: event.target.value }))
              }
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="field-label">Planning Unit</span>
            <select
              className="form-select"
              value={filters.planningUnitId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, planningUnitId: event.target.value }))
              }
            >
              <option value="">All planning units</option>
              {planningUnits.map((planningUnit) => (
                <option key={planningUnit.id} value={planningUnit.id}>
                  {planningUnit.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <EmptyState
          title="Loading actuals"
        />
      ) : null}

      {!loading && report ? (
        <>
          <SectionCard
            title="Summary"
          >
            <div className="metric-grid">
              <article className="metric-card metric-card--with-icon">
                <div className="card__header">
                  <span className="icon-badge icon-badge--accent">
                    <BarChart3 size={18} />
                  </span>
                </div>
                <strong>{report.summary.assignments_total}</strong>
                <p>Published assignments</p>
                <span>
                  {report.summary.published_runs_count} runs in scope · {report.summary.assignments_cancelled} cancelled
                </span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="card__header">
                  <span className="icon-badge">
                    <Clock3 size={18} />
                  </span>
                </div>
                <strong>{report.summary.blocked_event_count}</strong>
                <p>Blocked field events</p>
                <span>{formatSignedMinutes(report.summary.total_duration_variance_minutes)} duration variance</span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="card__header">
                  <span className="icon-badge icon-badge--warning">
                    <HardHat size={18} />
                  </span>
                </div>
                <strong>{report.summary.active_worker_reservations}</strong>
                <p>Active worker reservations</p>
                <span>{report.summary.assignments_in_progress + report.summary.assignments_blocked} assignments still underway</span>
              </article>
              <article className="metric-card metric-card--with-icon">
                <div className="card__header">
                  <span className="icon-badge icon-badge--warning">
                    <Package size={18} />
                  </span>
                </div>
                <strong>{report.summary.active_reserved_material_units}</strong>
                <p>Reserved material units</p>
                <span>{report.summary.consumed_material_units} units already consumed</span>
              </article>
            </div>
          </SectionCard>

          <div className="overview-grid">
            <SectionCard
              title="Bottlenecks"
              subtitle="The strongest current pressure points across labor, sites, materials, and equipment."
            >
              {report.bottlenecks.length === 0 ? (
                <EmptyState
                  title="No bottlenecks"
                />
              ) : (
                <div className="bottleneck-grid">
                  {report.bottlenecks.map((item) => (
                    <article
                      key={`${item.category}-${item.label}-${item.secondary_label ?? "none"}`}
                      className="bottleneck-card"
                    >
                      <div className="card__header">
                        <div className="table-copy">
                          <div className="chip-row chip-row--tight">
                            <span className="icon-badge icon-badge--warning">
                              <BottleneckIcon category={item.category} />
                            </span>
                            <StatusChip
                              tone={bottleneckTone(item.severity_score)}
                              value={`${bottleneckLabel(item.category)} pressure`}
                            />
                          </div>
                          <strong>{item.label}</strong>
                          <p>
                            {item.secondary_label ? `${item.secondary_label} · ${item.detail}` : item.detail}
                          </p>
                        </div>
                        <StatusChip
                          tone={bottleneckTone(item.severity_score)}
                          value={`score ${item.severity_score}`}
                        />
                      </div>
                      <div className="bottleneck-meter" aria-hidden="true">
                        <span
                          className="bottleneck-meter__fill"
                          style={{ width: `${Math.min(100, item.severity_score * 2)}%` }}
                        />
                      </div>
                      <div className="chip-row chip-row--tight">
                        <StatusChip tone="neutral" value={`${item.assignments_total} assignments`} />
                        {item.assignments_blocked > 0 ? (
                          <StatusChip tone="danger" value={`${item.assignments_blocked} blocked`} />
                        ) : null}
                        {item.blocked_event_count > 0 ? (
                          <StatusChip tone="danger" value={`${item.blocked_event_count} blocked events`} />
                        ) : null}
                        {item.delayed_start_count > 0 ? (
                          <StatusChip tone="warning" value={`${item.delayed_start_count} delayed starts`} />
                        ) : null}
                        {item.active_reservations > 0 ? (
                          <StatusChip tone="warning" value={`${item.active_reservations} active holds`} />
                        ) : null}
                        {item.utilization_percent !== null ? (
                          <StatusChip tone="warning" value={`${formatPercent(item.utilization_percent)} utilized`} />
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Trends"
            >
              {report.trends.length === 0 ? (
                <EmptyState
                  title="No trends"
                />
              ) : (
                <DataTable
                  columns={[
                    "Bucket",
                    "Volume",
                    "Execution mix",
                    "Reservations",
                    "Variance",
                  ]}
                >
                  {report.trends.map((point) => (
                    <tr key={point.bucket_start}>
                      <td>
                        <div className="table-copy">
                          <strong>{point.bucket_label}</strong>
                          <p>
                            {report.trend_granularity === "week" ? "Weekly bucket" : "Daily bucket"} ·{" "}
                            {formatDateTime(point.bucket_start)}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="trend-volume">
                          <strong>{point.assignments_total} assignments</strong>
                          <div className="trend-bar" aria-hidden="true">
                            <span
                              className="trend-bar__segment trend-bar__segment--completed"
                              style={{
                                width: trendBarSegmentWidth(
                                  point.assignments_completed,
                                  point.assignments_total,
                                ),
                              }}
                            />
                            <span
                              className="trend-bar__segment trend-bar__segment--progress"
                              style={{
                                width: trendBarSegmentWidth(
                                  point.assignments_in_progress,
                                  point.assignments_total,
                                ),
                              }}
                            />
                            <span
                              className="trend-bar__segment trend-bar__segment--blocked"
                              style={{
                                width: trendBarSegmentWidth(
                                  point.assignments_blocked,
                                  point.assignments_total,
                                ),
                              }}
                            />
                            <span
                              className="trend-bar__segment trend-bar__segment--cancelled"
                              style={{
                                width: trendBarSegmentWidth(
                                  point.assignments_cancelled,
                                  point.assignments_total,
                                ),
                              }}
                            />
                            <span
                              className="trend-bar__segment trend-bar__segment--waiting"
                              style={{
                                width: trendBarSegmentWidth(
                                  point.assignments_not_started,
                                  point.assignments_total,
                                ),
                              }}
                            />
                          </div>
                          <p>{Math.round((point.assignments_total / maxTrendAssignments) * 100)}% of peak bucket volume</p>
                        </div>
                      </td>
                      <td>
                        <div className="chip-row chip-row--tight">
                          <StatusChip tone="success" value={`${point.assignments_completed} completed`} />
                          <StatusChip tone="warning" value={`${point.assignments_in_progress} in_progress`} />
                          <StatusChip tone="danger" value={`${point.assignments_blocked} blocked`} />
                          {point.assignments_cancelled > 0 ? (
                            <StatusChip tone="danger" value={`${point.assignments_cancelled} cancelled`} />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>
                            {point.active_worker_reservations} worker · {point.active_equipment_reservations} equipment
                          </strong>
                          <p>
                            {point.active_material_reserved_units} reserved material units ·{" "}
                            {formatMinutes(point.equipment_reserved_minutes)} equipment time
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>{formatSignedMinutes(point.total_duration_variance_minutes)}</strong>
                          <p>
                            {point.blocked_event_count} blocked events · {point.consumed_material_units} consumed
                            material units
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>

          <div className="overview-grid">
            <SectionCard
              title="Published"
            >
              {report.published_runs.length === 0 ? (
                <EmptyState
                  title="No published runs"
                />
              ) : (
                <DataTable
                  columns={[
                    "Run",
                    "Published",
                    "Assignments",
                    "Execution",
                    "Reservations",
                  ]}
                >
                  {report.published_runs.map((run) => (
                    <tr key={run.run_id}>
                      <td>
                        <div className="table-copy">
                          <strong>{run.scenario_name}</strong>
                          <p>{run.run_id}</p>
                        </div>
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>{formatDateTime(run.published_at)}</strong>
                          <p>{run.published_by_name ?? "Unknown publisher"}</p>
                        </div>
                      </td>
                      <td>{run.assignments_total}</td>
                      <td>
                        <div className="chip-row chip-row--tight">
                          <StatusChip tone="success" value={`${run.assignments_completed} completed`} />
                          <StatusChip tone="warning" value={`${run.assignments_in_progress} in_progress`} />
                          <StatusChip tone="danger" value={`${run.assignments_blocked} blocked`} />
                          {run.assignments_cancelled > 0 ? (
                            <StatusChip tone="danger" value={`${run.assignments_cancelled} cancelled`} />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>{run.active_reservations} active reservations</strong>
                          <p>{run.blocked_event_count} blocked events</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>

            <SectionCard
              title="Sites"
            >
              {report.location_breakdown.length === 0 ? (
                <EmptyState
                  title="No site activity"
                />
              ) : (
                <DataTable
                  columns={[
                    "Location",
                    "Assignments",
                    "Execution",
                    "Blocked Events",
                    "Reservations",
                  ]}
                >
                  {report.location_breakdown.map((location) => (
                    <tr key={location.location_id ?? location.location_name}>
                      <td>
                        <div className="table-copy">
                          <strong>{location.location_name}</strong>
                          <p>{formatMinutes(location.planned_minutes)} planned · {formatMinutes(location.actual_minutes)} actual</p>
                        </div>
                      </td>
                      <td>{location.assignments_total}</td>
                      <td>
                        <div className="chip-row chip-row--tight">
                          <StatusChip tone="success" value={`${location.assignments_completed} completed`} />
                          <StatusChip tone="warning" value={`${location.assignments_in_progress} in_progress`} />
                          <StatusChip tone="danger" value={`${location.assignments_blocked} blocked`} />
                          {location.assignments_cancelled > 0 ? (
                            <StatusChip tone="danger" value={`${location.assignments_cancelled} cancelled`} />
                          ) : null}
                        </div>
                      </td>
                      <td>{location.blocked_event_count}</td>
                      <td>{location.active_reservations}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>

          <div className="overview-grid">
            <SectionCard
              title="People"
            >
              {report.worker_breakdown.length === 0 ? (
                <EmptyState
                  title="No people activity"
                />
              ) : (
                <DataTable
                  columns={[
                    "Worker",
                    "Assignments",
                    "Planned",
                    "Actual",
                    "Active Holds",
                  ]}
                >
                  {report.worker_breakdown.map((worker) => (
                    <tr key={worker.worker_id}>
                      <td>
                        <div className="table-copy">
                          <strong>{worker.worker_name}</strong>
                          <p>{worker.blocked_event_count} blocked events</p>
                        </div>
                      </td>
                      <td>{worker.assignments_total}</td>
                      <td>{formatMinutes(worker.planned_minutes)}</td>
                      <td>{formatMinutes(worker.actual_minutes)}</td>
                      <td>{worker.active_reservations}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>

            <SectionCard
              title="Export"
            >
              {report.assignment_rows.length === 0 ? (
                <EmptyState
                  title="No rows"
                />
              ) : (
                <DataTable
                  columns={[
                    "Work Order",
                    "Worker",
                    "Execution",
                    "Planned vs Actual",
                    "Reservations",
                  ]}
                >
                  {report.assignment_rows.slice(0, 12).map((row) => (
                    <tr key={`${row.run_id}-${row.work_order_id}`}>
                      <td>
                        <div className="table-copy">
                          <strong>{row.work_order_title}</strong>
                          <p>{row.location_name ?? "Unknown site"} · {row.scenario_name}</p>
                        </div>
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>{row.worker_name}</strong>
                          <p>{row.planning_unit_name ?? "Unassigned unit"}</p>
                        </div>
                      </td>
                      <td>
                        <StatusChip tone={executionTone(row.execution_status)} value={row.execution_status} />
                      </td>
                      <td>
                        <div className="table-copy">
                          <strong>
                            {formatDateTime(row.scheduled_start_at)} {"->"} {formatDateTime(row.scheduled_end_at)}
                          </strong>
                          <p>{formatSignedMinutes(row.duration_variance_minutes)} duration variance</p>
                        </div>
                      </td>
                      <td>{reservationSummary(row)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>

          <div className="overview-grid">
            <SectionCard
              title="Materials"
            >
              {report.material_breakdown.length === 0 ? (
                <EmptyState
                  title="No material pressure"
                />
              ) : (
                <DataTable
                  columns={[
                    "Material",
                    "Location",
                    "On Hand",
                    "Reserved",
                    "Available",
                    "Consumed",
                  ]}
                >
                  {report.material_breakdown.map((material) => (
                    <tr key={`${material.material_id}-${material.location_id}`}>
                      <td>
                        <div className="table-copy">
                          <strong>{material.material_name}</strong>
                          <p>{material.material_code}</p>
                        </div>
                      </td>
                      <td>{material.location_name}</td>
                      <td>{material.on_hand_quantity}</td>
                      <td>
                        <div className="table-copy">
                          <strong>{material.reserved_quantity}</strong>
                          <p>{material.active_reserved_quantity} active in scope</p>
                        </div>
                      </td>
                      <td>{material.available_quantity}</td>
                      <td>{material.consumed_quantity}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>

            <SectionCard
              title="Equipment"
            >
              {report.equipment_breakdown.length === 0 ? (
                <EmptyState
                  title="No equipment activity"
                />
              ) : (
                <DataTable
                  columns={[
                    "Equipment",
                    "Type",
                    "Location",
                    "Assignments",
                    "Reserved Time",
                    "Active Holds",
                  ]}
                >
                  {report.equipment_breakdown.map((equipment) => (
                    <tr key={equipment.equipment_id}>
                      <td>
                        <div className="table-copy">
                          <strong>{equipment.equipment_code}</strong>
                          <p>{equipment.equipment_id}</p>
                        </div>
                      </td>
                      <td>{equipment.equipment_type_name}</td>
                      <td>{equipment.location_name}</td>
                      <td>{equipment.assignments_total}</td>
                      <td>{formatMinutes(equipment.reserved_minutes)}</td>
                      <td>{equipment.active_reservations}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
