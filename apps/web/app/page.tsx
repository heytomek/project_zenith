"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { apiRequest } from "@/lib/api/client";
import type { HealthResponse, Organization } from "@/lib/api/types";

const initialOrganizationForm = {
  name: "",
  slug: "",
  organization_type: "organization",
  status: "active",
};

export default function HomePage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [organizationForm, setOrganizationForm] = useState(initialOrganizationForm);
  const [isPending, startTransition] = useTransition();

  async function loadHomeData() {
    try {
      const [healthResponse, organizationsResponse] = await Promise.all([
        apiRequest<HealthResponse>("/health"),
        apiRequest<Organization[]>("/organizations"),
      ]);
      setHealth(healthResponse);
      setOrganizations(organizationsResponse);
      setError(null);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to reach the Zenith API.";
      setError(message);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [healthResponse, organizationsResponse] = await Promise.all([
          apiRequest<HealthResponse>("/health"),
          apiRequest<Organization[]>("/organizations"),
        ]);
        if (cancelled) {
          return;
        }
        setHealth(healthResponse);
        setOrganizations(organizationsResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : "Unable to reach the Zenith API.";
        setError(message);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="landing-shell">
      <section className="hero">
        <div className="hero__row">
          <div>
            <p className="eyebrow">Zenith</p>
            <h1>Turn work into a publishable plan.</h1>
            <p className="lead">
              Choose an organization. Run, review, publish, compare actuals.
            </p>
          </div>
          <div className="hero__health panel">
            <h2>Environment</h2>
            {health ? (
              <>
                <p className="lead lead--compact">
                  {health.service} · {health.environment} · {health.database_backend}
                </p>
                <div className="chip-row">
                  <StatusChip tone="success" value={health.environment} />
                  <StatusChip tone="neutral" value={health.version} />
                </div>
              </>
            ) : (
              <p className="lead lead--compact">
                {error ?? "Checking API."}
              </p>
            )}
            <a className="ghost-link" href="/api/v1/health">
              View API health
            </a>
          </div>
        </div>
      </section>

      <section className="panel landing-grid">
        <div>
          <div className="section-head">
            <p className="eyebrow">Entry</p>
            <h2>Organizations</h2>
          </div>
          {organizations.length === 0 ? (
            <EmptyState
              title="No organizations"
              body="Create one to start planning."
            />
          ) : (
            <div className="card-grid">
              {organizations.map((organization) => (
                <Link
                  key={organization.id}
                  className="card card--interactive"
                  href={`/orgs/${organization.id}/overview`}
                >
                  <div className="card__header">
                    <h3>{organization.name}</h3>
                    <StatusChip
                      tone={organization.status === "active" ? "success" : "warning"}
                      value={organization.status}
                    />
                  </div>
                  <p>{organization.slug}</p>
                  <small>{organization.organization_type}</small>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel panel--nested">
          <div className="section-head">
            <p className="eyebrow">Create</p>
            <h2>New organization</h2>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  const created = await apiRequest<Organization>("/organizations", {
                    method: "POST",
                    body: JSON.stringify(organizationForm),
                  });
                  await loadHomeData();
                  setOrganizationForm(initialOrganizationForm);
                  router.push(`/orgs/${created.id}/overview`);
                } catch (submitError) {
                  setError(
                    submitError instanceof Error
                      ? submitError.message
                      : "Unable to create the organization.",
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
                    slug: current.slug || event.target.value.toLowerCase().replaceAll(" ", "-"),
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
              <span className="field-label">Organization Type</span>
              <input
                className="form-input"
                value={organizationForm.organization_type}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,
                    organization_type: event.target.value,
                  }))
                }
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create organization"}
              </button>
              <a className="ghost-link" href="/api/v1/docs">
                Open API docs
              </a>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
