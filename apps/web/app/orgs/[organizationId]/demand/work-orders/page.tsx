"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import { formatDateTime, toDateTimeLocalValue, toIsoOrNull, titleize } from "@/lib/format";
import type {
  EquipmentType,
  Location,
  Material,
  PlanningUnit,
  ServiceLevelPolicy,
  Skill,
  Certification,
  WorkOrder,
  WorkOrderDependency,
  WorkRequirement,
} from "@/lib/api/types";

const initialWorkOrderForm = {
  title: "",
  description: "",
  status: "open",
  priority: 50,
  requested_start_at: "",
  due_at: "",
  location_id: "",
  planning_unit_id: "",
  service_level_policy_id: "",
};

const initialRequirementForm = {
  requirement_type: "skill",
  reference_id: "",
  min_level: 1,
  quantity: 1,
  notes: "",
};

const initialDependencyForm = {
  predecessor_work_order_id: "",
  successor_work_order_id: "",
  dependency_type: "finish_to_start",
};

function fetchDemandSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<WorkOrder[]>(`/organizations/${organizationId}/work-orders`),
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
    apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
    apiRequest<ServiceLevelPolicy[]>(
      `/organizations/${organizationId}/service-level-policies`,
    ),
    apiRequest<WorkOrderDependency[]>(
      `/organizations/${organizationId}/work-order-dependencies`,
    ),
    apiRequest<Skill[]>(`/organizations/${organizationId}/skills`),
    apiRequest<Certification[]>(`/organizations/${organizationId}/certifications`),
    apiRequest<Material[]>(`/organizations/${organizationId}/materials`),
    apiRequest<EquipmentType[]>(`/organizations/${organizationId}/equipment-types`),
  ]);
}

function fetchRequirements(organizationId: string, workOrderId: string) {
  return apiRequest<WorkRequirement[]>(
    `/organizations/${organizationId}/work-orders/${workOrderId}/requirements`,
  );
}

function toWorkOrderForm(workOrder: WorkOrder) {
  return {
    title: workOrder.title,
    description: workOrder.description ?? "",
    status: workOrder.status,
    priority: workOrder.priority,
    requested_start_at: toDateTimeLocalValue(workOrder.requested_start_at),
    due_at: toDateTimeLocalValue(workOrder.due_at),
    location_id: workOrder.location_id,
    planning_unit_id: workOrder.planning_unit_id ?? "",
    service_level_policy_id: workOrder.service_level_policy_id ?? "",
  };
}

