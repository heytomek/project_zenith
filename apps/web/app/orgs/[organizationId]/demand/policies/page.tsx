"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import type { ServiceLevelPolicy } from "@/lib/api/types";

const initialPolicyForm = {
  name: "",
  scope: "work_order",
  target_minutes: 240,
  description: "",
  status: "active",
};

function fetchPolicies(organizationId: string) {
  return apiRequest<ServiceLevelPolicy[]>(
    `/organizations/${organizationId}/service-level-policies`,
  );
}

function toPolicyForm(policy: ServiceLevelPolicy) {
  return {
    name: policy.name,
    scope: policy.scope,
    target_minutes: policy.target_minutes,
    description: policy.description ?? "",
    status: policy.status,
  };
}

export default function DemandPoliciesPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [policies, setPolicies] = useState<ServiceLevelPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState(initialPolicyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadPolicies() {
    const policiesResponse = await fetchPolicies(organizationId);
    setPolicies(policiesResponse);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const policiesResponse = await fetchPolicies(organizationId);
        if (cancelled) {
          return;
        }
        setPolicies(policiesResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load service-level policies.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function startNewPolicy() {
    setSelectedPolicyId(null);
    setPolicyForm(initialPolicyForm);
  }

  function selectPolicy(policy: ServiceLevelPolicy) {
    setSelectedPolicyId(policy.id);
    setPolicyForm(toPolicyForm(policy));
  }

  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="Rules"
        description="Targets for work."
        actions={
          <button className="primary-button" type="button" onClick={startNewPolicy}>
            New policy
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid">
        <SectionCard
          title="Policies"
        >
          {policies.length === 0 ? (
            <EmptyState
              title="No policies"
            />
          ) : (
            <DataTable columns={["Name", "Scope", "Target", "Status"]}>
              {policies.map((policy) => (
                <tr
                  key={policy.id}
                  className={policy.id === selectedPolicyId ? "is-selected" : ""}
                  onClick={() => selectPolicy(policy)}
                >
                  <td>{policy.name}</td>
                  <td>{policy.scope}</td>
                  <td>{policy.target_minutes} min</td>
                  <td>
                    <StatusChip
                      tone={policy.status === "active" ? "success" : "warning"}
                      value={policy.status}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>

        <SectionCard
          title={selectedPolicy ? "Edit policy" : "Create policy"}
          subtitle="Targets and windows."
          actions={
            selectedPolicy ? (
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await apiDelete(
                        `/organizations/${organizationId}/service-level-policies/${selectedPolicy.id}`,
                      );
                      startNewPolicy();
                      await reloadPolicies();
                    } catch (deleteError) {
                      setError(
                        deleteError instanceof Error
                          ? deleteError.message
                          : "Unable to delete the policy.",
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
                  const savedPolicy = selectedPolicy
                    ? await apiRequest<ServiceLevelPolicy>(
                        `/organizations/${organizationId}/service-level-policies/${selectedPolicy.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify(policyForm),
                        },
                      )
                    : await apiRequest<ServiceLevelPolicy>(
                        `/organizations/${organizationId}/service-level-policies`,
                        {
                          method: "POST",
                          body: JSON.stringify(policyForm),
                        },
                      );

                  selectPolicy(savedPolicy);
                  await reloadPolicies();
                } catch (submitError) {
                  setError(
                    submitError instanceof Error
                      ? submitError.message
                      : "Unable to save the policy.",
                  );
                }
              });
            }}
          >
            <label className="form-field">
              <span className="field-label">Name</span>
              <input
                className="form-input"
                value={policyForm.name}
                onChange={(event) =>
                  setPolicyForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Scope</span>
              <input
                className="form-input"
                value={policyForm.scope}
                onChange={(event) =>
                  setPolicyForm((current) => ({ ...current, scope: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span className="field-label">Target minutes</span>
              <input
                className="form-input"
                type="number"
                min={1}
                value={policyForm.target_minutes}
                onChange={(event) =>
                  setPolicyForm((current) => ({
                    ...current,
                    target_minutes: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Status</span>
              <select
                className="form-select"
                value={policyForm.status}
                onChange={(event) =>
                  setPolicyForm((current) => ({ ...current, status: event.target.value }))
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
                value={policyForm.description}
                onChange={(event) =>
                  setPolicyForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {selectedPolicy ? "Save policy" : "Create policy"}
              </button>
            </div>
          </form>
        </SectionCard>
      </section>
    </div>
  );
}
