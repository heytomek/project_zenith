"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { Factory } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import type { InventoryPosition, Location, Material } from "@/lib/api/types";

const initialMaterialForm = {
  sku: "",
  name: "",
  unit_of_measure: "unit",
  material_type: "general",
  description: "",
  status: "active",
};

const initialInventoryForm = {
  material_id: "",
  location_id: "",
  on_hand_quantity: 0,
  reserved_quantity: 0,
};

function fetchMaterialsSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<Material[]>(`/organizations/${organizationId}/materials`),
    apiRequest<InventoryPosition[]>(`/organizations/${organizationId}/inventory-positions`),
    apiRequest<Location[]>(`/organizations/${organizationId}/locations`),
  ]);
}

function toMaterialForm(material: Material) {
  return {
    sku: material.sku,
    name: material.name,
    unit_of_measure: material.unit_of_measure,
    material_type: material.material_type,
    description: material.description ?? "",
    status: material.status,
  };
}

function toInventoryForm(inventoryPosition: InventoryPosition) {
  return {
    material_id: inventoryPosition.material_id,
    location_id: inventoryPosition.location_id,
    on_hand_quantity: inventoryPosition.on_hand_quantity,
    reserved_quantity: inventoryPosition.reserved_quantity,
  };
}

export default function MaterialsPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventoryPositions, setInventoryPositions] = useState<InventoryPosition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  const [inventoryForm, setInventoryForm] = useState(initialInventoryForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadMaterialsSnapshot() {
    const [materialsResponse, inventoryResponse, locationsResponse] =
      await fetchMaterialsSnapshot(organizationId);
    setMaterials(materialsResponse);
    setInventoryPositions(inventoryResponse);
    setLocations(locationsResponse);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [materialsResponse, inventoryResponse, locationsResponse] =
          await fetchMaterialsSnapshot(organizationId);
        if (cancelled) {
          return;
        }
        setMaterials(materialsResponse);
        setInventoryPositions(inventoryResponse);
        setLocations(locationsResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load materials.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function startNewMaterial() {
    setSelectedMaterialId(null);
    setMaterialForm(initialMaterialForm);
  }

  function selectMaterial(material: Material) {
    setSelectedMaterialId(material.id);
    setMaterialForm(toMaterialForm(material));
  }

  function startNewInventoryPosition() {
    setSelectedInventoryId(null);
    setInventoryForm(initialInventoryForm);
  }

  function selectInventoryPosition(inventoryPosition: InventoryPosition) {
    setSelectedInventoryId(inventoryPosition.id);
    setInventoryForm(toInventoryForm(inventoryPosition));
  }

  const selectedMaterial =
    materials.find((material) => material.id === selectedMaterialId) ?? null;
  const selectedInventory =
    inventoryPositions.find((inventory) => inventory.id === selectedInventoryId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="Materials"
        description="Stock that constrains plans."
        icon={Factory}
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid workspace-grid--wide-right">
        <div className="page-stack">
          <SectionCard
            title="Materials"
            actions={
              <button className="ghost-button" type="button" onClick={startNewMaterial}>
                New material
              </button>
            }
          >
            {materials.length === 0 ? (
              <EmptyState
                title="No materials"
              />
            ) : (
              <DataTable columns={["SKU", "Name", "Unit", "Status"]}>
                {materials.map((material) => (
                  <tr
                    key={material.id}
                    className={material.id === selectedMaterialId ? "is-selected" : ""}
                    onClick={() => selectMaterial(material)}
                  >
                    <td>{material.sku}</td>
                    <td>{material.name}</td>
                    <td>{material.unit_of_measure}</td>
                    <td>
                      <StatusChip
                        tone={material.status === "active" ? "success" : "warning"}
                        value={material.status}
                      />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          <SectionCard
            title="Inventory"
            actions={
              <button
                className="ghost-button"
                type="button"
                onClick={startNewInventoryPosition}
              >
                New position
              </button>
            }
          >
            {inventoryPositions.length === 0 ? (
              <EmptyState
                title="No inventory"
              />
            ) : (
              <DataTable columns={["Material", "Location", "On hand", "Reserved", "Available"]}>
                {inventoryPositions.map((inventoryPosition) => (
                  <tr
                    key={inventoryPosition.id}
                    className={inventoryPosition.id === selectedInventoryId ? "is-selected" : ""}
                    onClick={() => selectInventoryPosition(inventoryPosition)}
                  >
                    <td>{inventoryPosition.material.name}</td>
                    <td>
                      {locations.find((location) => location.id === inventoryPosition.location_id)
                        ?.name ?? "Unknown"}
                    </td>
                    <td>{inventoryPosition.on_hand_quantity}</td>
                    <td>{inventoryPosition.reserved_quantity}</td>
                    <td>
                      {inventoryPosition.on_hand_quantity - inventoryPosition.reserved_quantity}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        </div>

        <div className="page-stack">
          <SectionCard
            title={selectedMaterial ? "Edit material" : "Create material"}
            subtitle="Reusable stock references."
            actions={
              selectedMaterial ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/materials/${selectedMaterial.id}`,
                        );
                        startNewMaterial();
                        await reloadMaterialsSnapshot();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the material.",
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
                    const savedMaterial = selectedMaterial
                      ? await apiRequest<Material>(
                          `/organizations/${organizationId}/materials/${selectedMaterial.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({
                              ...materialForm,
                              description: materialForm.description || null,
                            }),
                          },
                        )
                      : await apiRequest<Material>(`/organizations/${organizationId}/materials`, {
                          method: "POST",
                          body: JSON.stringify({
                            ...materialForm,
                            description: materialForm.description || null,
                          }),
                        });

                    selectMaterial(savedMaterial);
                    await reloadMaterialsSnapshot();
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the material.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">SKU</span>
                <input
                  className="form-input"
                  value={materialForm.sku}
                  onChange={(event) =>
                    setMaterialForm((current) => ({ ...current, sku: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Name</span>
                <input
                  className="form-input"
                  value={materialForm.name}
                  onChange={(event) =>
                    setMaterialForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span className="field-label">Unit of measure</span>
                <input
                  className="form-input"
                  value={materialForm.unit_of_measure}
                  onChange={(event) =>
                    setMaterialForm((current) => ({
                      ...current,
                      unit_of_measure: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Material type</span>
                <input
                  className="form-input"
                  value={materialForm.material_type}
                  onChange={(event) =>
                    setMaterialForm((current) => ({
                      ...current,
                      material_type: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  className="form-select"
                  value={materialForm.status}
                  onChange={(event) =>
                    setMaterialForm((current) => ({ ...current, status: event.target.value }))
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
                  value={materialForm.description}
                  onChange={(event) =>
                    setMaterialForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedMaterial ? "Save material" : "Create material"}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title={selectedInventory ? "Edit inventory position" : "Create inventory position"}
            subtitle="Quantity by material and site."
            actions={
              selectedInventory ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/inventory-positions/${selectedInventory.id}`,
                        );
                        startNewInventoryPosition();
                        await reloadMaterialsSnapshot();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the inventory position.",
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
                    if (selectedInventory) {
                      await apiRequest<InventoryPosition>(
                        `/organizations/${organizationId}/inventory-positions/${selectedInventory.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({
                            on_hand_quantity: inventoryForm.on_hand_quantity,
                            reserved_quantity: inventoryForm.reserved_quantity,
                          }),
                        },
                      );
                    } else {
                      await apiRequest<InventoryPosition>(
                        `/organizations/${organizationId}/inventory-positions`,
                        {
                          method: "POST",
                          body: JSON.stringify(inventoryForm),
                        },
                      );
                    }

                    startNewInventoryPosition();
                    await reloadMaterialsSnapshot();
                  } catch (submitError) {
                    setError(
                      submitError instanceof Error
                        ? submitError.message
                        : "Unable to save the inventory position.",
                    );
                  }
                });
              }}
            >
              <label className="form-field">
                <span className="field-label">Material</span>
                <select
                  className="form-select"
                  value={inventoryForm.material_id}
                  disabled={selectedInventory !== null}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
                      ...current,
                      material_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select a material</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.sku} · {material.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Location</span>
                <select
                  className="form-select"
                  value={inventoryForm.location_id}
                  disabled={selectedInventory !== null}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
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
                <span className="field-label">On hand</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={inventoryForm.on_hand_quantity}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
                      ...current,
                      on_hand_quantity: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="field-label">Reserved</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={inventoryForm.reserved_quantity}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
                      ...current,
                      reserved_quantity: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isPending}>
                  {selectedInventory ? "Save position" : "Create position"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