export default function WorkOrdersPage() {
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const initialSelectedWorkOrderId = searchParams.get("selectedWorkOrderId");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([]);
  const [policies, setPolicies] = useState<ServiceLevelPolicy[]>([]);
  const [dependencies, setDependencies] = useState<WorkOrderDependency[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [requirements, setRequirements] = useState<WorkRequirement[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(
    initialSelectedWorkOrderId,
  );
  const [workOrderForm, setWorkOrderForm] = useState(initialWorkOrderForm);
  const [requirementForm, setRequirementForm] = useState(initialRequirementForm);
  const [dependencyForm, setDependencyForm] = useState(initialDependencyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadDemandSnapshot() {
    const [
      workOrdersResponse,
      locationsResponse,
      planningUnitsResponse,
      policiesResponse,
      dependenciesResponse,
      skillsResponse,
      certificationsResponse,
      materialsResponse,
      equipmentTypesResponse,
    ] = await fetchDemandSnapshot(organizationId);

    setWorkOrders(workOrdersResponse);
    setLocations(locationsResponse);
    setPlanningUnits(planningUnitsResponse);
    setPolicies(policiesResponse);
    setDependencies(dependenciesResponse);
    setSkills(skillsResponse);
    setCertifications(certificationsResponse);
    setMaterials(materialsResponse);
    setEquipmentTypes(equipmentTypesResponse);
    setError(null);
  }

  async function reloadRequirements(workOrderId: string) {
    const requirementsResponse = await fetchRequirements(organizationId, workOrderId);
    setRequirements(requirementsResponse);
    setError(null);
  }

  const reloadRequirementsEvent = useEffectEvent(reloadRequirements);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [
          workOrdersResponse,
          locationsResponse,
          planningUnitsResponse,
          policiesResponse,
          dependenciesResponse,
          skillsResponse,
          certificationsResponse,
          materialsResponse,
          equipmentTypesResponse,
        ] = await fetchDemandSnapshot(organizationId);
        if (cancelled) {
          return;
        }
        setWorkOrders(workOrdersResponse);
        setLocations(locationsResponse);
        setPlanningUnits(planningUnitsResponse);
        setPolicies(policiesResponse);
        setDependencies(dependenciesResponse);
        setSkills(skillsResponse);
        setCertifications(certificationsResponse);
        setMaterials(materialsResponse);
        setEquipmentTypes(equipmentTypesResponse);
        if (initialSelectedWorkOrderId) {
          const selectedWorkOrderFromUrl = workOrdersResponse.find(
            (workOrder) => workOrder.id === initialSelectedWorkOrderId,
          );
          if (selectedWorkOrderFromUrl) {
            setWorkOrderForm(toWorkOrderForm(selectedWorkOrderFromUrl));
            void reloadRequirementsEvent(selectedWorkOrderFromUrl.id);
            setDependencyForm((current) => ({
              ...current,
              predecessor_work_order_id:
                current.predecessor_work_order_id || selectedWorkOrderFromUrl.id,
            }));
          }
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load work-order data.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialSelectedWorkOrderId, organizationId]);

  function startNewWorkOrder() {
    setSelectedWorkOrderId(null);
    setWorkOrderForm(initialWorkOrderForm);
    setRequirements([]);
    setRequirementForm(initialRequirementForm);
    setDependencyForm(initialDependencyForm);
  }

  function selectWorkOrder(workOrder: WorkOrder) {
    setSelectedWorkOrderId(workOrder.id);
    setWorkOrderForm(toWorkOrderForm(workOrder));
    void reloadRequirements(workOrder.id);
    setDependencyForm((current) => ({
      ...current,
      predecessor_work_order_id: current.predecessor_work_order_id || workOrder.id,
    }));
  }

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredWorkOrders = workOrders.filter((workOrder) => {
    const matchesStatus = statusFilter === "all" || workOrder.status === statusFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      workOrder.title.toLowerCase().includes(normalizedSearch) ||
      (workOrder.description ?? "").toLowerCase().includes(normalizedSearch);
    return matchesStatus && matchesSearch;
  });

  const selectedWorkOrder =
    workOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) ?? null;

  const selectedDependencies = selectedWorkOrder
    ? dependencies.filter(
        (dependency) =>
          dependency.predecessor_work_order_id === selectedWorkOrder.id ||
          dependency.successor_work_order_id === selectedWorkOrder.id,
      )
    : [];

  const referenceOptions =
    requirementForm.requirement_type === "skill"
      ? skills.map((skill) => ({ id: skill.id, label: `${skill.code} · ${skill.name}` }))
      : requirementForm.requirement_type === "certification"
        ? certifications.map((certification) => ({
            id: certification.id,
            label: `${certification.code} · ${certification.name}`,
          }))
        : requirementForm.requirement_type === "material"
          ? materials.map((material) => ({
              id: material.id,
              label: `${material.sku} · ${material.name}`,
            }))
          : requirementForm.requirement_type === "equipment_type"
            ? equipmentTypes.map((equipmentType) => ({
                id: equipmentType.id,
                label: `${equipmentType.code} · ${equipmentType.name}`,
              }))
            : [];

  return (
    <div className="page-stack">
      <PageHeader
        title="Work"
        description="Demand to schedule."
        icon={ClipboardList}
        actions={
          <button className="primary-button" type="button" onClick={startNewWorkOrder}>
            New work order
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid workspace-grid--wide-right">
        <div className="page-stack">
          <SectionCard
            title="Backlog"
          >
            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Search title or description"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">all statuses</option>
                <option value="open">open</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
              </select>
            </div>

            {filteredWorkOrders.length === 0 ? (
              <EmptyState
                title="No matching work"
                body="Create work or clear filters."
              />
            ) : (
              <DataTable columns={["Title", "Priority", "Location", "Due", "Status"]}>
                {filteredWorkOrders.map((workOrder) => (
                  <tr
                    key={workOrder.id}
                    className={workOrder.id === selectedWorkOrderId ? "is-selected" : ""}
                    onClick={() => selectWorkOrder(workOrder)}
                  >
                    <td>{workOrder.title}</td>
                    <td>{workOrder.priority}</td>
                    <td>
                      {locations.find((location) => location.id === workOrder.location_id)?.name ??
                        "Unknown"}
                    </td>
                    <td>{formatDateTime(workOrder.due_at)}</td>
                    <td>
                      <StatusChip
                        tone={workOrder.status === "completed" ? "warning" : "success"}
                        value={workOrder.status}
                      />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        </div>

        <div className="page-stack">
          <SectionCard
            title={selectedWorkOrder ? "Edit work order" : "Create work order"}
            subtitle="Demand, requirements, timing."
            actions={
              selectedWorkOrder ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/work-orders/${selectedWorkOrder.id}`,
                        );
                        startNewWorkOrder();
                        await reloadDemandSnapshot();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the work order.",
                        );
                      }
                    });
                  }}
                >
                  Delete
                </button>
              ) : null
            }
          >
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const payload = {
                  ...workOrderForm,
                  description: workOrderForm.description || null,
                  requested_start_at: toIsoOrNull(workOrderForm.requested_start_at),
                  due_at: toIsoOrNull(workOrderForm.due_at),
                  planning_unit_id: workOrderForm.planning_unit_id || null,
                  service_level_policy_id: workOrderForm.service_level_policy_id || null,
                };

                startTransition(async () => {
                  try {
                    const savedWorkOrder = selectedWorkOrder
                      ? await apiRequest<WorkOrder>(
                          `/organizations/${organizationId}/work-orders/${selectedWorkOrder.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify(payload),
                          },
                        )
                      : await apiRequest<WorkOrder>(
                          `/organizations/${organizationId}/work-orders`,
                          {
                            method: "POST",
                            body: JSON.stringify(payload),
                          },
                        );

                    setSelectedWorkOrderId(savedWorkOrder.id);
                    setWorkOrderForm(toWorkOrderForm(savedWorkOrder));
                    await reloadDemandSnapshot();
                    await reloadRequirements(savedWorkOrder.id);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the work order.",
                    );
                  }
                });
              }}
            >
              <label className="form-field form-field--full">
                <span className="field-label">Title</span>
                <input
                  className="form-input"
                  value={workOrderForm.title}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Description</span>
                <textarea
                  className="form-textarea"
                  value={workOrderForm.description}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={workOrderForm.status}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="completed">completed</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Priority</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={100}
                  value={workOrderForm.priority}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      priority: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Requested start</span>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={workOrderForm.requested_start_at}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      requested_start_at: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Due at</span>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={workOrderForm.due_at}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      due_at: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Location</span>
                <select
                  className="form-select"
                  value={workOrderForm.location_id}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      location_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Planning unit</span>
                <select
                  className="form-select"
                  value={workOrderForm.planning_unit_id}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      planning_unit_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {planningUnits.map((planningUnit) => (
                    <option key={planningUnit.id} value={planningUnit.id}>
                      {planningUnit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Service-level policy</span>
                <select
                  className="form-select"
                  value={workOrderForm.service_level_policy_id}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      service_level_policy_id: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {policies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedWorkOrder ? "Save work order" : "Create work order"}
                </button>
              </div>
            </form>
          </SectionCard>

          {selectedWorkOrder ? (
            <>
              <SectionCard
                title="Requirements"
              >
                {requirements.length === 0 ? (
                  <EmptyState
                    title="No requirements"
                  />
                ) : (
                  <ul className="token-list">
                    {requirements.map((requirement) => (
                      <li key={requirement.id} className="token-row">
                        <div>
                          <strong>{titleize(requirement.requirement_type)}</strong>
                          <p>
                            quantity {requirement.quantity}
                            {requirement.min_level ? ` · min level ${requirement.min_level}` : ""}
                            {requirement.notes ? ` · ${requirement.notes}` : ""}
                          </p>
                        </div>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await apiDelete(
                                  `/organizations/${organizationId}/work-orders/${selectedWorkOrder.id}/requirements/${requirement.id}`,
                                );
                                await reloadRequirements(selectedWorkOrder.id);
                              } catch (deleteError) {
                                setError(
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "Unable to delete the requirement.",
                                );
                              }
                            });
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const needsReference = !["headcount", "location_access"].includes(
                      requirementForm.requirement_type,
                    );
                    const payload = {
                      ...requirementForm,
                      reference_id: needsReference ? requirementForm.reference_id || null : null,
                      min_level:
                        requirementForm.requirement_type === "skill"
                          ? requirementForm.min_level
                          : null,
                      notes: requirementForm.notes || null,
                    };

                    startTransition(async () => {
                      try {
                        await apiRequest<WorkRequirement>(
                          `/organizations/${organizationId}/work-orders/${selectedWorkOrder.id}/requirements`,
                          {
                            method: "POST",
                            body: JSON.stringify(payload),
                          },
                        );
                        setRequirementForm(initialRequirementForm);
                        await reloadRequirements(selectedWorkOrder.id);
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to create the requirement.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Requirement type</span>
                    <select
                      className="form-select"
                      value={requirementForm.requirement_type}
                      onChange={(event) =>
                        setRequirementForm((current) => ({
                          ...current,
                          requirement_type: event.target.value,
                          reference_id: "",
                        }))
                      }
                    >
                      <option value="skill">skill</option>
                      <option value="certification">certification</option>
                      <option value="material">material</option>
                      <option value="equipment_type">equipment_type</option>
                      <option value="headcount">headcount</option>
                    </select>
                  </label>
                  {referenceOptions.length > 0 ? (
                    <label className="form-field">
                      <span className="field-label">Reference</span>
                      <select
                        className="form-select"
                        value={requirementForm.reference_id}
                        onChange={(event) =>
                          setRequirementForm((current) => ({
                            ...current,
                            reference_id: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a reference</option>
                        {referenceOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {requirementForm.requirement_type === "skill" ? (
                    <label className="form-field">
                      <span className="field-label">Minimum level</span>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={5}
                        value={requirementForm.min_level}
                        onChange={(event) =>
                          setRequirementForm((current) => ({
                            ...current,
                            min_level: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  <label className="form-field">
                    <span className="field-label">Quantity</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={requirementForm.quantity}
                      onChange={(event) =>
                        setRequirementForm((current) => ({
                          ...current,
                          quantity: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="form-field form-field--full">
                    <span className="field-label">Notes</span>
                    <input
                      className="form-input"
                      value={requirementForm.notes}
                      onChange={(event) =>
                        setRequirementForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Add requirement
                    </button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Dependencies"
              >
                {selectedDependencies.length === 0 ? (
                  <EmptyState
                    title="No dependencies"
                  />
                ) : (
                  <ul className="token-list">
                    {selectedDependencies.map((dependency) => (
                      <li key={dependency.id} className="token-row">
                        <div>
                          <strong>{titleize(dependency.dependency_type)}</strong>
                          <p>
                            {workOrders.find(
                              (candidate) =>
                                candidate.id === dependency.predecessor_work_order_id,
                            )?.title ?? dependency.predecessor_work_order_id}
                            {" -> "}
                            {workOrders.find(
                              (candidate) => candidate.id === dependency.successor_work_order_id,
                            )?.title ?? dependency.successor_work_order_id}
                          </p>
                        </div>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await apiDelete(
                                  `/organizations/${organizationId}/work-order-dependencies/${dependency.id}`,
                                );
                                await reloadDemandSnapshot();
                              } catch (deleteError) {
                                setError(
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "Unable to delete the dependency.",
                                );
                              }
                            });
                          }}
                        >
                          Remove
                        </button>
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
                        await apiRequest<WorkOrderDependency>(
                          `/organizations/${organizationId}/work-order-dependencies`,
                          {
                            method: "POST",
                            body: JSON.stringify(dependencyForm),
                          },
                        );
                        setDependencyForm(initialDependencyForm);
                        await reloadDemandSnapshot();
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to create the dependency.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Predecessor</span>
                    <select
                      className="form-select"
                      value={dependencyForm.predecessor_work_order_id}
                      onChange={(event) =>
                        setDependencyForm((current) => ({
                          ...current,
                          predecessor_work_order_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select a work order</option>
                      {workOrders.map((workOrder) => (
                        <option key={workOrder.id} value={workOrder.id}>
                          {workOrder.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Successor</span>
                    <select
                      className="form-select"
                      value={dependencyForm.successor_work_order_id}
                      onChange={(event) =>
                        setDependencyForm((current) => ({
                          ...current,
                          successor_work_order_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select a work order</option>
                      {workOrders.map((workOrder) => (
                        <option key={workOrder.id} value={workOrder.id}>
                          {workOrder.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Dependency type</span>
                    <select
                      className="form-select"
                      value={dependencyForm.dependency_type}
                      onChange={(event) =>
                        setDependencyForm((current) => ({
                          ...current,
                          dependency_type: event.target.value,
                        }))
                      }
                    >
                      <option value="finish_to_start">finish_to_start</option>
                    </select>
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Add dependency
                    </button>
                  </div>
                </form>
              </SectionCard>
            </>
          ) : (
            <SectionCard
              title="Select work"
            >
              <EmptyState
                title="Select work"
              />
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}
