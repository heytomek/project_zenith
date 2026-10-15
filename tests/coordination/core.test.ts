import { describe, expect, test } from "bun:test";
import { acceptAll, acceptMandate, authorize, capabilityAmount, committed, createWorkspace, evaluate, rejectProbe, revokeMandate, stepAgents, updateClaim, validateProfile, validateWorkspace } from "../../apps/web/lib/coordination/core";
import type { Profile, Workspace } from "../../apps/web/lib/coordination/types";

const profile: Profile = {
  id: "test-region", name: "Test region", icon: "region", subtitle: "Two programs share one capital pool", question: "Which sequence preserves household access?", context: "Synthetic coordination fixture", date: "2027-01-01", horizonMonths: 12, authority: "Regional council", principles: ["Preserve household access", "No implicit authority"],
  scopes: [{ id: "region", name: "Region", parentId: null, relatedIds: [], kind: "region", steward: "Council", description: "Strategic boundary" }, { id: "homes", name: "Homes", parentId: "region", relatedIds: [], kind: "program", steward: "Resident assembly", description: "Independent consent" }, { id: "energy", name: "Energy", parentId: "region", relatedIds: ["homes"], kind: "program", steward: "Utility", description: "Infrastructure" }],
  objectives: [{ id: "access", scopeId: "region", label: "Protected household access", unit: "households", baseline: 1000, target: 1500, direction: "increase", protection: { min: 1000 }, description: "No household loses access" }, { id: "risk", scopeId: "homes", label: "Displacement exposure", unit: "households", baseline: 0, target: 0, direction: "decrease", protection: { max: 5 }, description: "Maximum permitted exposure" }],
  claims: [{ id: "capital-source", scopeId: "region", label: "Available capital", value: 100, unit: "credits", status: "observed", min: 20, max: 200, step: 1, source: { title: "Capital ledger", author: "Council", date: "2026-12-20", excerpt: "100 uncommitted credits" } }, { id: "yield", scopeId: "homes", label: "Program yield", value: 75, unit: "%", status: "assumed", min: 0, max: 100, step: 5, source: { title: "Scenario assumption", author: "Analyst", date: "2026-12-21", excerpt: "75% yield, unverified" } }, { id: "lead", scopeId: "energy", label: "Training lead", value: 2, unit: "months", status: "contested", min: 1, max: 18, step: 1, source: { title: "Provider estimate", author: "Training provider", date: "2026-12-22", excerpt: "Two months, disputed" }, dissent: "An independent estimate is four months." }],
  capabilities: [{ id: "capital", scopeIds: ["region", "homes", "energy"], label: "Capital", unit: "credits", amount: 100, claimId: "capital-source", provider: "Council", period: "12-month commitment" }],
  interventions: [{ id: "train", scopeId: "energy", title: "Train specialists", mechanism: "Grow durable capability", agentId: "energy-agent", dependencies: [], resources: [{ capabilityId: "capital", amount: 60 }], effects: [{ objectiveId: "access", amount: 100 }], leadMonths: 2, leadClaimId: "lead", reversible: true, observedFactor: 0.9 }, { id: "retrofit", scopeId: "homes", title: "Resident-led retrofit", mechanism: "Apply qualified capacity", agentId: "homes-agent", dependencies: ["train"], resources: [{ capabilityId: "capital", amount: 30 }], effects: [{ objectiveId: "access", amount: 200, scaleClaimId: "yield", scaleBase: 100 }, { objectiveId: "risk", amount: 3 }], leadMonths: 4, reversible: true, observedFactor: 0.9 }, { id: "contract", scopeId: "homes", title: "Contract externally", mechanism: "Buy existing capability", agentId: "homes-agent", dependencies: [], resources: [{ capabilityId: "capital", amount: 70 }], effects: [{ objectiveId: "access", amount: 180 }], leadMonths: 3, reversible: false, observedFactor: 0.8 }, { id: "unsafe", scopeId: "homes", title: "Vacant possession", mechanism: "Remove residents to speed construction", agentId: "homes-agent", dependencies: [], resources: [{ capabilityId: "capital", amount: 10 }], effects: [{ objectiveId: "access", amount: 500 }, { objectiveId: "risk", amount: 8 }], leadMonths: 1, reversible: false, observedFactor: 1 }],
  strategies: [{ id: "balanced", name: "Build capability", thesis: "Sequence training and resident-led work", interventionIds: ["train", "retrofit"] }, { id: "alternative", name: "Buy capacity", thesis: "Move sooner with external help", interventionIds: ["contract"] }, { id: "unsafe-strategy", name: "Displace residents", thesis: "Breaks a protected condition", interventionIds: ["unsafe"] }],
  agents: [{ id: "energy-agent", name: "Energy specialist", initials: "EN", role: "Simulated specialist", scopeIds: ["energy"], actions: ["deliver"] }, { id: "homes-agent", name: "Housing specialist", initials: "HO", role: "Simulated specialist", scopeIds: ["homes"], actions: ["deliver"] }],
  shocks: [{ id: "capital-loss", name: "Capital withdrawal", claimId: "capital-source", value: 50, description: "Withdraw funding without changing issued ceilings" }],
};
const fresh = () => createWorkspace(profile);
const approved = () => authorize(fresh(), "balanced", "Preserve access and develop local capability.");
function checked(workspace: Workspace) { expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace); return workspace; }

