import { describe, expect, test } from "bun:test";
import { acceptAll, authorize, createProjectWorkspace, createWorkspace, recordProjectResponse, refreshProject, stepAgents, validateProfile, validateWorkspace } from "../../apps/web/lib/coordination/core";
import { buildProjectSnapshot, parseProjectInput, suggestProjectMapping } from "../../apps/web/lib/coordination/project-data";
import { reviewProject } from "../../apps/web/lib/coordination/project-review";
import { exportLibrary, importLibrary, validateLibrary } from "../../apps/web/lib/coordination/storage";
import { PROFILES } from "../../apps/web/lib/coordination/profiles";

function source(id = "source-1", forecast = "2026-12-01", asOf = "2026-11-02") {
  const parsed = parseProjectInput(`id,project,title,owner,status,due_date,forecast_date,budget,forecast_cost,currency,depends_on,decision\nlab,Product launch,Certification,Maya,active,2026-11-10,${forecast},100000,130000,USD,,\nlaunch,Product launch,Launch,Luca,blocked,2026-11-15,2026-12-05,,,,lab,Choose a launch commitment\n`);
  return buildProjectSnapshot(parsed, suggestProjectMapping(parsed.columns), { id, name: "Commitments.csv", asOf, importedAt: "2026-11-02T15:00:00.000Z" });
}

describe("real project workspace integration", () => {
  test("creates a source-backed workspace without fabricated model effects or execution rights", () => {
    const w = createProjectWorkspace(source(), "Launch review", "project-live");
    expect(validateWorkspace(w)).toEqual(w);
    expect(w.profile.horizonMonths).toBe(0);
    expect(w.profile.objectives).toEqual([]);
    expect(w.profile.interventions).toEqual([]);
    expect(w.profile.agents.every(agent => agent.actions.join() === "review")).toBe(true);
    expect(() => validateProfile(w.profile)).toThrow();
    expect(() => createWorkspace(w.profile)).toThrow();
    expect(() => authorize(w, "anything", "Pretend authority")).toThrow("not simulated execution");
    expect(() => acceptAll(w)).toThrow("not simulated execution");
    expect(() => stepAgents(w)).toThrow("not simulated execution");
  });

  test("new data appends to a mixed library without changing existing worlds", () => {
    const original = createWorkspace(PROFILES[0]);
    const imported = createProjectWorkspace(source(), "Launch review", "project-live");
    const library = validateLibrary({ version: 2, activeId: imported.profile.id, onboardingDone: true, workspaces: [original, imported] });
    expect(library.workspaces[0]).toEqual(original);
    expect(library.workspaces[1].project!.snapshots[0].records[0].cells.forecast_date).toBe("2026-12-01");
  });

  test("recorded judgments reproduce from their cited evidence across portable exports", async () => {
    const original = createProjectWorkspace(source(), "Launch review", "project-live");
    const finding = reviewProject(original.project!, "2026-11-02")[0];
    const saved = recordProjectResponse(original, finding.id, finding.fingerprint, "Request an agreed launch date; retain the safety gate.", "2026-11-02");
    expect(original.project!.responses).toEqual([]);
    expect(saved.revision).toBe(1);
    expect(saved.project!.snapshots).toEqual(original.project!.snapshots);
    const raw = await exportLibrary({ version: 2, activeId: saved.profile.id, onboardingDone: true, workspaces: [saved] });
    const reopened = await importLibrary(raw);
    expect(reopened.workspaces[0]).toEqual(saved);
    expect(reviewProject(reopened.workspaces[0].project!, "2026-11-02").find(item => item.id === finding.id)?.reviewed).toBe(true);
  });

  test("refresh preserves sources and decisions while changed evidence reopens attention", () => {
    const w = createProjectWorkspace(source(), "Launch review", "project-live");
    const finding = reviewProject(w.project!, "2026-11-02").find(item => item.kind === "deadline")!;
    const saved = recordProjectResponse(w, finding.id, finding.fingerprint, "Verify the December forecast.", "2026-11-02");
    const refreshed = refreshProject(saved, source("source-2", "2027-01-05"));
    expect(refreshed.project!.snapshots[0]).toEqual(w.project!.snapshots[0]);
    expect(refreshed.project!.responses).toEqual(saved.project!.responses);
    expect(refreshed.revision).toBe(2);
    expect(reviewProject(refreshed.project!, "2026-11-02").find(item => item.kind === "deadline")?.reviewed).toBe(false);
    expect(() => recordProjectResponse(refreshed, finding.id, finding.fingerprint, "Stale response", "2026-11-02")).toThrow("evidence changed");
    expect(() => refreshProject(refreshed, source("source-3"), saved.revision)).toThrow("changed");
    expect(() => refreshProject(refreshed, source("source-3", "2026-12-01", "2026-11-01"))).toThrow("precede");
  });

  test("normalization tampering and impossible response provenance are rejected", () => {
    const w = createProjectWorkspace(source(), "Launch review", "project-live");
    const finding = reviewProject(w.project!, "2026-11-02")[0];
    const saved = recordProjectResponse(w, finding.id, finding.fingerprint, "Verify with the owner.", "2026-11-02");
    const altered = structuredClone(saved);
    altered.project!.snapshots[0].records[0].forecastDate = "2026-11-01";
    expect(() => validateWorkspace(altered)).toThrow();
    const forged = structuredClone(saved);
    forged.project!.responses[0].fingerprint = "rules-v1:0000000000000000";
    expect(() => validateWorkspace(forged)).toThrow("cited evidence");
    const omitted = structuredClone(saved);
    delete omitted.project;
    expect(() => validateWorkspace(omitted)).toThrow();
  });

  test("project mode cannot launder a simulation, runtime history, or expanded agent rights", () => {
    const w = createProjectWorkspace(source(), "Launch review", "project-live");
    const modeled = structuredClone(w);
    modeled.profile = createWorkspace(PROFILES[0]).profile;
    expect(() => validateWorkspace(modeled)).toThrow("execution rights");
    const expanded = structuredClone(w);
    expanded.profile.agents[0].actions.push("deliver");
    expect(() => validateWorkspace(expanded)).toThrow("execution rights");
    const revision = structuredClone(w);
    revision.revision = revision.tick = 1;
    expect(() => validateWorkspace(revision)).toThrow("history");
  });

  test("portable histories cannot bypass source chronology or record a decision before its evidence", () => {
    const w = createProjectWorkspace(source(), "Launch review", "project-live");
    const refreshed = refreshProject(w, source("source-2", "2027-01-05", "2026-11-03"));
    const backwards = structuredClone(refreshed);
    backwards.project!.snapshots.reverse();
    expect(() => validateWorkspace(backwards)).toThrow("order");
    const finding = reviewProject(w.project!, "2026-11-02")[0];
    const saved = recordProjectResponse(w, finding.id, finding.fingerprint, "Verify with the owner.", "2026-11-02");
    saved.project!.responses[0].createdAt = "2026-11-01T10:00:00.000Z";
    expect(() => validateWorkspace(saved)).toThrow("precedes");
  });
});
