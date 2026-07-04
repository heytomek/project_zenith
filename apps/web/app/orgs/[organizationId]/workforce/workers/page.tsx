"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HardHat } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import { formatDateTime, toIsoOrNull } from "@/lib/format";
import type {
  AvailabilityCalendar,
  AvailabilityWindow,
  Certification,
  Location,
  PlanningUnit,
  Skill,
  Worker,
  WorkerCertification,
  WorkerShiftBreakRule,
  WorkerShiftTemplate,
  WorkerSkill,
} from "@/lib/api/types";

const initialWorkerForm = {
  worker_code: "",
  display_name: "",
  employment_type: "full_time",
  status: "active",
  home_location_id: "",
  home_planning_unit_id: "",
};

const initialWorkerSkillForm = {
  skill_id: "",
  proficiency_level: 1,
  verified: false,
  source: "",
};

const initialWorkerCertificationForm = {
  certification_id: "",
  status: "active",
  issued_at: "",
  expires_at: "",
};

const initialAvailabilityCalendarForm = {
  name: "",
  timezone: "UTC",
  effective_from: "",
  effective_to: "",
  status: "active",
};

const initialAvailabilityWindowForm = {
  calendar_id: "",
  start_at: "",
  end_at: "",
  availability_type: "available",
};

const initialShiftTemplateForm = {
  name: "",
  timezone: "UTC",
  day_of_week: 0,
  start_time_local: "09:00",
  end_time_local: "17:00",
  effective_from: "",
  effective_to: "",
  status: "active",
};

const initialShiftBreakRuleForm = {
  shift_template_id: "",
  name: "",
  start_time_local: "12:00",
  duration_minutes: 30,
  status: "active",
};

const weekdayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function toWorkerForm(worker: Worker) {
  return {
    worker_code: worker.worker_code,
    display_name: worker.display_name,
    employment_type: worker.employment_type,
    status: worker.status,
    home_location_id: worker.home_location_id ?? "",
    home_planning_unit_id: worker.home_planning_unit_id ?? "",
  };
}

function minuteStringToLocalMinute(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText ?? "0");
  const minute = Number(minuteText ?? "0");
  return hour * 60 + minute;
}

function localMinuteToTimeValue(value: number): string {
  const normalized = Math.max(0, Math.min(1439, value));
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function fetchWorkerContextSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<Worker[]>(`/organizations/${organizationId}/workers`),
    apiRequest<Skill[]>(`/organizations/${organizationId}/skills`),
    apiRequest<Certification[]>(`/organizations/${organizationId}/certifications`),
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
    apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
  ]);
}

async function fetchWorkerDetailsSnapshot(organizationId: string, workerId: string) {
  const [
    workerSkillsResponse,
    workerCertificationsResponse,
    availabilityCalendarsResponse,
    shiftTemplatesResponse,
  ] = await Promise.all([
    apiRequest<WorkerSkill[]>(`/organizations/${organizationId}/workers/${workerId}/skills`),
    apiRequest<WorkerCertification[]>(
      `/organizations/${organizationId}/workers/${workerId}/certifications`,
    ),
    apiRequest<AvailabilityCalendar[]>(
      `/organizations/${organizationId}/workers/${workerId}/availability-calendars`,
    ),
    apiRequest<WorkerShiftTemplate[]>(
      `/organizations/${organizationId}/workers/${workerId}/shift-templates`,
    ),
  ]);

  const availabilityWindowsEntries = await Promise.all(
    availabilityCalendarsResponse.map(async (calendar) => [
      calendar.id,
      await apiRequest<AvailabilityWindow[]>(
        `/organizations/${organizationId}/workers/${workerId}/availability-calendars/${calendar.id}/windows`,
      ),
    ]),
  );

  const shiftBreakRulesEntries = await Promise.all(
    shiftTemplatesResponse.map(async (shiftTemplate) => [
      shiftTemplate.id,
      await apiRequest<WorkerShiftBreakRule[]>(
        `/organizations/${organizationId}/workers/${workerId}/shift-templates/${shiftTemplate.id}/break-rules`,
      ),
    ]),
  );

  return {
    workerSkillsResponse,
    workerCertificationsResponse,
    availabilityCalendarsResponse,
    availabilityWindowsByCalendarResponse: Object.fromEntries(availabilityWindowsEntries),
    shiftTemplatesResponse,
    shiftBreakRulesByTemplateResponse: Object.fromEntries(shiftBreakRulesEntries),
  };
}