describe("strategic coordination", () => {
  test("reproducible resource, dependency and multi-objective evaluation", () => {
    const w = checked(fresh()); const result = evaluate(w, "balanced");
    expect(result.feasible).toBe(true);
    expect(result.resources[0]).toEqual({ capabilityId: "capital", required: 90, available: 100, total: 100, committed: 0 });
    expect(result.schedule).toEqual([{ interventionId: "train", start: 0, finish: 2 }, { interventionId: "retrofit", start: 2, finish: 6 }]);
    expect(result.outcomes.map((o) => o.value)).toEqual([1250, 3]);
    expect(result.assumptions).toEqual(["capital-source", "lead", "yield"]);
    expect(evaluate(w, "unsafe-strategy").violations).toContain("Displacement exposure: 8 households breaches a protected condition.");
    expect(() => authorize(w, "unsafe-strategy", "Ignore protection")).toThrow("protected condition");
  });

  test("late dependency removes causal effects rather than silently applying them", () => {
    const w = checked(updateClaim(fresh(), "lead", 14));
    const result = evaluate(w, "balanced");
    expect(result.schedule.map((s) => s.finish)).toEqual([14, 18]);
    expect(result.outcomes.map((o) => o.delta)).toEqual([0, 0]);
    const delayed = checked(authorize(w, "balanced", "Authorize the long sequence while retaining no within-horizon benefit."));
    expect(delayed.mandates.every((m) => m.expectedEffects.length === 0)).toBe(true);
  });

  test("missing dependencies and capability scope offers are explicit feasibility failures", () => {
    const p = structuredClone(profile); p.strategies[0].interventionIds = ["retrofit"];
    expect(evaluate(createWorkspace(p), "balanced").violations[0]).toContain("requires Train specialists");
    p.strategies[0].interventionIds = ["train", "retrofit"]; p.capabilities[0].scopeIds = ["region"];
    expect(evaluate(createWorkspace(p), "balanced").feasible).toBe(false);
    expect(() => authorize(createWorkspace(p), "balanced", "Parent scope is not resource authority.")).toThrow("not offered");
  });

  test("frozen decision, ceilings and expectations survive source revisions", () => {
    const original = fresh(); let w = checked(authorize(original, "balanced", "Trade off speed for durable capability."));
    const frozen = structuredClone(w.decisions[0]);
    expect(original.decisions).toHaveLength(0);
    w = checked(updateClaim(w, "yield", 50));
    expect(w.decisions[0]).toEqual(frozen);
    expect(w.mandates[1].expectedEffects[0].amount).toBe(150);
    expect(w.decisions[0].revision).toBe(0);
    expect(w.decisions[0].createdAt).toBe("2027-01-01T01:00:00.000Z");
    expect(() => updateClaim(w, "yield", 25, 0)).toThrow("changed");
    expect(() => authorize(w, "alternative", "Stale authorization", 0)).toThrow("changed");
    expect(() => authorize(w, "balanced", "Duplicate intervention")).toThrow("already has a mandate");
  });

  test("atomic acceptance, idempotent retries and shared-capacity competition", () => {
    let w = checked(approved());
    w = checked(authorize(w, "alternative", "A second unaccepted proposal competes for the same resource."));
    const untouched = structuredClone(w);
    expect(() => acceptAll(w)).toThrow("insufficient");
    expect(w).toEqual(untouched);
    w = checked(acceptMandate(w, w.mandates[0].id));
    expect(committed(w, "capital")).toBe(60);
    expect(acceptMandate(w, w.mandates[0].id)).toEqual(w);
    expect(() => acceptMandate(w, w.mandates[2].id)).toThrow("insufficient");
    expect(() => acceptMandate(w, w.mandates[1].id, 1)).toThrow("changed");
    w = checked(acceptMandate(w, w.mandates[1].id));
    expect(committed(w, "capital")).toBe(90);
  });

  test("agent authority must be explicit and the coordinator rejects expanded scope", () => {
    const p = structuredClone(profile); p.agents[0].scopeIds = ["region"];
    expect(evaluate(createWorkspace(p), "balanced").feasible).toBe(false);
    expect(() => authorize(createWorkspace(p), "balanced", "Nesting grants no delivery authority.")).toThrow("authority");
    let w = approved(); const before = structuredClone(w.mandates);
    w = checked(rejectProbe(w, w.mandates[0].id));
    expect(w.mandates).toEqual(before); expect(committed(w, "capital")).toBe(0);
    expect(w.events.at(-1)?.kind).toBe("rejected");
    const missingAction = structuredClone(profile); missingAction.agents[0].actions = ["inspect"];
    expect(evaluate(createWorkspace(missingAction), "balanced").feasible).toBe(false);
  });

  test("deterministic specialists respect dependencies, consume once and retain observed variance", () => {
    let w = checked(acceptAll(approved()));
    for (let tick = 0; tick < 3; tick++) w = checked(stepAgents(w));
    expect(w.mandates[0].status).toBe("completed");
    expect(w.mandates[1].status).toBe("blocked");
    expect(w.mandates[1].progress).toBe(0);
    expect(w.outcomes[0]).toMatchObject({ expected: 100, observed: 90, objectiveId: "access" });
    for (let tick = 0; tick < 3; tick++) w = checked(stepAgents(w));
    expect(w.mandates.every((m) => m.status === "completed")).toBe(true);
    expect(w.outcomes.map((o) => [o.expected, o.observed])).toEqual([[100, 90], [150, 135], [3, 2.7]]);
    expect(committed(w, "capital")).toBe(90);
    expect(w.outcomes.filter((o) => o.objectiveId === "access").reduce((sum, o) => sum + o.observed, 0)).toBe(225);
    expect(stepAgents(w)).toEqual(w);
    expect(() => revokeMandate(w, w.mandates[0].id)).toThrow("Completed work");
    expect(evaluate(w, "alternative").outcomes[0].value).toBe(1405);
  });

  test("a source shock blocks existing execution without rewriting ceilings", () => {
    let w = checked(acceptAll(approved())); const ceilings = structuredClone(w.mandates.map((m) => m.resources));
    w = checked(updateClaim(w, "capital-source", 50));
    expect(capabilityAmount(w, "capital")).toBe(50); expect(committed(w, "capital")).toBe(90);
    w = checked(stepAgents(w));
    expect(w.mandates.every((m) => m.status === "blocked" && m.progress === 0)).toBe(true);
    expect(w.mandates.map((m) => m.resources)).toEqual(ceilings);
    expect(evaluate(w, "alternative").resources[0].available).toBe(-40);
    w = checked(updateClaim(w, "capital-source", 100)); w = checked(stepAgents(w));
    expect(w.mandates[0].status).toBe("running");
  });

  test("revoke retains reservations until stop acknowledgement and releases only unconsumed capacity", () => {
    let w = checked(acceptMandate(approved(), approved().mandates[0].id));
    w = checked(stepAgents(w)); expect(w.mandates[0].resources[0].consumed).toBe(20);
    w = checked(revokeMandate(w, w.mandates[0].id));
    expect(w.mandates[0].status).toBe("stopping"); expect(committed(w, "capital")).toBe(60);
    expect(revokeMandate(w, w.mandates[0].id)).toEqual(w);
    w = checked(stepAgents(w)); expect(w.mandates[0].status).toBe("revoked"); expect(committed(w, "capital")).toBe(20);
    expect(() => acceptMandate(w, w.mandates[1].id)).toThrow("stopped");
    expect(() => acceptMandate(w, w.mandates[0].id)).toThrow("stopped");
    w = checked(authorize(w, "alternative", "Use remaining unconsumed capacity."));
    w = checked(acceptMandate(w, w.mandates[2].id)); expect(committed(w, "capital")).toBe(90);
  });

  test("expired delegation stops before additional spending", () => {
    let w = checked(acceptAll(approved()));
    w = checked(updateClaim(w, "capital-source", 50));
    for (let n = 0; n < 40; n++) w = checked(stepAgents(w));
    expect(w.mandates.every((m) => m.status === "revoked" && m.progress === 0)).toBe(true);
    expect(committed(w, "capital")).toBe(0);
    expect(() => acceptMandate(w, w.mandates[0].id)).toThrow("stopped");
  });

  test("bounded strict profiles reject cycles, duplicate IDs, bad units, missing protection and nonfinite input", () => {
    for (const damage of [
      (p: Profile) => { p.scopes[0].parentId = "homes"; },
      (p: Profile) => { p.interventions[0].dependencies = ["retrofit"]; },
      (p: Profile) => { p.scopes.push(structuredClone(p.scopes[0])); },
      (p: Profile) => { p.capabilities[0].unit = "hours"; },
      (p: Profile) => { p.claims[2].unit = "days"; },
      (p: Profile) => { p.objectives.forEach((o) => { delete o.protection; }); },
      (p: Profile) => { p.claims[0].value = Infinity; },
      (p: Profile) => { delete p.interventions[1].effects[0].scaleBase; },
      (p: Profile) => { p.strategies[0].interventionIds = ["missing"]; },
      (p: Profile) => { p.claims[0].id = "__proto__"; },
      (p: Profile) => { p.capabilities[0].id = p.objectives[0].id; },
      (p: Profile) => { p.interventions[1].effects[0].amount = 1e12; p.interventions[1].effects[0].scaleBase = 1e-7; },
      (p: Profile) => { p.name = "   "; },
    ]) { const p = structuredClone(profile); damage(p); expect(() => validateProfile(p)).toThrow(); }
    expect(() => validateProfile({ ...profile, unvalidatedAuthority: "god mode" })).toThrow("unsupported");
    expect(() => validateProfile({ ...profile, scopes: Array(201).fill(profile.scopes[0]) })).toThrow("at most");
  });

  test("imports reject fabricated ceiling, consumption, outcome, frozen run and omitted audit history", () => {
    let w = acceptAll(approved()); for (let n = 0; n < 6; n++) w = stepAgents(w);
    checked(w);
    for (const damage of [
      (v: Workspace) => { v.mandates[0].resources[0].amount += 1; },
      (v: Workspace) => { v.mandates[0].resources[0].consumed -= 1; },
      (v: Workspace) => { v.outcomes[0].observed = 500; },
      (v: Workspace) => { v.outcomes[0].decisionId = "missing"; },
      (v: Workspace) => { v.decisions[0].evaluation.outcomes[0].value += 1; },
      (v: Workspace) => { v.decisions[0].snapshot!.commitments.capital = 2; },
      (v: Workspace) => { v.events.splice(0, 1); },
      (v: Workspace) => { v.mandates[1].dependencies = []; },
      (v: Workspace) => { v.mandates[0].expiresAt += 100; },
      (v: Workspace) => { v.tick++; },
    ]) { const damaged = structuredClone(w); damage(damaged); expect(() => validateWorkspace(damaged)).toThrow(); }
  });

  test("trace replay rejects plausible concurrent overacceptance below a claim's maximum", () => {
    // Construct a superficially valid extra accepted reservation: each individual
    // ceiling was authorized, and 160 is below the source maximum of 200.
    const competing = authorize(approved(), "alternative", "Competing proposal.");
    const forged = structuredClone(competing); forged.revision = 3; forged.tick = 3;
    forged.mandates.forEach((m) => { m.status = "accepted"; });
    forged.mandates.forEach((m, index) => { forged.events.push({ id: `forged-${index}`, kind: "accepted", title: "Accepted", detail: "Fabricated simultaneous acceptance", scopeId: m.scopeId, referenceId: m.id, createdAt: "2027-01-01T03:00:00.000Z" }); });
    expect(() => validateWorkspace(forged)).toThrow("overspending");
  });
});
