import { describe, expect, test } from "bun:test";
import { workedExample } from "../../apps/web/lib/coordination/examples";
import { PROFILES, makeProfile } from "../../apps/web/lib/coordination/profiles";
import { createWorkspace, validateWorkspace } from "../../apps/web/lib/coordination/core";

describe("Worked coordination examples", () => {
  for (const profile of PROFILES) {
    test(`${profile.name} contains an accountable decision-to-outcome history and a subsequent source change`, () => {
      const before = structuredClone(profile);
      const workspace = workedExample(profile);
      expect(workspace.profile.id).toBe(profile.id);
      expect(workspace.decisions).toHaveLength(1);
      const decision = workspace.decisions[0];
      expect(decision.strategyId).toBe(profile.strategies[0].id);
      expect(decision.authority).toBe(profile.authority);
      expect(decision.rationale).toBe(profile.strategies[0].thesis);
      expect(decision.evaluation.feasible).toBe(true);
      expect(workspace.mandates.length).toBeGreaterThan(1);
      expect(new Set(workspace.mandates.map((mandate) => mandate.agentId)).size).toBeGreaterThan(1);
      expect(workspace.mandates.every((mandate) => mandate.status === "completed" && mandate.progress === 3)).toBe(true);
      expect(workspace.outcomes.length).toBeGreaterThan(0);
      expect(workspace.outcomes.some((outcome) => outcome.expected !== outcome.observed)).toBe(true);
      expect(workspace.outcomes.every((outcome) => outcome.source.startsWith("Synthetic completion"))).toBe(true);
      expect(workspace.events.some((event) => event.kind === "decision")).toBe(true);
      expect(workspace.events.some((event) => event.kind === "accepted")).toBe(true);
      expect(workspace.events.some((event) => event.kind === "progress")).toBe(true);
      expect(workspace.events.some((event) => event.kind === "outcome")).toBe(true);
      const sourceEvent = workspace.events.at(-1)!;
      expect(sourceEvent.kind).toBe("claim");
      const shock = profile.shocks.find((candidate) => candidate.claimId === sourceEvent.referenceId)!;
      expect(shock).toBeDefined();
      expect(workspace.claimValues[shock.claimId]).toBe(shock.value);
      expect(decision.claimValues[shock.claimId]).toBe(profile.claims.find((claim) => claim.id === shock.claimId)!.value);
      expect(decision.claimValues[shock.claimId]).not.toBe(workspace.claimValues[shock.claimId]);
      expect(workspace.outcomes.every((outcome) => outcome.createdAt < sourceEvent.createdAt)).toBe(true);
      expect(decision.mandateIds).toEqual(workspace.mandates.map((mandate) => mandate.id));
      for (const mandate of workspace.mandates) {
        for (const resource of mandate.resources) expect(resource.consumed).toBe(resource.amount);
      }
      expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
      expect(profile).toEqual(before);
      expect(createWorkspace(profile).decisions).toHaveLength(0);
      expect(createWorkspace(profile).claimValues).toEqual(decision.claimValues);
    });
  }

  test("histories are reproducible and independent of previous exploration", () => {
    const first = workedExample(PROFILES[0]);
    const second = workedExample(PROFILES[0]);
    expect(second).toEqual(first);
    first.events[0].title = "Changed in one browser workspace";
    first.mandates[0].resources[0].consumed = 0;
    expect(second.events[0].title).not.toBe(first.events[0].title);
    expect(second.mandates[0].resources[0].consumed).toBeGreaterThan(0);
  });

  test("small custom scopes use the same completed simulation without inventing a multi-agent team", () => {
    const profile = makeProfile({ name: "Access circle", objective: "Remove local access barriers", id: "access" });
    const workspace = workedExample(profile);
    expect(workspace.decisions).toHaveLength(1);
    expect(workspace.mandates).toHaveLength(1);
    expect(workspace.outcomes).toHaveLength(1);
    expect(workspace.mandates[0].status).toBe("completed");
    expect(workspace.claimValues["c.hours-claim"]).toBe(60);
    expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
  });

  test("an inadmissible profile is not silently made executable", () => {
    const profile = structuredClone(PROFILES[0]);
    profile.strategies = [profile.strategies[2]];
    expect(() => workedExample(profile)).toThrow("no feasible strategy");
  });
});
