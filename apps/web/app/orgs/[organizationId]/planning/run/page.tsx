"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  BookmarkPlus,
  ClipboardList,
  Copy,
  GitBranch,
  HardHat,
  ScanSearch,
  Sparkles,
  Wrench,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import { formatDateTime, toDateTimeLocalValue, toIsoOrNull } from "@/lib/format";
import {
  buildMaterialsHref,
  buildPlannerRunHref,
  buildWorkOrdersHref,
  buildWorkersHref,
} from "@/lib/planner-review";
import type {
  Location,
  OrganizationPlanningRequest,
  PlanningHorizon,
  PlanningUnit,
  PlanRun,
  PlanScenario,
  WorkOrder,
  Worker,
} from "@/lib/api/types";

const initialPlannerForm = {
  scenario_name: "weekly-draft",
  planning_horizon_id: "",
  window_start: "",
  window_end: "",
  location_ids: [] as string[],
  planning_unit_ids: [] as string[],
  worker_statuses: ["active"] as string[],
  work_order_statuses: ["open", "in_progress"] as string[],
};

const initialScenarioDraft = {
  name: "",
  description: "",
  notes: "",
  labelsText: "",
  status: "active",
};

const initialHorizonDraft = {
  name: "",
  description: "",
  timezone: "UTC",
  start_at: "",
  end_at: "",
  status: "active",
};

