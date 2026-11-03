import { describe, expect, test } from "bun:test";
import { acceptAll, authorize, committed, createWorkspace, revokeMandate, stepAgents, updateClaim } from "../../apps/web/lib/coordination/core";
import { workedExample } from "../../apps/web/lib/coordination/examples";
import { inspectWorld } from "../../apps/web/lib/coordination/insights";
import { makeProfile, PROFILES } from "../../apps/web/lib/coordination/profiles";
import type { Workspace } from "../../apps/web/lib/coordination/types";

const custom = (decrease = false) => makeProfile({
  id: decrease ? "emissions" : "access",
  name: decrease ? "Emission reduction" : "Access program",
  objective: decrease ? "Reduce emissions" : "Expand verified access",
  ...(decrease ? { unit: "kg CO₂e", baseline: 100, target: 70 } : {}),
});

function complete(workspace: Workspace): Workspace {
  let next = workspace;
  for (let step = 0; step < 20 && next.mandates.some((mandate) => !["completed", "revoked"].includes(mandate.status)); step++) next = stepAgents(next);
  return next;
}

describe("derived strategic guidance", () => {
  test("all example worlds expose contested evidence without mutating or persisting a parallel workflow", () => {
    for (const profile of PROFILES) {
      const workspace = createWorkspace(profile);
      const before = structuredClone(workspace);
      const insights = inspectWorld(workspace);
      expect(insights.phase).toBe("understand");
      expect(insights.next).toMatchObject({ label: "Inspect evidence", view: "situation", kind: "claim" });
      expect(profile.claims.find((claim) => claim.id === insights.next.referenceId)?.status).toBe("contested");
      expect(insights.attention.length).toBeLessThanOrEqual(3);
      expect(inspectWorld(workspace)).toEqual(insights);
      expect(workspace).toEqual(before);
    }
    expect(inspectWorld(createWorkspace(custom())).next).toEqual({ label: "Compare strategies", view: "strategies", kind: "navigate" });
  });

  test("guidance follows an actual decision, acceptance and completion across all three domains", () => {
    for (const profile of PROFILES) {
      let workspace = authorize(createWorkspace(profile), profile.strategies[0].id, "Commit to a bounded first course.");
      expect(inspectWorld(workspace)).toMatchObject({ phase: "delegate", summary: { proposed: workspace.mandates.length, active: 0 } });
      expect(inspectWorld(workspace).next.label).toBe("Accept mandates");
      workspace = acceptAll(workspace);
      expect(inspectWorld(workspace)).toMatchObject({ phase: "act", next: { label: "Continue" }, summary: { proposed: 0, active: workspace.mandates.length } });
      workspace = complete(workspace);
      expect(workspace.mandates.every((mandate) => mandate.status === "completed")).toBe(true);
      expect(inspectWorld(workspace)).toMatchObject({ phase: "review", next: { label: "Review outcomes", view: "ledger" }, summary: { active: 0, completed: workspace.mandates.length } });
    }
  });

  test("a changed source preempts acceptance when a frozen proposal no longer fits", () => {
    const profile = PROFILES[0];
    let workspace = authorize(createWorkspace(profile), "h.transition", "Review all frozen proposals before accepting.");
    workspace = updateClaim(workspace, "h.crew-claim", 9500);
    expect(committed(workspace, "h.crews")).toBe(0);
    const insights = inspectWorld(workspace);
    expect(insights.phase).toBe("understand");
    expect(insights.next).toEqual({ label: "Review course", view: "situation", kind: "decision", referenceId: workspace.decisions[0].id });
    expect(insights.attention[0]).toMatchObject({ kind: "capacity", referenceId: "h.crew-claim", severity: "warning" });
    expect(insights.attention[0].detail).toContain("proposed");
    expect(insights.summary.changedClaims).toBe(1);
  });

  test("capacity and blocked guidance use current state rather than lingering exception events", () => {
    let workspace = acceptAll(authorize(createWorkspace(PROFILES[0]), "h.transition", "Preserve consent and shared capacity."));
    workspace = stepAgents(updateClaim(workspace, "h.crew-claim", 9500));
    expect(inspectWorld(workspace).next).toMatchObject({ label: "Review course", kind: "decision", referenceId: workspace.decisions[0].id });
    expect(inspectWorld(workspace).summary.blocked).toBeGreaterThan(0);
    workspace = updateClaim(workspace, "h.crew-claim", 18000);
    const recovered = inspectWorld(workspace);
    expect(workspace.events.some((event) => event.kind === "blocked")).toBe(true);
    expect(recovered.phase).toBe("act");
    expect(recovered.next.label).toBe("Continue");
    expect(recovered.attention.some((item) => item.kind === "capacity" || item.kind === "mandate")).toBe(false);
    expect(recovered.summary.changedClaims).toBe(0);
  });

  test("normal dependency waits advance; stopped dependencies require a human review", () => {
    let workspace = acceptAll(authorize(createWorkspace(custom()), "c.extend", "Sequence the test and extension."));
    workspace = stepAgents(workspace);
    expect(inspectWorld(workspace)).toMatchObject({ phase: "act", summary: { blocked: 1 } });
    const pilot = workspace.mandates.find((mandate) => mandate.interventionId === "c.pilot")!;
    workspace = revokeMandate(workspace, pilot.id);
    const stopped = inspectWorld(workspace);
    expect(stopped.phase).toBe("understand");
    expect(stopped.next).toMatchObject({ label: "Review course", kind: "decision", referenceId: workspace.decisions[0].id });
    expect(stopped.attention.find((item) => item.kind === "mandate")).toMatchObject({ detail: "A required mandate has stopped.", referenceId: workspace.mandates.find((mandate) => mandate.interventionId === "c.expand")!.id });
  });

  test("stop acknowledgement removes the active prompt while retaining spent capacity", () => {
    let workspace = stepAgents(acceptAll(authorize(createWorkspace(custom()), "c.learn", "Keep authority revocable.")));
    workspace = revokeMandate(workspace, workspace.mandates[0].id);
    expect(inspectWorld(workspace)).toMatchObject({ phase: "act", next: { label: "Continue" }, summary: { active: 1 } });
    const consumed = workspace.mandates[0].resources[0].consumed;
    workspace = stepAgents(workspace);
    expect(committed(workspace, workspace.mandates[0].resources[0].capabilityId)).toBe(consumed);
    expect(inspectWorld(workspace)).toMatchObject({ phase: "choose", summary: { active: 0, completed: 0, blocked: 0 } });
    expect(inspectWorld(workspace).attention.some((item) => item.kind === "mandate")).toBe(false);
  });

  test("scope selection includes descendants without swallowing independent institutions or their exceptions", () => {
    const profile = PROFILES[2];
    const workspace = workedExample(profile);
    const libraryScope = profile.scopes.find((scope) => scope.id === "a.library")!;
    expect(libraryScope.parentId).toBeNull();
    const whole = inspectWorld(workspace);
    const library = inspectWorld(workspace, "a.library");
    const archive = inspectWorld(workspace, "a.archive");
    expect(library.summary.completed).toBe(workspace.mandates.filter((mandate) => mandate.scopeId === "a.library").length);
    expect(archive.summary.completed).toBe(workspace.mandates.filter((mandate) => mandate.scopeId === "a.archive").length);
    expect(library.summary.completed).toBeLessThan(whole.summary.completed);
    for (const item of archive.attention.filter((item) => item.kind === "evidence")) {
      expect(profile.claims.find((claim) => claim.id === item.referenceId)?.scopeId).toBe("a.archive");
    }
    const harbor = authorize(createWorkspace(PROFILES[0]), "h.transition", "Compare contained delivery programs.");
    expect(inspectWorld(harbor, "h.region").summary.proposed).toBe(harbor.mandates.length);
    expect(inspectWorld(harbor, "h.homes").summary.proposed).toBe(harbor.mandates.filter((mandate) => mandate.scopeId === "h.homes").length);
    expect(inspectWorld(harbor, "missing")).toMatchObject({ phase: "choose", attention: [], summary: { proposed: 0, active: 0, blocked: 0, completed: 0, changedClaims: 0 } });
  });

  test("source changes compare against the latest authorization without rewriting frozen inputs", () => {
    let workspace = authorize(createWorkspace(PROFILES[0]), "h.stabilize", "Freeze this input snapshot.");
    const frozen = structuredClone(workspace.decisions[0]);
    const source = workspace.profile.claims.find((claim) => claim.id === "h.crew-claim")!;
    workspace = updateClaim(workspace, source.id, 17000);
    const evidence = inspectWorld(workspace).attention.find((item) => item.id === `evidence:${source.id}`)!;
    expect(evidence).toMatchObject({ kind: "evidence", referenceId: source.id });
    expect(evidence.detail).toContain("18,000 → 17,000 hours since authorization");
    expect(inspectWorld(workspace).summary.changedClaims).toBe(1);
    expect(workspace.decisions[0]).toEqual(frozen);
    for (const mandate of workspace.mandates) workspace = revokeMandate(workspace, mandate.id);
    workspace = authorize(workspace, "h.transition", "Issue the revised course against the current evidence.");
    expect(inspectWorld(workspace).summary.changedClaims).toBe(0);
    expect(inspectWorld(workspace).attention.find((item) => item.id === `evidence:${source.id}`)?.detail).not.toContain("since authorization");
    expect(workspace.decisions[0]).toEqual(frozen);
  });

  test("outcome variance follows each objective direction rather than assuming larger means better", () => {
    for (const decrease of [false, true]) {
      let workspace = complete(acceptAll(authorize(createWorkspace(custom(decrease)), "c.learn", "Inspect the observed result.")));
      let outcome = inspectWorld(workspace).attention.find((item) => item.kind === "outcome")!;
      expect(outcome.severity).toBe("warning");
      expect(outcome.title).toContain("weaker outcome");
      expect(outcome.referenceId).toBe(workspace.decisions[0].id);
      const better = custom(decrease);
      better.interventions[0].observedFactor = 1.2;
      workspace = complete(acceptAll(authorize(createWorkspace(better), "c.learn", "Inspect favorable variance too.")));
      outcome = inspectWorld(workspace).attention.find((item) => item.kind === "outcome")!;
      expect(outcome.severity).toBe("neutral");
      expect(outcome.title).toContain("stronger outcome");
    }
  });

  test("attention stays bounded and does not resurrect completed mandate exceptions", () => {
    let workspace = acceptAll(authorize(createWorkspace(PROFILES[0]), "h.transition", "Keep the strategic summary small."));
    workspace = stepAgents(updateClaim(workspace, "h.crew-claim", 9500));
    workspace = complete(updateClaim(workspace, "h.crew-claim", 18000));
    const insights = inspectWorld(workspace);
    expect(insights.phase).toBe("review");
    expect(insights.attention.length).toBeLessThanOrEqual(6);
    expect(insights.summary.blocked).toBe(0);
    expect(insights.attention.some((item) => item.kind === "mandate" || item.kind === "capacity")).toBe(false);
  });
});
