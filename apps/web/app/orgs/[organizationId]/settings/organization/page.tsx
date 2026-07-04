"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import type { Location, Organization, PlanningUnit } from "@/lib/api/types";

const initialOrganizationForm = {
  name: "",
  slug: "",
  organization_type: "organization",
  status: "active",
};

const initialLocationForm = {
  name: "",
  code: "",
  location_type: "site",
  timezone: "UTC",
  latitude: "",
  longitude: "",
  status: "active",
};

const initialPlanningUnitForm = {
  name: "",
  unit_type: "team",
  parent_unit_id: "",
  status: "active",
};

function toLocationForm(location: Location) {
  return {
    name: location.name,
    code: location.code,
    location_type: location.location_type,
    timezone: location.timezone,
    latitude: location.latitude?.toString() ?? "",
    longitude: location.longitude?.toString() ?? "",
    status: location.status,
  };
}

function toPlanningUnitForm(planningUnit: PlanningUnit) {
  return {
    name: planningUnit.name,
    unit_type: planningUnit.unit_type,
    parent_unit_id: planningUnit.parent_unit_id ?? "",
    status: planningUnit.status,
  };
}

function fetchSettingsSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<Organization>(`/organizations/${organizationId}`),
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
    apiRequest<PlanningUnit[]>(`/organizations/${organizationId}/planning-units`),
  ]);
}