function parseScenarioLabels(labelsText: string): string[] {
  return labelsText
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

function summarizeScenarioLineage(
  scenario: PlanScenario,
  allScenarios: PlanScenario[],
): string {
  const fragments = [
    `${scenario.planning_request.location_ids.length} locations`,
    `${scenario.planning_request.planning_unit_ids.length} planning units`,
  ];

  if (scenario.base_scenario_id) {
    const parent = allScenarios.find((item) => item.id === scenario.base_scenario_id);
    fragments.push(`branched from ${parent?.name ?? "another scenario"}`);
  }

  if (scenario.source_run_id) {
    fragments.push("saved from a plan run");
  }

  return fragments.join(" · ");
}

function fetchPlannerInputs(organizationId: string) {
  return Promise.all([
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
    apiRequest<PlanningHorizon[]>(`/organizations/${organizationId}/planning-horizons`),
    apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
    apiRequest<Worker[]>(`/organizations/${organizationId}/workers`),
    apiRequest<WorkOrder[]>(`/organizations/${organizationId}/work-orders`),
    apiRequest<PlanScenario[]>(`/organizations/${organizationId}/plan-scenarios`),
  ]);
}

function toggleSelection(values: string[], candidate: string): string[] {
  return values.includes(candidate)
    ? values.filter((value) => value !== candidate)
    : [...values, candidate];
}

function toPlanningRequest(form: typeof initialPlannerForm): OrganizationPlanningRequest {
  return {
    scenario_name: form.scenario_name,
    planning_horizon_id: form.planning_horizon_id || null,
    worker_ids: [],
    work_order_ids: [],
    location_ids: form.location_ids,
    planning_unit_ids: form.planning_unit_ids,
    worker_statuses: form.worker_statuses,
    work_order_statuses: form.work_order_statuses,
    window_start: toIsoOrNull(form.window_start),
    window_end: toIsoOrNull(form.window_end),
  };
}

function toPlannerForm(request: OrganizationPlanningRequest): typeof initialPlannerForm {
  return {
    scenario_name: request.scenario_name,
    planning_horizon_id: request.planning_horizon_id ?? "",
    window_start: toDateTimeLocalValue(request.window_start),
    window_end: toDateTimeLocalValue(request.window_end),
    location_ids: request.location_ids,
    planning_unit_ids: request.planning_unit_ids,
    worker_statuses: request.worker_statuses,
    work_order_statuses: request.work_order_statuses,
  };
}

export default function PlannerRunPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const requestedScenarioId = searchParams.get("scenarioId");
  const [locations, setLocations] = useState<Location[]>([]);
  const [planningHorizons, setPlanningHorizons] = useState<PlanningHorizon[]>([]);
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [planScenarios, setPlanScenarios] = useState<PlanScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [scenarioDraft, setScenarioDraft] = useState(initialScenarioDraft);
  const [horizonDraft, setHorizonDraft] = useState(initialHorizonDraft);
  const [plannerForm, setPlannerForm] = useState(initialPlannerForm);
  const [planRun, setPlanRun] = useState<PlanRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const applyScenarioFromQuery = useEffectEvent((scenario: PlanScenario) => {
    setSelectedScenarioId(scenario.id);
    setScenarioDraft({
      name: scenario.name,
      description: scenario.description ?? "",
      notes: scenario.notes ?? "",
      labelsText: scenario.labels.join(", "),
      status: scenario.status,
    });
    setPlannerForm(toPlannerForm(scenario.planning_request));
    setError(null);
  });

  async function reloadPlannerInputs() {
    const [
      locationsResponse,
      planningHorizonsResponse,
      planningUnitsResponse,
      workersResponse,
      workOrdersResponse,
      planScenariosResponse,
    ] = await fetchPlannerInputs(organizationId);

    setLocations(locationsResponse);
    setPlanningHorizons(planningHorizonsResponse);
    setPlanningUnits(planningUnitsResponse);
    setWorkers(workersResponse);
    setWorkOrders(workOrdersResponse);
    setPlanScenarios(planScenariosResponse);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [
          locationsResponse,
          planningHorizonsResponse,
          planningUnitsResponse,
          workersResponse,
          workOrdersResponse,
          planScenariosResponse,
        ] = await fetchPlannerInputs(organizationId);
        if (cancelled) {
          return;
        }
        setLocations(locationsResponse);
        setPlanningHorizons(planningHorizonsResponse);
        setPlanningUnits(planningUnitsResponse);
        setWorkers(workersResponse);
        setWorkOrders(workOrdersResponse);
        setPlanScenarios(planScenariosResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load planner inputs.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!requestedScenarioId || selectedScenarioId === requestedScenarioId) {
      return;
    }

    const scenario = planScenarios.find((item) => item.id === requestedScenarioId);
    if (!scenario) {
      return;
    }

    applyScenarioFromQuery(scenario);
  }, [planScenarios, requestedScenarioId, selectedScenarioId]);

  const selectedScenario =
    planScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  const selectedScenarioParent = selectedScenario?.base_scenario_id
    ? planScenarios.find((scenario) => scenario.id === selectedScenario.base_scenario_id) ?? null
    : null;
  const selectedScenarioChildren = selectedScenario
    ? planScenarios.filter((scenario) => scenario.base_scenario_id === selectedScenario.id)
    : [];

  function applyScenario(scenario: PlanScenario) {
    setSelectedScenarioId(scenario.id);
    setScenarioDraft({
      name: scenario.name,
      description: scenario.description ?? "",
      notes: scenario.notes ?? "",
      labelsText: scenario.labels.join(", "),
      status: scenario.status,
    });
    setPlannerForm(toPlannerForm(scenario.planning_request));
    router.replace(buildPlannerRunHref(organizationId, { scenarioId: scenario.id }));
    setError(null);
  }

  function resetScenarioSelection() {
    setSelectedScenarioId("");
    setScenarioDraft(initialScenarioDraft);
    router.replace(buildPlannerRunHref(organizationId));
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Run"
        description="Choose scope. Make a draft."
        icon={Sparkles}
        chips={
          <div className="chip-row">
            <StatusChip value={`${workers.length} workers`} />
            <StatusChip value={`${workOrders.length} work orders`} />
            <StatusChip value={`${locations.length} locations`} />
            <StatusChip value={`${planningHorizons.length} horizons`} />
            <StatusChip value={`${planningUnits.length} planning units`} />
            <StatusChip value={`${planScenarios.length} scenarios`} />
          </div>
        }
        actions={
          planRun ? (
            <Link
              className="ghost-link"
              href={`/orgs/${organizationId}/planning/results?runId=${planRun.id}`}
            >
              Review latest
            </Link>
          ) : null
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="flow-strip" aria-label="Planner workflow">
        <div className="flow-step flow-step--active">
          <span>1</span>
          <strong>Scope</strong>
          <p>Window and limits</p>
        </div>
        <div className="flow-step">
          <span>2</span>
          <strong>Solve</strong>
          <p>Fit work to capacity</p>
        </div>
        <div className="flow-step">
          <span>3</span>
          <strong>Review</strong>
          <p>Fix exceptions</p>
        </div>
        <div className="flow-actions">
          <Link className="ghost-link" href={buildWorkersHref(organizationId)}>
            <HardHat size={16} />
            People
          </Link>
          <Link className="ghost-link" href={buildWorkOrdersHref(organizationId)}>
            <ClipboardList size={16} />
            Work
          </Link>
          <Link className="ghost-link" href={buildMaterialsHref(organizationId)}>
            <Wrench size={16} />
            Resources
          </Link>
        </div>
      </section>

      <section className="workspace-grid workspace-grid--wide-right">
        <SectionCard
          title="Scope"
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  const nextRun = await apiRequest<PlanRun>(
                    `/organizations/${organizationId}/plan-runs`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        ...toPlanningRequest(plannerForm),
                        scenario_id: selectedScenarioId || null,
                      }),
                    },
                  );

                  setPlanRun(nextRun);
                  setError(null);
                } catch (submitError) {
                  setError(
                    submitError instanceof Error
                      ? submitError.message
                      : "Unable to run the planner.",
                  );
                }
              });
            }}
          >
            <label className="form-field form-field--full">
              <span className="field-label">Scenario name</span>
              <input
                className="form-input"
                value={plannerForm.scenario_name}
                onChange={(event) =>
                  setPlannerForm((current) => ({
                    ...current,
                    scenario_name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-field form-field--full">
              <span className="field-label">Planning horizon</span>
              <select
                className="form-select"
                value={plannerForm.planning_horizon_id}
                onChange={(event) => {
                  const planningHorizonId = event.target.value;
                  const selectedHorizon = planningHorizons.find(
                    (horizon) => horizon.id === planningHorizonId,
                  );
                  setPlannerForm((current) => ({
                    ...current,
                    planning_horizon_id: planningHorizonId,
                    window_start: selectedHorizon
                      ? toDateTimeLocalValue(selectedHorizon.start_at)
                      : current.window_start,
                    window_end: selectedHorizon
                      ? toDateTimeLocalValue(selectedHorizon.end_at)
                      : current.window_end,
                  }));
                }}
              >
                <option value="">No saved horizon</option>
                {planningHorizons.map((horizon) => (
                  <option key={horizon.id} value={horizon.id}>
                    {horizon.name} · {formatDateTime(horizon.start_at)} to {formatDateTime(horizon.end_at)}
                  </option>
                ))}
              </select>
              <p className="field-helper">Horizon fills the dates.</p>
            </label>
            <label className="form-field">
              <span className="field-label">Window start</span>
              <input
                className="form-input"
                type="datetime-local"
                value={plannerForm.window_start}
                onChange={(event) =>
                  setPlannerForm((current) => ({
                    ...current,
                    window_start: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-field">
              <span className="field-label">Window end</span>
              <input
                className="form-input"
                type="datetime-local"
                value={plannerForm.window_end}
                onChange={(event) =>
                  setPlannerForm((current) => ({
                    ...current,
                    window_end: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-field form-field--full">
              <span className="field-label">Locations</span>
              <div className="selection-grid">
                {locations.map((location) => (
                  <label key={location.id} className="selection-card">
                    <input
                      type="checkbox"
                      checked={plannerForm.location_ids.includes(location.id)}
                      onChange={() =>
                        setPlannerForm((current) => ({
                          ...current,
                          location_ids: toggleSelection(current.location_ids, location.id),
                        }))
                      }
                    />
                    <span>{location.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-field form-field--full">
              <span className="field-label">Planning units</span>
              <div className="selection-grid">
                {planningUnits.map((planningUnit) => (
                  <label key={planningUnit.id} className="selection-card">
                    <input
                      type="checkbox"
                      checked={plannerForm.planning_unit_ids.includes(planningUnit.id)}
                      onChange={() =>
                        setPlannerForm((current) => ({
                          ...current,
                          planning_unit_ids: toggleSelection(
                            current.planning_unit_ids,
                            planningUnit.id,
                          ),
                        }))
                      }
                    />
                    <span>{planningUnit.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-field">
              <span className="field-label">Worker statuses</span>
              <div className="selection-grid selection-grid--compact">
                {["active", "inactive"].map((status) => (
                  <label key={status} className="selection-card">
                    <input
                      type="checkbox"
                      checked={plannerForm.worker_statuses.includes(status)}
                      onChange={() =>
                        setPlannerForm((current) => ({
                          ...current,
                          worker_statuses: toggleSelection(current.worker_statuses, status),
                        }))
                      }
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-field">
              <span className="field-label">Work-order statuses</span>
              <div className="selection-grid selection-grid--compact">
                {["open", "in_progress", "completed"].map((status) => (
                  <label key={status} className="selection-card">
                    <input
                      type="checkbox"
                      checked={plannerForm.work_order_statuses.includes(status)}
                      onChange={() =>
                        setPlannerForm((current) => ({
                          ...current,
                          work_order_statuses: toggleSelection(
                            current.work_order_statuses,
                            status,
                          ),
                        }))
                      }
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {isPending ? "Solving..." : "Run plan"}
              </button>
            </div>
          </form>
        </SectionCard>

        <div className="page-stack">
          <SectionCard
            title="Horizons"
          >
            {planningHorizons.length === 0 ? (
              <EmptyState
                title="No horizons"
              />
            ) : (
              <ul className="token-list">
                {planningHorizons.map((horizon) => (
                  <li key={horizon.id} className="token-row">
                    <div>
                      <strong>{horizon.name}</strong>
                      <p>
                        {formatDateTime(horizon.start_at)} to {formatDateTime(horizon.end_at)} ·{" "}
                        {horizon.timezone}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setPlannerForm((current) => ({
                            ...current,
                            planning_horizon_id: horizon.id,
                            window_start: toDateTimeLocalValue(horizon.start_at),
                            window_end: toDateTimeLocalValue(horizon.end_at),
                          }));
                        }}
                      >
                        Use
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await apiDelete(
                                `/organizations/${organizationId}/planning-horizons/${horizon.id}`,
                              );
                              if (plannerForm.planning_horizon_id === horizon.id) {
                                setPlannerForm((current) => ({
                                  ...current,
                                  planning_horizon_id: "",
                                }));
                              }
                              await reloadPlannerInputs();
                              setError(null);
                            } catch (deleteError) {
                              setError(
                                deleteError instanceof Error
                                  ? deleteError.message
                                  : "Unable to delete the planning horizon.",
                              );
                            }
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  try {
                    await apiRequest<PlanningHorizon>(
                      `/organizations/${organizationId}/planning-horizons`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          ...horizonDraft,
                          description: horizonDraft.description || null,
                          start_at: toIsoOrNull(horizonDraft.start_at),
                          end_at: toIsoOrNull(horizonDraft.end_at),
                        }),
                      },
                    );
                    setHorizonDraft(initialHorizonDraft);
                    await reloadPlannerInputs();
                    setError(null);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the planning horizon.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Horizon name</span>
                <input
                  className="form-input"
                  value={horizonDraft.name}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Week 14 Operations"
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Timezone</span>
                <input
                  className="form-input"
                  value={horizonDraft.timezone}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, timezone: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Start</span>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={horizonDraft.start_at}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, start_at: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">End</span>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={horizonDraft.end_at}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, end_at: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={horizonDraft.status}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Description</span>
                <input
                  className="form-input"
                  value={horizonDraft.description}
                  onChange={(event) =>
                    setHorizonDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Weekly operational planning window"
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  Save horizon
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Scenarios"
            actions={
              selectedScenario ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={resetScenarioSelection}
                >
                  New scenario
                </button>
              ) : null
            }
          >
            {planScenarios.length === 0 ? (
              <EmptyState
                title="No scenarios"
              />
            ) : (
              <ul className="token-list">
                {planScenarios.map((scenario) => (
                  <li
                    key={scenario.id}
                    className={`token-row ${scenario.id === selectedScenarioId ? "is-selected" : ""}`}
                  >
                    <div>
                      <strong>{scenario.name}</strong>
                      <p>
                        {scenario.description || "No description"} ·{" "}
                        {summarizeScenarioLineage(scenario, planScenarios)}
                      </p>
                      <div className="chip-row chip-row--tight">
                        <StatusChip value={scenario.status} />
                        <StatusChip value={scenario.scenario_type.replaceAll("_", " ")} />
                        {scenario.labels.map((label) => (
                          <StatusChip key={`${scenario.id}-${label}`} value={label} tone="warning" />
                        ))}
                      </div>
                    </div>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => applyScenario(scenario)}
                      >
                        Load
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              const clonedScenario = await apiRequest<PlanScenario>(
                                `/organizations/${organizationId}/plan-scenarios/${scenario.id}/clone`,
                                {
                                  method: "POST",
                                },
                              );
                              await reloadPlannerInputs();
                              applyScenario(clonedScenario);
                              setError(null);
                            } catch (cloneError) {
                              setError(
                                cloneError instanceof Error
                                  ? cloneError.message
                                  : "Unable to clone the scenario.",
                              );
                            }
                          });
                        }}
                      >
                        <Copy size={16} />
                        Clone
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  try {
                    const payload = {
                      name: scenarioDraft.name,
                      description: scenarioDraft.description || null,
                      notes: scenarioDraft.notes || null,
                      labels: parseScenarioLabels(scenarioDraft.labelsText),
                      status: scenarioDraft.status,
                      planning_request: toPlanningRequest(plannerForm),
                    };

                    const savedScenario = selectedScenario
                      ? await apiRequest<PlanScenario>(
                          `/organizations/${organizationId}/plan-scenarios/${selectedScenario.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify(payload),
                          },
                        )
                      : await apiRequest<PlanScenario>(
                          `/organizations/${organizationId}/plan-scenarios`,
                          {
                            method: "POST",
                            body: JSON.stringify(payload),
                          },
                        );

                    await reloadPlannerInputs();
                    applyScenario(savedScenario);
                    setError(null);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the scenario.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Scenario name</span>
                <input
                  className="form-input"
                  value={scenarioDraft.name}
                  onChange={(event) =>
                    setScenarioDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Weekly maintenance draft"
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Description</span>
                <input
                  className="form-input"
                  value={scenarioDraft.description}
                  onChange={(event) =>
                    setScenarioDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Scope, assumptions, or notes"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={scenarioDraft.status}
                  onChange={(event) =>
                    setScenarioDraft((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Labels</span>
                <input
                  className="form-input"
                  value={scenarioDraft.labelsText}
                  onChange={(event) =>
                    setScenarioDraft((current) => ({
                      ...current,
                      labelsText: event.target.value,
                    }))
                  }
                  placeholder="weekly, municipal, high-priority"
                />
                <p className="field-helper">Comma-separated labels for filtering and branch clarity.</p>
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Notes</span>
                <textarea
                  className="form-textarea"
                  value={scenarioDraft.notes}
                  onChange={(event) =>
                    setScenarioDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Planning assumptions, review notes, or branch rationale"
                />
              </label>
              <div className="form-actions">
                <button className="ghost-button" type="submit" disabled={isPending}>
                  <BookmarkPlus size={16} />
                  {selectedScenario ? "Update scenario" : "Save scenario"}
                </button>
                {selectedScenario ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await apiDelete(
                            `/organizations/${organizationId}/plan-scenarios/${selectedScenario.id}`,
                          );
                          resetScenarioSelection();
                          await reloadPlannerInputs();
                          setError(null);
                        } catch (deleteError) {
                          setError(
                            deleteError instanceof Error
                              ? deleteError.message
                              : "Unable to delete the scenario.",
                          );
                        }
                      });
                    }}
                  >
                    Delete scenario
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Lineage"
          >
            {!selectedScenario ? (
              <EmptyState
                title="Select scenario"
              />
            ) : (
              <div className="page-stack">
                <div className="review-hero">
                  <div className="review-hero__copy">
                    <div className="icon-badge icon-badge--accent">
                      <GitBranch size={18} />
                    </div>
                    <div>
                      <strong>{selectedScenario.name}</strong>
                      <p>{selectedScenario.notes || selectedScenario.description || "No scenario notes yet."}</p>
                    </div>
                  </div>
                  <div className="chip-row chip-row--tight">
                    <StatusChip value={selectedScenario.status} />
                    <StatusChip value={selectedScenario.scenario_type.replaceAll("_", " ")} />
                    {selectedScenario.labels.map((label) => (
                      <StatusChip key={`${selectedScenario.id}-lineage-${label}`} value={label} tone="warning" />
                    ))}
                  </div>
                </div>

                <div className="workspace-grid">
                  <article className="review-group">
                    <div className="review-group__header">
                      <div>
                        <h3>Parent branch</h3>
                        <p>The scenario this version branched from.</p>
                      </div>
                    </div>
                    {selectedScenarioParent ? (
                      <div className="token-row">
                        <div>
                          <strong>{selectedScenarioParent.name}</strong>
                          <p>{selectedScenarioParent.description || "No description"}</p>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => applyScenario(selectedScenarioParent)}
                          >
                            Load parent
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="empty-state">This scenario has no parent branch.</p>
                    )}
                  </article>

                  <article className="review-group">
                    <div className="review-group__header">
                      <div>
                        <h3>Child branches</h3>
                        <p>Scenarios that were explicitly branched from this version.</p>
                      </div>
                    </div>
                    {selectedScenarioChildren.length === 0 ? (
                      <p className="empty-state">No child branches yet.</p>
                    ) : (
                      <ul className="token-list">
                        {selectedScenarioChildren.map((scenario) => (
                          <li key={scenario.id} className="token-row">
                            <div>
                              <strong>{scenario.name}</strong>
                              <p>{scenario.description || "No description"}</p>
                            </div>
                            <div className="inline-actions">
                              <button
                                className="ghost-button"
                                type="button"
                                onClick={() => applyScenario(scenario)}
                              >
                                Load branch
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>

                {selectedScenario.source_run_id ? (
                  <p className="field-helper">
                    This scenario was created from saved run <code>{selectedScenario.source_run_id}</code>.
                  </p>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Scope check"
          >
            <div className="metric-grid metric-grid--compact">
              <article className="metric-card">
                <p>People</p>
                <strong>{workers.length}</strong>
                <span>Available</span>
              </article>
              <article className="metric-card">
                <p>Work</p>
                <strong>{workOrders.length}</strong>
                <span>In scope</span>
              </article>
              <article className="metric-card">
                <p>Sites</p>
                <strong>{locations.length}</strong>
                <span>Filters</span>
              </article>
              <article className="metric-card">
                <p>Units</p>
                <strong>{planningUnits.length}</strong>
                <span>Filters</span>
              </article>
            </div>
          </SectionCard>

          <SectionCard
            title="Draft"
          >
            {planRun ? (
              <div className="page-stack">
                <div className="review-hero">
                  <div className="review-hero__copy">
                    <div className="icon-badge icon-badge--accent">
                      <ScanSearch size={18} />
                    </div>
                    <div>
                      <strong>Draft ready</strong>
                      <p>Review assignments and exceptions.</p>
                    </div>
                  </div>
                </div>
                <div className="chip-row">
                  <StatusChip value={planRun.status} tone="success" />
                  <StatusChip value={planRun.scenario_name} />
                  <StatusChip value={formatDateTime(planRun.created_at)} />
                  <StatusChip value={`${planRun.summary.assignments.length} assignments`} />
                  <StatusChip
                    value={`${planRun.summary.unassigned.length} unassigned`}
                    tone={planRun.summary.unassigned.length > 0 ? "warning" : "success"}
                  />
                  <StatusChip
                    value={`${planRun.summary.issues.length} issues`}
                    tone={planRun.summary.issues.length > 0 ? "warning" : "neutral"}
                  />
                  {selectedScenario ? <StatusChip value="Scenario linked" tone="neutral" /> : null}
                </div>

                {planRun.summary.assignments.length > 0 ? (
                  <DataTable columns={["Work order", "Worker", "Window", "Materials", "Equipment"]}>
                    {planRun.summary.assignments.slice(0, 6).map((assignment) => (
                      <tr key={`${assignment.work_order_id}-${assignment.worker_id}`}>
                        <td>
                          <Link
                            className="inline-link"
                            href={buildWorkOrdersHref(organizationId, assignment.work_order_id)}
                          >
                            {workOrders.find(
                              (workOrder) => workOrder.id === assignment.work_order_id,
                            )?.title ?? assignment.work_order_id}
                          </Link>
                        </td>
                        <td>
                          <Link
                            className="inline-link"
                            href={buildWorkersHref(organizationId, assignment.worker_id)}
                          >
                            {assignment.worker_name}
                          </Link>
                        </td>
                        <td>
                          {formatDateTime(assignment.scheduled_start_at)}
                          {" -> "}
                          {formatDateTime(assignment.scheduled_end_at)}
                        </td>
                        <td>{Object.keys(assignment.reserved_material_quantities).length}</td>
                        <td>{assignment.reserved_equipment_ids.length}</td>
                      </tr>
                    ))}
                  </DataTable>
                ) : (
                  <EmptyState
                    title="No assignments"
                  />
                )}

                <div className="form-actions">
                  <Link
                    className="ghost-link"
                    href={`/orgs/${organizationId}/planning/results?runId=${planRun.id}`}
                  >
                    Review draft
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No draft yet"
              />
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
