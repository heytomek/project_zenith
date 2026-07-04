"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { apiDelete, apiRequest } from "@/lib/api/client";
import type { Certification, Skill } from "@/lib/api/types";

const initialSkillForm = {
  code: "",
  name: "",
  category: "general",
  status: "active",
};

const initialCertificationForm = {
  code: "",
  name: "",
  description: "",
  expires: true,
  status: "active",
};

function toSkillForm(skill: Skill) {
  return {
    code: skill.code,
    name: skill.name,
    category: skill.category,
    status: skill.status,
  };
}

function toCertificationForm(certification: Certification) {
  return {
    code: certification.code,
    name: certification.name,
    description: certification.description ?? "",
    expires: certification.expires,
    status: certification.status,
  };
}

function fetchCatalogSnapshot(organizationId: string) {
  return Promise.all([
    apiRequest<Skill[]>(`/organizations/${organizationId}/skills`),
    apiRequest<Certification[]>(`/organizations/${organizationId}/certifications`),
  ]);
}

export default function WorkforceCatalogPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState(initialSkillForm);
  const [certificationForm, setCertificationForm] = useState(initialCertificationForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reloadCatalog() {
    const [skillsResponse, certificationsResponse] = await fetchCatalogSnapshot(organizationId);
    setSkills(skillsResponse);
    setCertifications(certificationsResponse);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [skillsResponse, certificationsResponse] = await fetchCatalogSnapshot(
          organizationId,
        );
        if (cancelled) {
          return;
        }
        setSkills(skillsResponse);
        setCertifications(certificationsResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load the capability catalog.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function startNewSkill() {
    setSelectedSkillId(null);
    setSkillForm(initialSkillForm);
  }

  function selectSkill(skill: Skill) {
    setSelectedSkillId(skill.id);
    setSkillForm(toSkillForm(skill));
  }

  function startNewCertification() {
    setSelectedCertificationId(null);
    setCertificationForm(initialCertificationForm);
  }

  function selectCertification(certification: Certification) {
    setSelectedCertificationId(certification.id);
    setCertificationForm(toCertificationForm(certification));
  }

  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const selectedCertification =
    certifications.find((certification) => certification.id === selectedCertificationId) ?? null;

  return (
    <div className="page-stack">
      <PageHeader
        title="Capabilities"
        description="Skills and credentials."
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="workspace-grid">
        <SectionCard
          title="Skills"
          actions={
            <button className="ghost-button" type="button" onClick={startNewSkill}>
              New skill
            </button>
          }
        >
          {skills.length === 0 ? (
            <EmptyState
              title="No skills"
            />
          ) : (
            <DataTable columns={["Code", "Name", "Category", "Status"]}>
              {skills.map((skill) => (
                <tr
                  key={skill.id}
                  className={skill.id === selectedSkillId ? "is-selected" : ""}
                  onClick={() => selectSkill(skill)}
                >
                  <td>{skill.code}</td>
                  <td>{skill.name}</td>
                  <td>{skill.category}</td>
                  <td>
                    <StatusChip
                      tone={skill.status === "active" ? "success" : "warning"}
                      value={skill.status}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  const savedSkill = selectedSkill
                    ? await apiRequest<Skill>(
                        `/organizations/${organizationId}/skills/${selectedSkill.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify(skillForm),
                        },
                      )
                    : await apiRequest<Skill>(`/organizations/${organizationId}/skills`, {
                        method: "POST",
                        body: JSON.stringify(skillForm),
                      });

                  selectSkill(savedSkill);
                  await reloadCatalog();
                } catch (submitError) {
                  setError(
                    submitError instanceof Error ? submitError.message : "Unable to save the skill.",
                  );
                }
              });
            }}
          >
            <label className="form-field">
              <span className="field-label">Code</span>
              <input
                className="form-input"
                value={skillForm.code}
                onChange={(event) =>
                  setSkillForm((current) => ({ ...current, code: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Name</span>
              <input
                className="form-input"
                value={skillForm.name}
                onChange={(event) =>
                  setSkillForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Category</span>
              <input
                className="form-input"
                value={skillForm.category}
                onChange={(event) =>
                  setSkillForm((current) => ({ ...current, category: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span className="field-label">Status</span>
              <select
                className="form-select"
                value={skillForm.status}
                onChange={(event) =>
                  setSkillForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {selectedSkill ? "Save skill" : "Create skill"}
              </button>
              {selectedSkill ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(`/organizations/${organizationId}/skills/${selectedSkill.id}`);
                        startNewSkill();
                        await reloadCatalog();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the skill.",
                        );
                      }
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Certifications"
          actions={
            <button className="ghost-button" type="button" onClick={startNewCertification}>
              New certification
            </button>
          }
        >
          {certifications.length === 0 ? (
            <EmptyState
              title="No certifications"
            />
          ) : (
            <DataTable columns={["Code", "Name", "Expires", "Status"]}>
              {certifications.map((certification) => (
                <tr
                  key={certification.id}
                  className={certification.id === selectedCertificationId ? "is-selected" : ""}
                  onClick={() => selectCertification(certification)}
                >
                  <td>{certification.code}</td>
                  <td>{certification.name}</td>
                  <td>{certification.expires ? "Yes" : "No"}</td>
                  <td>
                    <StatusChip
                      tone={certification.status === "active" ? "success" : "warning"}
                      value={certification.status}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  const savedCertification = selectedCertification
                    ? await apiRequest<Certification>(
                        `/organizations/${organizationId}/certifications/${selectedCertification.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify(certificationForm),
                        },
                      )
                    : await apiRequest<Certification>(`/organizations/${organizationId}/certifications`, {
                        method: "POST",
                        body: JSON.stringify(certificationForm),
                      });

                  selectCertification(savedCertification);
                  await reloadCatalog();
                } catch (submitError) {
                  setError(
                    submitError instanceof Error
                      ? submitError.message
                      : "Unable to save the certification.",
                  );
                }
              });
            }}
          >
            <label className="form-field">
              <span className="field-label">Code</span>
              <input
                className="form-input"
                value={certificationForm.code}
                onChange={(event) =>
                  setCertificationForm((current) => ({ ...current, code: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Name</span>
              <input
                className="form-input"
                value={certificationForm.name}
                onChange={(event) =>
                  setCertificationForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field form-field--full">
              <span className="field-label">Description</span>
              <textarea
                className="form-textarea"
                value={certificationForm.description}
                onChange={(event) =>
                  setCertificationForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-field">
              <span className="field-label">Expires</span>
              <select
                className="form-select"
                value={certificationForm.expires ? "yes" : "no"}
                onChange={(event) =>
                  setCertificationForm((current) => ({
                    ...current,
                    expires: event.target.value === "yes",
                  }))
                }
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Status</span>
              <select
                className="form-select"
                value={certificationForm.status}
                onChange={(event) =>
                  setCertificationForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {selectedCertification ? "Save certification" : "Create certification"}
              </button>
              {selectedCertification ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await apiDelete(
                          `/organizations/${organizationId}/certifications/${selectedCertification.id}`,
                        );
                        startNewCertification();
                        await reloadCatalog();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : "Unable to delete the certification.",
                        );
                      }
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      </section>
    </div>
  );
}
