"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Wrench } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import { formatDateTime, toDateTimeLocalValue, toIsoOrNull } from "@/lib/format";
import type {
  Equipment,
  EquipmentAvailabilityCalendar,
  EquipmentAvailabilityWindow,
  EquipmentType,
  Location,
} from "@/lib/api/types";

const initialEquipmentTypeForm = {
  code: "",
  name: "",
  category: "general",
  description: "",
  status: "active",
};

const initialEquipmentForm = {
  equipment_type_id: "",
  location_id: "",
  equipment_code: "",
  serial_number: "",
  status: "active",
};

const initialCalendarForm = {
  name: "",
  timezone: "UTC",
  effective_from: "",
  effective_to: "",
  status: "active",
};

const initialWindowForm = {
  calendar_id: "",
  start_at: "",
  end_at: "",
  availability_type: "available",
};

function fetchEquipmentSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<EquipmentType[]>(`/organizations/${organizationId}/equipment-types`),
    apiRequest<Equipment[]>(`/organizations/${organizationId}/equipment`),
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
  ]);
}

function fetchEquipmentCalendars(organizationId: string, equipmentId: string) {
  return apiRequest<EquipmentAvailabilityCalendar[]>(
    `/organizations/${organizationId}/equipment/${equipmentId}/availability-calendars`,
  );
}

function fetchEquipmentWindows(
  organizationId: string,
  equipmentId: string,
  calendarId: string,
) {
  return apiRequest<EquipmentAvailabilityWindow[]>(
    `/organizations/${organizationId}/equipment/${equipmentId}/availability-calendars/${calendarId}/windows`,
  );
}

function toEquipmentTypeForm(equipmentType: EquipmentType) {
  return {
    code: equipmentType.code,
    name: equipmentType.name,
    category: equipmentType.category,
    description: equipmentType.description ?? "",
    status: equipmentType.status,
  };
}

function toEquipmentForm(equipment: Equipment) {
  return {
    equipment_type_id: equipment.equipment_type_id,
    location_id: equipment.location_id,
    equipment_code: equipment.equipment_code,
    serial_number: equipment.serial_number ?? "",
    status: equipment.status,
  };
}