export default function OrganizationSettingsPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([]);
  const [organizationForm, setOrganizationForm] = useState(initialOrganizationForm);
  const [locationForm, setLocationForm] = useState(initialLocationForm);
  const [planningUnitForm, setPlanningUnitForm] = useState(initialPlanningUnitForm);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedPlanningUnitId, setSelectedPlanningUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadSettings() {
    const [organizationResponse, locationsResponse, planningUnitsResponse] =
      await fetchSettingsSnapshot(organizationId);

    setOrganization(organizationResponse);
    setOrganizationForm({
      name: organizationResponse.name,
      slug: organizationResponse.slug,
      organization_type: organizationResponse.organization_type,
      status: organizationResponse.status,
    });
    setLocations(locationsResponse);
    setPlanningUnits(planningUnitsResponse);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [organizationResponse, locationsResponse, planningUnitsResponse] =
          await fetchSettingsSnapshot(organizationId);
        if (cancelled) {
          return;
        }
        setOrganization(organizationResponse);
        setOrganizationForm({
          name: organizationResponse.name,
          slug: organizationResponse.slug,
          organization_type: organizationResponse.organization_type,
          status: organizationResponse.status,
        });
        setLocations(locationsResponse);
        setPlanningUnits(planningUnitsResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load organization settings.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function startNewLocation() {
    setSelectedLocationId(null);
    setLocationForm(initialLocationForm);
  }

  function selectLocation(location: Location) {
    setSelectedLocationId(location.id);
    setLocationForm(toLocationForm(location));
  }

  function startNewPlanningUnit() {
    setSelectedPlanningUnitId(null);
    setPlanningUnitForm(initialPlanningUnitForm);
  }

  function selectPlanningUnit(planningUnit: PlanningUnit) {
    setSelectedPlanningUnitId(planningUnit.id);
    setPlanningUnitForm(toPlanningUnitForm(planningUnit));
  }

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedPlanningUnit =
    planningUnits.find((planningUnit) => planningUnit.id === selectedPlanningUnitId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="Structure"
        description="Sites and planning units."
        chips={
          organization ? <StatusChip tone="success" value={organization.status} /> : null
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid workspace-grid--wide-right">
        <div className="page-stack">
          <SectionCard
            title="Organization"
          >
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  try {
                    const updated = await apiRequest<Organization>(
                      `/organizations/${organizationId}`,
                      {
                        method: "PATCH",
                        body: JSON.stringify(organizationForm),
                      },
                    );
                    setOrganization(updated);
                    setOrganizationForm({
                      name: updated.name,
                      slug: updated.slug,
                      organization_type: updated.organization_type,
                      status: updated.status,
                    });
                    setError(null);
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to update the organization.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  className="form-input"
                  value={organizationForm.name}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Slug</span>
                <input
                  className="form-input"
                  value={organizationForm.slug}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Organization type</span>
                <input
                  className="form-input"
                  value={organizationForm.organization_type}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      organization_type: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={organizationForm.status}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
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
                  Save organization
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Sites"
            actions={
              <button className="ghost-button" type="button" onClick={startNewLocation}>
                New location
              </button>
            }
          >
            {locations.length === 0 ? (
              <EmptyState
                title="No sites"
              />
            ) : (
              <DataTable columns={["Name", "Code", "Type", "Timezone", "Status"]}>
                {locations.map((location) => (
                  <tr
                    key={location.id}
                    className={location.id === selectedLocationId ? "is-selected" : ""}
                    onClick={() => selectLocation(location)}
                  >
                    <td>{location.name}</td>
                    <td>{location.code}</td>
                    <td>{location.location_type}</td>
                    <td>{location.timezone}</td>
                    <td>
                      <StatusChip
                        tone={location.status === "active" ? "success" : "warning"}
                        value={location.status}
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
              <button className="ghost-button" type="button" onClick={startNewPlanningUnit}>
                New planning unit
              </button>
            }
          >
            {planningUnits.length === 0 ? (
              <EmptyState
                title="No units"
              />
            ) : (
              <DataTable columns={["Name", "Type", "Parent", "Status"]}>
                {planningUnits.map((planningUnit) => (
                  <tr
                    key={planningUnit.id}
                    className={planningUnit.id === selectedPlanningUnitId ? "is-selected" : ""}
                    onClick={() => selectPlanningUnit(planningUnit)}
                  >
                    <td>{planningUnit.name}</td>
                    <td>{planningUnit.unit_type}</td>
                    <td>
                      {planningUnits.find((candidate) => candidate.id === planningUnit.parent_unit_id)
                        ?.name ?? "None"}
                    </td>
                    <td>
                      <StatusChip
                        tone={planningUnit.status === "active" ? "success" : "warning"}
                        value={planningUnit.status}
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
            title={selectedLocation ? "Edit location" : "Create location"}
            subtitle={
              selectedLocation
                ? "Update the selected location."
                : "Add a new site or service area."
            }
            actions={
              selectedLocation ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/locations/${selectedLocation.id}`,
                        );
                        startNewLocation();
                        await reloadSettings();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the location.",
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
                  ...locationForm,
                  latitude: locationForm.latitude ? Number(locationForm.latitude) : null,
                  longitude: locationForm.longitude ? Number(locationForm.longitude) : null,
                };

                startTransition(async () => {
                  try {
                    if (selectedLocation) {
                      await apiRequest<Location>(
                        `/organizations/${organizationId}/locations/${selectedLocation.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify(payload),
                        },
                      );
                    } else {
                      await apiRequest<Location>(`/organizations/${organizationId}/locations`, {
                        method: "POST",
                        body: JSON.stringify(payload),
                      });
                    }

                    startNewLocation();
                    await reloadSettings();
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the location.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  className="form-input"
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Code</span>
                <input
                  className="form-input"
                  value={locationForm.code}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, code: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Location type</span>
                <input
                  className="form-input"
                  value={locationForm.location_type}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      location_type: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Timezone</span>
                <input
                  className="form-input"
                  value={locationForm.timezone}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Latitude</span>
                <input
                  className="form-input"
                  value={locationForm.latitude}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, latitude: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Longitude</span>
                <input
                  className="form-input"
                  value={locationForm.longitude}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, longitude: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={locationForm.status}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedLocation ? "Save location" : "Create location"}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title={selectedPlanningUnit ? "Edit planning unit" : "Create planning unit"}
            subtitle={
              selectedPlanningUnit
                ? "Update the selected operating unit."
                : "Add a team, department, or district."
            }
            actions={
              selectedPlanningUnit ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/planning-units/${selectedPlanningUnit.id}`,
                        );
                        startNewPlanningUnit();
                        await reloadSettings();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the planning unit.",
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
                  ...planningUnitForm,
                  parent_unit_id: planningUnitForm.parent_unit_id || null,
                };

                startTransition(async () => {
                  try {
                    if (selectedPlanningUnit) {
                      await apiRequest<PlanningUnit>(
                        `/organizations/${organizationId}/planning-units/${selectedPlanningUnit.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify(payload),
                        },
                      );
                    } else {
                      await apiRequest<PlanningUnit>(
                        `/organizations/${organizationId}/planning-units`,
                        {
                          method: "POST",
                          body: JSON.stringify(payload),
                        },
                      );
                    }

                    startNewPlanningUnit();
                    await reloadSettings();
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the planning unit.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  className="form-input"
                  value={planningUnitForm.name}
                  onChange={(event) =>
                    setPlanningUnitForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Unit type</span>
                <input
                  className="form-input"
                  value={planningUnitForm.unit_type}
                  onChange={(event) =>
                    setPlanningUnitForm((current) => ({
                      ...current,
                      unit_type: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Parent unit</span>
                <select
                  className="form-select"
                  value={planningUnitForm.parent_unit_id}
                  onChange={(event) =>
                    setPlanningUnitForm((current) => ({
                      ...current,
                      parent_unit_id: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {planningUnits
                    .filter((planningUnit) => planningUnit.id !== selectedPlanningUnitId)
                    .map((planningUnit) => (
                      <option key={planningUnit.id} value={planningUnit.id}>
                        {planningUnit.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={planningUnitForm.status}
                  onChange={(event) =>
                    setPlanningUnitForm((current) => ({
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
                  {selectedPlanningUnit ? "Save planning unit" : "Create planning unit"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