export default function WorkersPage() {
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const initialSelectedWorkerId = searchParams.get("selectedWorkerId");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(
    initialSelectedWorkerId,
  );
  const [workerSkills, setWorkerSkills] = useState<WorkerSkill[]>([]);
  const [workerCertifications, setWorkerCertifications] = useState<WorkerCertification[]>([]);
  const [availabilityCalendars, setAvailabilityCalendars] = useState<AvailabilityCalendar[]>([]);
  const [availabilityWindowsByCalendar, setAvailabilityWindowsByCalendar] = useState<
    Record<string, AvailabilityWindow[]>
  >({});
  const [shiftTemplates, setShiftTemplates] = useState<WorkerShiftTemplate[]>([]);
  const [shiftBreakRulesByTemplate, setShiftBreakRulesByTemplate] = useState<
    Record<string, WorkerShiftBreakRule[]>
  >({});
  const [workerForm, setWorkerForm] = useState(initialWorkerForm);
  const [workerSkillForm, setWorkerSkillForm] = useState(initialWorkerSkillForm);
  const [workerCertificationForm, setWorkerCertificationForm] = useState(
    initialWorkerCertificationForm,
  );
  const [availabilityCalendarForm, setAvailabilityCalendarForm] = useState(
    initialAvailabilityCalendarForm,
  );
  const [availabilityWindowForm, setAvailabilityWindowForm] = useState(
    initialAvailabilityWindowForm,
  );
  const [shiftTemplateForm, setShiftTemplateForm] = useState(initialShiftTemplateForm);
  const [shiftBreakRuleForm, setShiftBreakRuleForm] = useState(initialShiftBreakRuleForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetWorkerDetailState() {
    setSelectedWorkerId(null);
    setWorkerForm(initialWorkerForm);
    setWorkerSkills([]);
    setWorkerCertifications([]);
    setAvailabilityCalendars([]);
    setAvailabilityWindowsByCalendar({});
    setShiftTemplates([]);
    setShiftBreakRulesByTemplate({});
    setWorkerSkillForm(initialWorkerSkillForm);
    setWorkerCertificationForm(initialWorkerCertificationForm);
    setAvailabilityCalendarForm(initialAvailabilityCalendarForm);
    setAvailabilityWindowForm(initialAvailabilityWindowForm);
    setShiftTemplateForm(initialShiftTemplateForm);
    setShiftBreakRuleForm(initialShiftBreakRuleForm);
  }

  async function reloadWorkerContext() {
    const [
      workersResponse,
      skillsResponse,
      certificationsResponse,
      locationsResponse,
      planningUnitsResponse,
    ] = await fetchWorkerContextSnapshot(organizationId);

    setWorkers(workersResponse);
    setSkills(skillsResponse);
    setCertifications(certificationsResponse);
    setLocations(locationsResponse);
    setPlanningUnits(planningUnitsResponse);
    setError(null);

    if (selectedWorkerId && !workersResponse.some((worker) => worker.id === selectedWorkerId)) {
      resetWorkerDetailState();
    }
  }

  async function reloadWorkerDetails(workerId: string) {
    const {
      workerSkillsResponse,
      workerCertificationsResponse,
      availabilityCalendarsResponse,
      availabilityWindowsByCalendarResponse,
      shiftTemplatesResponse,
      shiftBreakRulesByTemplateResponse,
    } = await fetchWorkerDetailsSnapshot(organizationId, workerId);

    setWorkerSkills(workerSkillsResponse);
    setWorkerCertifications(workerCertificationsResponse);
    setAvailabilityCalendars(availabilityCalendarsResponse);
    setAvailabilityWindowsByCalendar(availabilityWindowsByCalendarResponse);
    setShiftTemplates(shiftTemplatesResponse);
    setShiftBreakRulesByTemplate(shiftBreakRulesByTemplateResponse);
    setAvailabilityWindowForm((current) => ({
      ...current,
      calendar_id: current.calendar_id || availabilityCalendarsResponse[0]?.id || "",
    }));
    setShiftBreakRuleForm((current) => ({
      ...current,
      shift_template_id: current.shift_template_id || shiftTemplatesResponse[0]?.id || "",
    }));
    setError(null);
  }

  const reloadWorkerDetailsEvent = useEffectEvent(reloadWorkerDetails);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [
          workersResponse,
          skillsResponse,
          certificationsResponse,
          locationsResponse,
          planningUnitsResponse,
        ] = await fetchWorkerContextSnapshot(organizationId);
        if (cancelled) {
          return;
        }
        setWorkers(workersResponse);
        setSkills(skillsResponse);
        setCertifications(certificationsResponse);
        setLocations(locationsResponse);
        setPlanningUnits(planningUnitsResponse);
        if (initialSelectedWorkerId) {
          const selectedWorkerFromUrl = workersResponse.find(
            (worker) => worker.id === initialSelectedWorkerId,
          );
          if (selectedWorkerFromUrl) {
            setWorkerForm(toWorkerForm(selectedWorkerFromUrl));
            void reloadWorkerDetailsEvent(selectedWorkerFromUrl.id);
          }
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load workforce data.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialSelectedWorkerId, organizationId]);

  function selectWorker(worker: Worker) {
    setSelectedWorkerId(worker.id);
    setWorkerForm(toWorkerForm(worker));
    void reloadWorkerDetails(worker.id);
  }

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredWorkers = workers.filter((worker) => {
    const matchesStatus = statusFilter === "all" || worker.status === statusFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      worker.display_name.toLowerCase().includes(normalizedSearch) ||
      worker.worker_code.toLowerCase().includes(normalizedSearch);
    return matchesStatus && matchesSearch;
  });

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="People"
        description="Capacity to assign."
        icon={HardHat}
        actions={
          <button className="primary-button" type="button" onClick={resetWorkerDetailState}>
            New worker
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid workspace-grid--wide-right">
        <div className="page-stack">
          <SectionCard
            title="Directory"
          >
            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Search by name or worker code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">all statuses</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            {filteredWorkers.length === 0 ? (
              <EmptyState
                title="No matching people"
                body="Create a person or clear filters."
              />
            ) : (
              <DataTable columns={["Name", "Code", "Employment", "Location", "Status"]}>
                {filteredWorkers.map((worker) => (
                  <tr
                    key={worker.id}
                    className={worker.id === selectedWorkerId ? "is-selected" : ""}
                    onClick={() => selectWorker(worker)}
                  >
                    <td>{worker.display_name}</td>
                    <td>{worker.worker_code}</td>
                    <td>{worker.employment_type}</td>
                    <td>
                      {locations.find((location) => location.id === worker.home_location_id)?.name ??
                        "Unassigned"}
                    </td>
                    <td>
                      <StatusChip
                        tone={worker.status === "active" ? "success" : "warning"}
                        value={worker.status}
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
            title={selectedWorker ? "Edit worker" : "Create worker"}
            subtitle={
              selectedWorker
                ? "Update the selected worker's planning identity."
                : "Add a new worker to the organization."
            }
            actions={
              selectedWorker ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(`/organizations/${organizationId}/workers/${selectedWorker.id}`);
                        resetWorkerDetailState();
                        await reloadWorkerContext();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the worker.",
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
                  ...workerForm,
                  home_location_id: workerForm.home_location_id || null,
                  home_planning_unit_id: workerForm.home_planning_unit_id || null,
                };

                startTransition(async () => {
                  try {
                    const worker = selectedWorker
                      ? await apiRequest<Worker>(
                          `/organizations/${organizationId}/workers/${selectedWorker.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify(payload),
                          },
                        )
                      : await apiRequest<Worker>(`/organizations/${organizationId}/workers`, {
                          method: "POST",
                          body: JSON.stringify(payload),
                        });

                    setSelectedWorkerId(worker.id);
                    setWorkerForm(toWorkerForm(worker));
                    await reloadWorkerContext();
                    await reloadWorkerDetails(worker.id);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the worker.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Display name</span>
                <input
                  className="form-input"
                  value={workerForm.display_name}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Worker code</span>
                <input
                  className="form-input"
                  value={workerForm.worker_code}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      worker_code: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Employment type</span>
                <input
                  className="form-input"
                  value={workerForm.employment_type}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      employment_type: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={workerForm.status}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Home location</span>
                <select
                  className="form-select"
                  value={workerForm.home_location_id}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      home_location_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Home planning unit</span>
                <select
                  className="form-select"
                  value={workerForm.home_planning_unit_id}
                  onChange={(event) =>
                    setWorkerForm((current) => ({
                      ...current,
                      home_planning_unit_id: event.target.value,
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
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedWorker ? "Save worker" : "Create worker"}
                </button>
              </div>
            </form>
          </SectionCard>

          {selectedWorker ? (
            <>
              <SectionCard
                title="Skills"
              >
                {workerSkills.length === 0 ? (
                  <EmptyState
                    title="No skills"
                  />
                ) : (
                  <ul className="token-list">
                    {workerSkills.map((workerSkill) => (
                      <li key={workerSkill.id} className="token-row">
                        <div>
                          <strong>{workerSkill.skill.name}</strong>
                          <p>
                            {workerSkill.skill.code} · level {workerSkill.proficiency_level} ·{" "}
                            {workerSkill.verified ? "verified" : "unverified"}
                          </p>
                        </div>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await apiDelete(
                                  `/organizations/${organizationId}/workers/${selectedWorker.id}/skills/${workerSkill.id}`,
                                );
                                await reloadWorkerDetails(selectedWorker.id);
                              } catch (deleteError) {
                                setError(
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "Unable to delete the worker skill.",
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
                        await apiRequest<WorkerSkill>(
                          `/organizations/${organizationId}/workers/${selectedWorker.id}/skills`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...workerSkillForm,
                              source: workerSkillForm.source || null,
                            }),
                          },
                        );
                        setWorkerSkillForm(initialWorkerSkillForm);
                        await reloadWorkerDetails(selectedWorker.id);
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to assign the worker skill.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Skill</span>
                    <select
                      className="form-select"
                      value={workerSkillForm.skill_id}
                      onChange={(event) =>
                        setWorkerSkillForm((current) => ({
                          ...current,
                          skill_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select a skill</option>
                      {skills.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.code} · {skill.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Proficiency level</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={5}
                      value={workerSkillForm.proficiency_level}
                      onChange={(event) =>
                        setWorkerSkillForm((current) => ({
                          ...current,
                          proficiency_level: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Source</span>
                    <input
                      className="form-input"
                      value={workerSkillForm.source}
                      onChange={(event) =>
                        setWorkerSkillForm((current) => ({
                          ...current,
                          source: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field form-field--toggle">
                    <span className="field-label">Verified</span>
                    <input
                      type="checkbox"
                      checked={workerSkillForm.verified}
                      onChange={(event) =>
                        setWorkerSkillForm((current) => ({
                          ...current,
                          verified: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Assign skill
                    </button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Certifications"
              >
                {workerCertifications.length === 0 ? (
                  <EmptyState
                    title="No certifications"
                    body="Assign certifications when a worker needs compliance or operational credentials."
                  />
                ) : (
                  <ul className="token-list">
                    {workerCertifications.map((workerCertification) => (
                      <li key={workerCertification.id} className="token-row">
                        <div>
                          <strong>{workerCertification.certification.name}</strong>
                          <p>
                            {workerCertification.status} · issued{" "}
                            {formatDateTime(workerCertification.issued_at)} · expires{" "}
                            {formatDateTime(workerCertification.expires_at)}
                          </p>
                        </div>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await apiDelete(
                                  `/organizations/${organizationId}/workers/${selectedWorker.id}/certifications/${workerCertification.id}`,
                                );
                                await reloadWorkerDetails(selectedWorker.id);
                              } catch (deleteError) {
                                setError(
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "Unable to delete the worker certification.",
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
                        await apiRequest<WorkerCertification>(
                          `/organizations/${organizationId}/workers/${selectedWorker.id}/certifications`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...workerCertificationForm,
                              issued_at: toIsoOrNull(workerCertificationForm.issued_at),
                              expires_at: toIsoOrNull(workerCertificationForm.expires_at),
                            }),
                          },
                        );
                        setWorkerCertificationForm(initialWorkerCertificationForm);
                        await reloadWorkerDetails(selectedWorker.id);
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to assign the certification.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Certification</span>
                    <select
                      className="form-select"
                      value={workerCertificationForm.certification_id}
                      onChange={(event) =>
                        setWorkerCertificationForm((current) => ({
                          ...current,
                          certification_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select a certification</option>
                      {certifications.map((certification) => (
                        <option key={certification.id} value={certification.id}>
                          {certification.code} · {certification.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Status</span>
                    <select
                      className="form-select"
                      value={workerCertificationForm.status}
                      onChange={(event) =>
                        setWorkerCertificationForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Issued at</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={workerCertificationForm.issued_at}
                      onChange={(event) =>
                        setWorkerCertificationForm((current) => ({
                          ...current,
                          issued_at: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Expires at</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={workerCertificationForm.expires_at}
                      onChange={(event) =>
                        setWorkerCertificationForm((current) => ({
                          ...current,
                          expires_at: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Assign certification
                    </button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Availability"
              >
                {availabilityCalendars.length === 0 ? (
                  <EmptyState
                    title="No availability"
                  />
                ) : (
                  <div className="calendar-stack">
                    {availabilityCalendars.map((calendar) => (
                      <article key={calendar.id} className="calendar-card">
                        <div className="calendar-card__header">
                          <div>
                            <h3>{calendar.name}</h3>
                            <p>
                              {calendar.timezone} · {formatDateTime(calendar.effective_from)} to{" "}
                              {formatDateTime(calendar.effective_to)}
                            </p>
                          </div>
                          <div className="inline-actions">
                            <StatusChip
                              tone={calendar.status === "active" ? "success" : "warning"}
                              value={calendar.status}
                            />
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    await apiDelete(
                                      `/organizations/${organizationId}/workers/${selectedWorker.id}/availability-calendars/${calendar.id}`,
                                    );
                                    await reloadWorkerDetails(selectedWorker.id);
                                  } catch (deleteError) {
                                    setError(
                                      deleteError instanceof Error
                                        ? deleteError.message
                                        : "Unable to delete the availability calendar.",
                                    );
                                  }
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <ul className="plain-list">
                          {(availabilityWindowsByCalendar[calendar.id] ?? []).map((window) => (
                            <li key={window.id} className="token-row">
                              <div>
                                <strong>{window.availability_type}</strong>
                                <p>
                                  {formatDateTime(window.start_at)} to {formatDateTime(window.end_at)}
                                </p>
                              </div>
                              <button
                                className="ghost-button"
                                type="button"
                                onClick={() => {
                                  startTransition(async () => {
                                    try {
                                      await apiDelete(
                                        `/organizations/${organizationId}/workers/${selectedWorker.id}/availability-calendars/${calendar.id}/windows/${window.id}`,
                                      );
                                      await reloadWorkerDetails(selectedWorker.id);
                                    } catch (deleteError) {
                                      setError(
                                        deleteError instanceof Error
                                          ? deleteError.message
                                          : "Unable to delete the availability window.",
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
                      </article>
                    ))}
                  </div>
                )}

                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      try {
                        await apiRequest<AvailabilityCalendar>(
                          `/organizations/${organizationId}/workers/${selectedWorker.id}/availability-calendars`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...availabilityCalendarForm,
                              effective_from: toIsoOrNull(availabilityCalendarForm.effective_from),
                              effective_to: toIsoOrNull(availabilityCalendarForm.effective_to),
                            }),
                          },
                        );
                        setAvailabilityCalendarForm(initialAvailabilityCalendarForm);
                        await reloadWorkerDetails(selectedWorker.id);
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to create the availability calendar.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Calendar name</span>
                    <input
                      className="form-input"
                      value={availabilityCalendarForm.name}
                      onChange={(event) =>
                        setAvailabilityCalendarForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Timezone</span>
                    <input
                      className="form-input"
                      value={availabilityCalendarForm.timezone}
                      onChange={(event) =>
                        setAvailabilityCalendarForm((current) => ({
                          ...current,
                          timezone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Effective from</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={availabilityCalendarForm.effective_from}
                      onChange={(event) =>
                        setAvailabilityCalendarForm((current) => ({
                          ...current,
                          effective_from: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Effective to</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={availabilityCalendarForm.effective_to}
                      onChange={(event) =>
                        setAvailabilityCalendarForm((current) => ({
                          ...current,
                          effective_to: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Status</span>
                    <select
                      className="form-select"
                      value={availabilityCalendarForm.status}
                      onChange={(event) =>
                        setAvailabilityCalendarForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Create calendar
                    </button>
                  </div>
                </form>

                {availabilityCalendars.length > 0 ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startTransition(async () => {
                        try {
                          await apiRequest<AvailabilityWindow>(
                            `/organizations/${organizationId}/workers/${selectedWorker.id}/availability-calendars/${availabilityWindowForm.calendar_id}/windows`,
                            {
                              method: "POST",
                              body: JSON.stringify({
                                ...availabilityWindowForm,
                                start_at: toIsoOrNull(availabilityWindowForm.start_at),
                                end_at: toIsoOrNull(availabilityWindowForm.end_at),
                              }),
                            },
                          );
                          setAvailabilityWindowForm((current) => ({
                            ...initialAvailabilityWindowForm,
                            calendar_id: current.calendar_id,
                          }));
                          await reloadWorkerDetails(selectedWorker.id);
                        } catch (submitError) {
                          setError(
                            submitError instanceof Error
                              ? submitError.message
                              : "Unable to create the availability window.",
                          );
                        }
                      });
                    }}
                  >
                    <label className="form-field">
                      <span className="field-label">Calendar</span>
                      <select
                        className="form-select"
                        value={availabilityWindowForm.calendar_id}
                        onChange={(event) =>
                          setAvailabilityWindowForm((current) => ({
                            ...current,
                            calendar_id: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a calendar</option>
                        {availabilityCalendars.map((calendar) => (
                          <option key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="field-label">Start</span>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={availabilityWindowForm.start_at}
                        onChange={(event) =>
                          setAvailabilityWindowForm((current) => ({
                            ...current,
                            start_at: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="field-label">End</span>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={availabilityWindowForm.end_at}
                        onChange={(event) =>
                          setAvailabilityWindowForm((current) => ({
                            ...current,
                            end_at: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="field-label">Type</span>
                      <select
                        className="form-select"
                        value={availabilityWindowForm.availability_type}
                        onChange={(event) =>
                          setAvailabilityWindowForm((current) => ({
                            ...current,
                            availability_type: event.target.value,
                          }))
                        }
                      >
                        <option value="available">available</option>
                        <option value="unavailable">unavailable</option>
                      </select>
                    </label>
                    <div className="form-actions">
                      <button className="primary-button" type="submit" disabled={isPending}>
                        Add window
                      </button>
                    </div>
                  </form>
                ) : null}
              </SectionCard>

              <SectionCard
                title="Shifts"
              >
                {shiftTemplates.length === 0 ? (
                  <EmptyState
                    title="No shifts"
                  />
                ) : (
                  <div className="calendar-stack">
                    {shiftTemplates.map((shiftTemplate) => (
                      <article key={shiftTemplate.id} className="calendar-card">
                        <div className="calendar-card__header">
                          <div>
                            <h3>{shiftTemplate.name}</h3>
                            <p>
                              {weekdayLabels[shiftTemplate.day_of_week] ?? "Unknown day"} ·{" "}
                              {localMinuteToTimeValue(shiftTemplate.start_minute_local)} to{" "}
                              {localMinuteToTimeValue(shiftTemplate.end_minute_local)} ·{" "}
                              {shiftTemplate.timezone}
                            </p>
                            <p>
                              Effective {formatDateTime(shiftTemplate.effective_from)} to{" "}
                              {formatDateTime(shiftTemplate.effective_to)}
                            </p>
                          </div>
                          <div className="inline-actions">
                            <StatusChip
                              tone={shiftTemplate.status === "active" ? "success" : "warning"}
                              value={shiftTemplate.status}
                            />
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    await apiDelete(
                                      `/organizations/${organizationId}/workers/${selectedWorker.id}/shift-templates/${shiftTemplate.id}`,
                                    );
                                    await reloadWorkerDetails(selectedWorker.id);
                                  } catch (deleteError) {
                                    setError(
                                      deleteError instanceof Error
                                        ? deleteError.message
                                        : "Unable to delete the shift template.",
                                    );
                                  }
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {(shiftBreakRulesByTemplate[shiftTemplate.id] ?? []).length === 0 ? (
                          <p className="field-helper">No break rules attached to this shift.</p>
                        ) : (
                          <ul className="plain-list">
                            {(shiftBreakRulesByTemplate[shiftTemplate.id] ?? []).map((breakRule) => (
                              <li key={breakRule.id} className="token-row">
                                <div>
                                  <strong>{breakRule.name}</strong>
                                  <p>
                                    {localMinuteToTimeValue(breakRule.start_minute_local)} ·{" "}
                                    {breakRule.duration_minutes} min · {breakRule.status}
                                  </p>
                                </div>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() => {
                                    startTransition(async () => {
                                      try {
                                        await apiDelete(
                                          `/organizations/${organizationId}/workers/${selectedWorker.id}/shift-templates/${shiftTemplate.id}/break-rules/${breakRule.id}`,
                                        );
                                        await reloadWorkerDetails(selectedWorker.id);
                                      } catch (deleteError) {
                                        setError(
                                          deleteError instanceof Error
                                            ? deleteError.message
                                            : "Unable to delete the shift break rule.",
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
                      </article>
                    ))}
                  </div>
                )}

                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      try {
                        await apiRequest<WorkerShiftTemplate>(
                          `/organizations/${organizationId}/workers/${selectedWorker.id}/shift-templates`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...shiftTemplateForm,
                              start_minute_local: minuteStringToLocalMinute(
                                shiftTemplateForm.start_time_local,
                              ),
                              end_minute_local: minuteStringToLocalMinute(
                                shiftTemplateForm.end_time_local,
                              ),
                              effective_from: toIsoOrNull(shiftTemplateForm.effective_from),
                              effective_to: toIsoOrNull(shiftTemplateForm.effective_to),
                            }),
                          },
                        );
                        setShiftTemplateForm(initialShiftTemplateForm);
                        await reloadWorkerDetails(selectedWorker.id);
                      } catch (submitError) {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Unable to create the shift template.",
                        );
                      }
                    });
                  }}
                >
                  <label className="form-field">
                    <span className="field-label">Shift name</span>
                    <input
                      className="form-input"
                      value={shiftTemplateForm.name}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Weekday</span>
                    <select
                      className="form-select"
                      value={shiftTemplateForm.day_of_week}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          day_of_week: Number(event.target.value),
                        }))
                      }
                    >
                      {weekdayLabels.map((label, index) => (
                        <option key={label} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Start local time</span>
                    <input
                      className="form-input"
                      type="time"
                      value={shiftTemplateForm.start_time_local}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          start_time_local: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">End local time</span>
                    <input
                      className="form-input"
                      type="time"
                      value={shiftTemplateForm.end_time_local}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          end_time_local: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Timezone</span>
                    <input
                      className="form-input"
                      value={shiftTemplateForm.timezone}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          timezone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Status</span>
                    <select
                      className="form-select"
                      value={shiftTemplateForm.status}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="field-label">Effective from</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={shiftTemplateForm.effective_from}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          effective_from: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span className="field-label">Effective to</span>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={shiftTemplateForm.effective_to}
                      onChange={(event) =>
                        setShiftTemplateForm((current) => ({
                          ...current,
                          effective_to: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>
                      Add shift template
                    </button>
                  </div>
                </form>

                {shiftTemplates.length > 0 ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startTransition(async () => {
                        try {
                          await apiRequest<WorkerShiftBreakRule>(
                            `/organizations/${organizationId}/workers/${selectedWorker.id}/shift-templates/${shiftBreakRuleForm.shift_template_id}/break-rules`,
                            {
                              method: "POST",
                              body: JSON.stringify({
                                name: shiftBreakRuleForm.name,
                                start_minute_local: minuteStringToLocalMinute(
                                  shiftBreakRuleForm.start_time_local,
                                ),
                                duration_minutes: shiftBreakRuleForm.duration_minutes,
                                status: shiftBreakRuleForm.status,
                              }),
                            },
                          );
                          setShiftBreakRuleForm((current) => ({
                            ...initialShiftBreakRuleForm,
                            shift_template_id: current.shift_template_id,
                          }));
                          await reloadWorkerDetails(selectedWorker.id);
                        } catch (submitError) {
                          setError(
                            submitError instanceof Error
                              ? submitError.message
                              : "Unable to create the break rule.",
                          );
                        }
                      });
                    }}
                  >
                    <label className="form-field">
                      <span className="field-label">Shift template</span>
                      <select
                        className="form-select"
                        value={shiftBreakRuleForm.shift_template_id}
                        onChange={(event) =>
                          setShiftBreakRuleForm((current) => ({
                            ...current,
                            shift_template_id: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a shift template</option>
                        {shiftTemplates.map((shiftTemplate) => (
                          <option key={shiftTemplate.id} value={shiftTemplate.id}>
                            {shiftTemplate.name} · {weekdayLabels[shiftTemplate.day_of_week]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="field-label">Break name</span>
                      <input
                        className="form-input"
                        value={shiftBreakRuleForm.name}
                        onChange={(event) =>
                          setShiftBreakRuleForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="field-label">Start local time</span>
                      <input
                        className="form-input"
                        type="time"
                        value={shiftBreakRuleForm.start_time_local}
                        onChange={(event) =>
                          setShiftBreakRuleForm((current) => ({
                            ...current,
                            start_time_local: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="field-label">Duration (minutes)</span>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={720}
                        value={shiftBreakRuleForm.duration_minutes}
                        onChange={(event) =>
                          setShiftBreakRuleForm((current) => ({
                            ...current,
                            duration_minutes: Number(event.target.value),
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="field-label">Status</span>
                      <select
                        className="form-select"
                        value={shiftBreakRuleForm.status}
                        onChange={(event) =>
                          setShiftBreakRuleForm((current) => ({
                            ...current,
                            status: event.target.value,
                          }))
                        }
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </label>
                    <div className="form-actions">
                      <button className="primary-button" type="submit" disabled={isPending}>
                        Add break rule
                      </button>
                    </div>
                  </form>
                ) : null}
              </SectionCard>
            </>
          ) : (
            <SectionCard
              title="Select person"
            >
              <EmptyState
                title="Select person"
              />
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}