export default function EquipmentPage() {
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const organizationId = params.organizationId;
  const initialSelectedEquipmentId = searchParams.get("selectedEquipmentId");
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [equipmentUnits, setEquipmentUnits] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availabilityCalendars, setAvailabilityCalendars] = useState<
    EquipmentAvailabilityCalendar[]
  >([]);
  const [availabilityWindowsByCalendar, setAvailabilityWindowsByCalendar] = useState<
    Record<string, EquipmentAvailabilityWindow[]>
  >({});
  const [selectedEquipmentTypeId, setSelectedEquipmentTypeId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    initialSelectedEquipmentId,
  );
  const [equipmentTypeForm, setEquipmentTypeForm] = useState(initialEquipmentTypeForm);
  const [equipmentForm, setEquipmentForm] = useState(initialEquipmentForm);
  const [calendarForm, setCalendarForm] = useState(initialCalendarForm);
  const [windowForm, setWindowForm] = useState(initialWindowForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadEquipmentSnapshot() {
    const [equipmentTypesResponse, equipmentUnitsResponse, locationsResponse] =
      await fetchEquipmentSnapshot(organizationId);
    setEquipmentTypes(equipmentTypesResponse);
    setEquipmentUnits(equipmentUnitsResponse);
    setLocations(locationsResponse);
    setError(null);
  }

  async function reloadEquipmentAvailability(equipmentId: string) {
    const calendarsResponse = await fetchEquipmentCalendars(organizationId, equipmentId);
    const windowsEntries = await Promise.all(
      calendarsResponse.map(async (calendar) => [
        calendar.id,
        await fetchEquipmentWindows(organizationId, equipmentId, calendar.id),
      ]),
    );
    setAvailabilityCalendars(calendarsResponse);
    setAvailabilityWindowsByCalendar(Object.fromEntries(windowsEntries));
    setWindowForm((current) => ({
      ...current,
      calendar_id: current.calendar_id || calendarsResponse[0]?.id || "",
    }));
    setError(null);
  }

  const reloadEquipmentAvailabilityEvent = useEffectEvent(reloadEquipmentAvailability);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [equipmentTypesResponse, equipmentUnitsResponse, locationsResponse] =
          await fetchEquipmentSnapshot(organizationId);
        if (cancelled) {
          return;
        }
        setEquipmentTypes(equipmentTypesResponse);
        setEquipmentUnits(equipmentUnitsResponse);
        setLocations(locationsResponse);
        if (initialSelectedEquipmentId) {
          const selectedEquipmentFromUrl = equipmentUnitsResponse.find(
            (equipment) => equipment.id === initialSelectedEquipmentId,
          );
          if (selectedEquipmentFromUrl) {
            setEquipmentForm(toEquipmentForm(selectedEquipmentFromUrl));
            void reloadEquipmentAvailabilityEvent(selectedEquipmentFromUrl.id);
          }
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load equipment.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialSelectedEquipmentId, organizationId]);

  function startNewEquipmentType() {
    setSelectedEquipmentTypeId(null);
    setEquipmentTypeForm(initialEquipmentTypeForm);
  }

  function selectEquipmentType(equipmentType: EquipmentType) {
    setSelectedEquipmentTypeId(equipmentType.id);
    setEquipmentTypeForm(toEquipmentTypeForm(equipmentType));
  }

  function startNewEquipment() {
    setSelectedEquipmentId(null);
    setEquipmentForm(initialEquipmentForm);
    setAvailabilityCalendars([]);
    setAvailabilityWindowsByCalendar({});
    setCalendarForm(initialCalendarForm);
    setWindowForm(initialWindowForm);
  }

  function selectEquipment(equipment: Equipment) {
    setSelectedEquipmentId(equipment.id);
    setEquipmentForm(toEquipmentForm(equipment));
    void reloadEquipmentAvailability(equipment.id);
  }

  const selectedEquipmentType =
    equipmentTypes.find((equipmentType) => equipmentType.id === selectedEquipmentTypeId) ?? null;
  const selectedEquipment =
    equipmentUnits.find((equipment) => equipment.id === selectedEquipmentId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="Equipment"
        description="Reservable machines and tools."
        icon={Wrench}
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid workspace-grid--wide-right">
        <div className="page-stack">
          <SectionCard
            title="Types"
            actions={
              <button className="ghost-button" type="button" onClick={startNewEquipmentType}>
                New type
              </button>
            }
          >
            {equipmentTypes.length === 0 ? (
              <EmptyState
                title="No types"
              />
            ) : (
              <DataTable columns={["Code", "Name", "Category", "Status"]}>
                {equipmentTypes.map((equipmentType) => (
                  <tr
                    key={equipmentType.id}
                    className={equipmentType.id === selectedEquipmentTypeId ? "is-selected" : ""}
                    onClick={() => selectEquipmentType(equipmentType)}
                  >
                    <td>{equipmentType.code}</td>
                    <td>{equipmentType.name}</td>
                    <td>{equipmentType.category}</td>
                    <td>
                      <StatusChip
                        tone={equipmentType.status === "active" ? "success" : "warning"}
                        value={equipmentType.status}
                      />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          <SectionCard
            title="Units"
            actions={
              <button className="ghost-button" type="button" onClick={startNewEquipment}>
                New unit
              </button>
            }
          >
            {equipmentUnits.length === 0 ? (
              <EmptyState
                title="No units"
              />
            ) : (
              <DataTable columns={["Code", "Type", "Location", "Status"]}>
                {equipmentUnits.map((equipment) => (
                  <tr
                    key={equipment.id}
                    className={equipment.id === selectedEquipmentId ? "is-selected" : ""}
                    onClick={() => selectEquipment(equipment)}
                  >
                    <td>{equipment.equipment_code}</td>
                    <td>{equipment.equipment_type.name}</td>
                    <td>
                      {locations.find((location) => location.id === equipment.location_id)?.name ??
                        "Unknown"}
                    </td>
                    <td>
                      <StatusChip
                        tone={equipment.status === "active" ? "success" : "warning"}
                        value={equipment.status}
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
            title={selectedEquipmentType ? "Edit equipment type" : "Create equipment type"}
            subtitle="Classes for requirements and units."
            actions={
              selectedEquipmentType ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/equipment-types/${selectedEquipmentType.id}`,
                        );
                        startNewEquipmentType();
                        await reloadEquipmentSnapshot();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the equipment type.",
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
                startTransition(async () => {
                  try {
                    const savedEquipmentType = selectedEquipmentType
                      ? await apiRequest<EquipmentType>(
                          `/organizations/${organizationId}/equipment-types/${selectedEquipmentType.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({
                              ...equipmentTypeForm,
                              description: equipmentTypeForm.description || null,
                            }),
                          },
                        )
                      : await apiRequest<EquipmentType>(
                          `/organizations/${organizationId}/equipment-types`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...equipmentTypeForm,
                              description: equipmentTypeForm.description || null,
                            }),
                          },
                        );

                    selectEquipmentType(savedEquipmentType);
                    await reloadEquipmentSnapshot();
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the equipment type.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Code</span>
                <input
                  className="form-input"
                  value={equipmentTypeForm.code}
                  onChange={(event) =>
                    setEquipmentTypeForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  className="form-input"
                  value={equipmentTypeForm.name}
                  onChange={(event) =>
                    setEquipmentTypeForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Category</span>
                <input
                  className="form-input"
                  value={equipmentTypeForm.category}
                  onChange={(event) =>
                    setEquipmentTypeForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={equipmentTypeForm.status}
                  onChange={(event) =>
                    setEquipmentTypeForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Description</span>
                <textarea
                  className="form-textarea"
                  value={equipmentTypeForm.description}
                  onChange={(event) =>
                    setEquipmentTypeForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedEquipmentType ? "Save type" : "Create type"}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title={selectedEquipment ? "Edit equipment unit" : "Create equipment unit"}
            subtitle="Specific reservable equipment."
            actions={
              selectedEquipment ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/equipment/${selectedEquipment.id}`,
                        );
                        startNewEquipment();
                        await reloadEquipmentSnapshot();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the equipment unit.",
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
                startTransition(async () => {
                  try {
                    const savedEquipment = selectedEquipment
                      ? await apiRequest<Equipment>(
                          `/organizations/${organizationId}/equipment/${selectedEquipment.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({
                              ...equipmentForm,
                              serial_number: equipmentForm.serial_number || null,
                            }),
                          },
                        )
                      : await apiRequest<Equipment>(`/organizations/${organizationId}/equipment`, {
                          method: "POST",
                          body: JSON.stringify({
                            ...equipmentForm,
                            serial_number: equipmentForm.serial_number || null,
                          }),
                        });

                    setSelectedEquipmentId(savedEquipment.id);
                    setEquipmentForm(toEquipmentForm(savedEquipment));
                    await reloadEquipmentSnapshot();
                    await reloadEquipmentAvailability(savedEquipment.id);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the equipment unit.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Equipment type</span>
                <select
                  className="form-select"
                  value={equipmentForm.equipment_type_id}
                  onChange={(event) =>
                    setEquipmentForm((current) => ({
                      ...current,
                      equipment_type_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select a type</option>
                  {equipmentTypes.map((equipmentType) => (
                    <option key={equipmentType.id} value={equipmentType.id}>
                      {equipmentType.code} · {equipmentType.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Location</span>
                <select
                  className="form-select"
                  value={equipmentForm.location_id}
                  onChange={(event) =>
                    setEquipmentForm((current) => ({
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
                <span className="field-label">Equipment code</span>
                <input
                  className="form-input"
                  value={equipmentForm.equipment_code}
                  onChange={(event) =>
                    setEquipmentForm((current) => ({
                      ...current,
                      equipment_code: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Serial number</span>
                <input
                  className="form-input"
                  value={equipmentForm.serial_number}
                  onChange={(event) =>
                    setEquipmentForm((current) => ({
                      ...current,
                      serial_number: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={equipmentForm.status}
                  onChange={(event) =>
                    setEquipmentForm((current) => ({
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
                  {selectedEquipment ? "Save unit" : "Create unit"}
                </button>
              </div>
            </form>
          </SectionCard>

          {selectedEquipment ? (
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
                                    `/organizations/${organizationId}/equipment/${selectedEquipment.id}/availability-calendars/${calendar.id}`,
                                  );
                                  await reloadEquipmentAvailability(selectedEquipment.id);
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
                                      `/organizations/${organizationId}/equipment/${selectedEquipment.id}/availability-calendars/${calendar.id}/windows/${window.id}`,
                                    );
                                    await reloadEquipmentAvailability(selectedEquipment.id);
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
                      await apiRequest<EquipmentAvailabilityCalendar>(
                        `/organizations/${organizationId}/equipment/${selectedEquipment.id}/availability-calendars`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            ...calendarForm,
                            effective_from: toIsoOrNull(calendarForm.effective_from),
                            effective_to: toIsoOrNull(calendarForm.effective_to),
                          }),
                        },
                      );
                      setCalendarForm(initialCalendarForm);
                      await reloadEquipmentAvailability(selectedEquipment.id);
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
                    value={calendarForm.name}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
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
                    value={calendarForm.timezone}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
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
                    value={calendarForm.effective_from}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
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
                    value={calendarForm.effective_to}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
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
                    value={calendarForm.status}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
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
                        await apiRequest<EquipmentAvailabilityWindow>(
                          `/organizations/${organizationId}/equipment/${selectedEquipment.id}/availability-calendars/${windowForm.calendar_id}/windows`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...windowForm,
                              start_at: toIsoOrNull(windowForm.start_at),
                              end_at: toIsoOrNull(windowForm.end_at),
                            }),
                          },
                        );
                        setWindowForm((current) => ({
                          ...initialWindowForm,
                          calendar_id: current.calendar_id,
                        }));
                        await reloadEquipmentAvailability(selectedEquipment.id);
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
                      value={windowForm.calendar_id}
                      onChange={(event) =>
                        setWindowForm((current) => ({
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
                      value={windowForm.start_at}
                      onChange={(event) =>
                        setWindowForm((current) => ({
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
                      value={windowForm.end_at}
                      onChange={(event) =>
                        setWindowForm((current) => ({
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
                      value={windowForm.availability_type}
                      onChange={(event) =>
                        setWindowForm((current) => ({
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
          ) : (
            <SectionCard
              title="Select unit"
            >
              <EmptyState
                title="Select unit"
              />
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}
