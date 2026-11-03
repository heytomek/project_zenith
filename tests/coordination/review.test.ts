import { describe, expect, test } from "bun:test";
import { acceptAll, addStrategy, authorize, committed, createWorkspace, evaluate, revokeMandate, stepAgents, updateClaim } from "../../apps/web/lib/coordination/core";
import { workedExample } from "../../apps/web/lib/coordination/examples";
import { makeProfile, PROFILES } from "../../apps/web/lib/coordination/profiles";
import { responseOptions, reviewDecision, reviewWorld } from "../../apps/web/lib/coordination/review";
import type { Workspace } from "../../apps/web/lib/coordination/types";

const fresh = (decrease = false) => createWorkspace(makeProfile({ id: decrease ? "review-emissions" : "review-habitat", name: "Watershed", objective: "Restore habitat", ...(decrease ? { baseline: 100, target: 70, unit: "kg CO₂e" } : {}) }));
function complete(workspace: Workspace) {
  let next = workspace;
  for (let i = 0; i < 15 && next.mandates.some(mandate => !["completed", "revoked"].includes(mandate.status)); i++) next = stepAgents(next);
  return next;
}

describe("decision review", () => {
  test("issued work is reviewed without reissuing its costs or applying completed effects twice", () => {
    for (const profile of PROFILES) {
      const workspace = workedExample(profile), before = structuredClone(workspace);
      const review = reviewDecision(workspace, workspace.decisions[0].id);
      expect(review.state).toBe("complete");
      for (const row of review.objectives) {
        const objective = profile.objectives.find(item => item.id === row.objectiveId)!;
        const actual = objective.baseline + workspace.outcomes.filter(outcome => outcome.objectiveId === objective.id).reduce((sum, outcome) => sum + outcome.observed, 0);
        expect(row.projected).toBeCloseTo(actual);
        expect(row.current).toBeCloseTo(actual);
        expect(row.remaining).toBe(0);
        expect(row.frozen).toBe(workspace.decisions[0].evaluation.outcomes.find(outcome => outcome.objectiveId === objective.id)!.value);
      }
      expect(review.resources.every(resource => resource.reserved === 0)).toBe(true);
      expect(review.issues.some(issue => issue.detail.includes("already has a mandate"))).toBe(false);
      expect(workspace).toEqual(before);
      expect(reviewDecision(workspace, workspace.decisions[0].id)).toEqual(review);
    }
  });

  test("partial progress consumes resources but does not invent an observed partial outcome", () => {
    let workspace = stepAgents(acceptAll(authorize(fresh(), "c.learn", "Test before extending.")));
    const review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(workspace.mandates[0].progress).toBe(1);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 30, current: 20, remaining: 10, projected: 30 });
    expect(review.resources.find(row => row.capabilityId === "c.hours")!.consumed).toBeCloseTo(40 / 3);
    expect(review.resources.find(row => row.capabilityId === "c.hours")!.reserved).toBeCloseTo(80 / 3);
    expect(review.assumptions.join(" ")).toContain("not an observed partial outcome");
    workspace = complete(workspace);
    expect(reviewDecision(workspace, workspace.decisions[0].id).objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 30, current: 28, remaining: 0, projected: 28 });
  });

  test("capacity is compared with frozen global commitments rather than added to them again", () => {
    let workspace = authorize(fresh(), "c.extend", "Keep the complete path bounded.");
    let review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ ceiling: 110, consumed: 0, reserved: 0, available: 120, total: 120, overcommitted: false });
    workspace = acceptAll(workspace);
    review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ ceiling: 110, reserved: 110, available: 10, overcommitted: false });
    expect(review.issues.some(issue => issue.kind === "capacity")).toBe(false);
    const frozen = structuredClone(workspace.decisions[0]);
    workspace = updateClaim(workspace, "c.hours-claim", 60);
    review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(committed(workspace, "c.hours")).toBe(110);
    expect(review.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ ceiling: 110, reserved: 110, available: -50, total: 60, overcommitted: true });
    expect(review.issues.find(issue => issue.kind === "capacity")).toMatchObject({ claimIds: ["c.hours-claim"] });
    expect(review.conditional).toBe(true);
    expect(workspace.decisions[0]).toEqual(frozen);
  });

  test("a proposal that no longer fits is an exception before acceptance, and recovery follows current conditions", () => {
    let workspace = updateClaim(authorize(fresh(), "c.extend", "Validate before acceptance."), "c.hours-claim", 60);
    let review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ reserved: 0, overcommitted: true });
    expect(review.issues.find(issue => issue.kind === "capacity")!.detail).toContain("proposed");
    workspace = updateClaim(workspace, "c.hours-claim", 120);
    review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.issues.some(issue => issue.kind === "capacity")).toBe(false);
    expect(review.changes).toEqual([]);
  });

  test("a changed lead traces to downstream objectives and removes only out-of-horizon future effects", () => {
    let workspace = acceptAll(authorize(createWorkspace(PROFILES[0]), "h.transition", "Sequence the shared transition."));
    const frozen = structuredClone(workspace.decisions[0]);
    workspace = updateClaim(workspace, "h.lead-claim", 30);
    const review = reviewDecision(workspace, workspace.decisions[0].id);
    const change = review.changes.find(item => item.claimId === "h.lead-claim")!;
    expect(change.reason).toBe("timing");
    expect(change.interventionIds).toContain("h.network");
    expect(change.interventionIds).toContain("h.retrofit");
    expect(change.objectiveIds.length).toBeGreaterThan(0);
    expect(review.issues.some(issue => issue.kind === "timing" && issue.claimIds.includes("h.lead-claim"))).toBe(true);
    const housing = review.objectives.find(row => row.objectiveId === "h.comfort")!;
    expect(housing.projected).toBeLessThan(housing.frozen);
    expect(workspace.decisions[0]).toEqual(frozen);
    expect(review.assumptions.join(" ")).toContain("not calendar months");
  });

  test("stopped prerequisites remove dependent effects while acknowledged stops retain consumed costs", () => {
    let workspace = stepAgents(acceptAll(authorize(fresh(), "c.extend", "Sequence the pilot and extension.")));
    const pilot = workspace.mandates.find(mandate => mandate.interventionId === "c.pilot")!;
    const consumed = pilot.resources[0].consumed;
    workspace = revokeMandate(workspace, pilot.id);
    let review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.issues.some(issue => issue.kind === "dependency")).toBe(true);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")!.remaining).toBe(0);
    expect(review.resources.find(row => row.capabilityId === "c.hours")!.reserved).toBeGreaterThan(70);
    workspace = stepAgents(workspace);
    const extension = workspace.mandates.find(mandate => mandate.interventionId === "c.expand")!;
    workspace = revokeMandate(workspace, extension.id);
    workspace = stepAgents(workspace);
    review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.state).toBe("stopped");
    expect(review.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ consumed, reserved: 0 });
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ current: 20, remaining: 0, projected: 20 });
  });

  test("completed prerequisites in another decision remain fulfilled without repeating their forecast", () => {
    let workspace = complete(acceptAll(authorize(fresh(), "c.learn", "Complete the first pilot.")));
    workspace = addStrategy(workspace, { name: "Extend after evidence", thesis: "Retain completed work and authorize only the extension.", interventionIds: ["c.expand"] });
    workspace = authorize(workspace, workspace.profile.strategies.at(-1)!.id, "Commit the distinct extension.");
    let review = reviewDecision(workspace, workspace.decisions[1].id);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 48, current: 28, remaining: 20, projected: 48 });
    expect(review.issues.some(issue => issue.kind === "dependency")).toBe(false);
    workspace = complete(acceptAll(workspace));
    review = reviewDecision(workspace, workspace.decisions[1].id);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ current: 43, remaining: 0, projected: 43 });
    expect(workspace.outcomes).toHaveLength(2);
  });

  test("a newer effect estimate cannot rewrite completed observations or the frozen projection", () => {
    let workspace = authorize(fresh(), "c.learn", "Freeze the expected response.");
    workspace = updateClaim(workspace, "c.response-claim", 0.5);
    let review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 30, current: 20, remaining: 5, projected: 25 });
    expect(review.changes.find(change => change.claimId === "c.response-claim")).toMatchObject({ reason: "effect", interventionIds: ["c.pilot"], objectiveIds: ["c.outcome"] });
    workspace = complete(acceptAll(workspace));
    review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 30, current: 28, remaining: 0, projected: 28 });
  });

  test("decreasing objectives preserve signs, and a favorable direction cannot override a protection", () => {
    let workspace = complete(acceptAll(authorize(fresh(true), "c.learn", "Reduce emissions within bounds.")));
    expect(reviewDecision(workspace, workspace.decisions[0].id).objectives.find(row => row.objectiveId === "c.outcome")).toMatchObject({ frozen: 90, current: 92, remaining: 0, projected: 92 });
    const profile = makeProfile({ id: "bounded-review", name: "Bounded access", objective: "Measured access" });
    profile.objectives[0].protection = { max: 31 };
    profile.interventions[0].observedFactor = 1.5;
    workspace = complete(acceptAll(authorize(createWorkspace(profile), "c.learn", "Expect an increase while respecting the ceiling.")));
    const review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.objectives.find(row => row.objectiveId === "c.outcome")!.protected).toBe(false);
    expect(review.issues.some(issue => issue.kind === "protection")).toBe(true);
    expect(review.conditional).toBe(false);
  });

  test("resource reassessment exposes a tighter authority envelope without increasing frozen spending", () => {
    const profile = makeProfile({ id: "cost-review", name: "Scoped research", objective: "Verified results" });
    profile.interventions[0].resources[1] = { ...profile.interventions[0].resources[1], scaleClaimId: "c.response-claim", scaleBase: 1 };
    let workspace = stepAgents(acceptAll(authorize(createWorkspace(profile), "c.learn", "Retain the original ceiling.")));
    const prior = structuredClone(workspace.mandates[0]);
    workspace = updateClaim(workspace, "c.response-claim", 1.5);
    const review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(review.issues.find(issue => issue.kind === "authority" && issue.claimIds.includes("c.response-claim"))).toBeDefined();
    expect(review.changes.find(change => change.claimId === "c.response-claim")!.reason).toBe("capacity");
    expect(workspace.mandates[0]).toEqual(prior);
  });

  test("only causal source links and actual scope participation appear in a decision review", () => {
    const profile = makeProfile({ id: "isolated-review", name: "Independent project", objective: "Verified access" });
    profile.claims.push({ ...structuredClone(profile.claims[0]), id: "unused.claim", scopeId: "c.partner", label: "Unrelated estimate" });
    profile.capabilities.push({ id: "unused.pool", scopeIds: ["c.partner"], label: "Unrelated capacity", unit: "hours", amount: 120, claimId: "unused.claim", provider: "Independent institution", period: "6 months" });
    let workspace = authorize(createWorkspace(profile), "c.learn", "Do not infer another institution's authority.");
    workspace = updateClaim(workspace, "unused.claim", 100);
    const review = reviewDecision(workspace, workspace.decisions[0].id);
    expect(workspace.decisions[0].evaluation.assumptions).toContain("unused.claim");
    expect(review.changes).toEqual([]);
    expect(review.resources.some(resource => resource.capabilityId === "unused.pool")).toBe(false);
    expect(review.participants.some(participant => participant.scopeId === "c.partner")).toBe(false);
    expect(reviewWorld(workspace, "c.root")).toHaveLength(1);
    expect(reviewWorld(workspace, "c.partner")).toEqual([]);
    expect(reviewWorld(workspace, "missing")).toEqual([]);
    expect(reviewWorld(createWorkspace(profile))).toEqual([]);
    expect(() => reviewDecision(workspace, "missing")).toThrow("Unknown decision");
  });
});

describe("bounded response options", () => {
  test("acknowledged-stop estimates retain spent capacity and cost a restart as a real new work package", () => {
    const workspace = stepAgents(acceptAll(authorize(fresh(), "c.learn", "Test a bounded course.")));
    const before = structuredClone(workspace), spent = workspace.mandates[0].resources[0].consumed;
    const options = responseOptions(workspace, workspace.decisions[0].id);
    const restart = options.find(option => option.strategyId === "c.learn")!;
    expect(restart.requiresStop).toBe(true);
    expect(restart.interventionIds).toEqual(["c.pilot"]);
    expect(restart.evaluation.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ required: 40, committed: spent });
    expect(restart.evaluation.resources.find(row => row.capabilityId === "c.hours")!.available).toBeCloseTo(120 - spent);
    expect(options.find(option => option.strategyId === "c.extend")!.evaluation.feasible).toBe(false);
    expect(restart.assumptions.join(" ")).toContain("full declared work-package cost");
    expect(restart.assumptions.join(" ")).toContain("new authorization and planning window");
    expect(workspace).toEqual(before);
  });

  test("another course's reservation and authority cannot be stopped or borrowed in the counterfactual", () => {
    const profile = makeProfile({ id: "parallel-response", name: "Parallel programs", objective: "Verified access" });
    profile.interventions[2].effects = profile.interventions[2].effects.filter(effect => effect.objectiveId !== "c.harm");
    let workspace = stepAgents(acceptAll(authorize(createWorkspace(profile), "c.learn", "Start a bounded pilot.")));
    const first = workspace.decisions[0], spent = workspace.mandates[0].resources[0].consumed;
    workspace = acceptAll(authorize(workspace, "c.short", "Fund a separate independent package."));
    const other = structuredClone(workspace.mandates[1]), before = structuredClone(workspace);
    const options = responseOptions(workspace, first.id);
    const independent = options.find(option => option.strategyId === "c.short")!;
    expect(independent.evaluation.feasible).toBe(false);
    expect(independent.evaluation.violations.join(" ")).toContain("already has a mandate");
    expect(independent.evaluation.resources.find(row => row.capabilityId === "c.hours")!.committed).toBeCloseTo(spent + 30);
    expect(workspace.mandates[1]).toEqual(other);
    expect(workspace).toEqual(before);
  });

  test("completed work is omitted from candidates and contributes only its recorded outcome and cost", () => {
    const workspace = complete(acceptAll(authorize(fresh(), "c.learn", "Complete the first pilot.")));
    const options = responseOptions(workspace, workspace.decisions[0].id);
    expect(options.some(option => option.strategyId === "c.learn")).toBe(false);
    const extension = options.find(option => option.strategyId === "c.extend")!;
    expect(extension.requiresStop).toBe(false);
    expect(extension.interventionIds).toEqual(["c.expand"]);
    expect(extension.evaluation.resources.find(row => row.capabilityId === "c.hours")).toMatchObject({ required: 70, committed: 40, available: 80 });
    expect(extension.evaluation.outcomes.find(row => row.objectiveId === "c.outcome")!.value).toBe(48);
    expect(workspace.outcomes).toHaveLength(1);
  });

  test("a preview agrees with actual authorization evaluation once the real stop is acknowledged", () => {
    let workspace = stepAgents(acceptAll(authorize(fresh(), "c.learn", "Retain costs from the initial attempt.")));
    const original = structuredClone(workspace.mandates[0]);
    const option = responseOptions(workspace, workspace.decisions[0].id).find(item => item.strategyId === "c.learn")!;
    workspace = stepAgents(revokeMandate(workspace, original.id));
    expect(workspace.mandates[0].status).toBe("revoked");
    expect(evaluate(workspace, option.strategyId)).toEqual(option.evaluation);
    workspace = complete(acceptAll(authorize(workspace, option.strategyId, "Authorize the distinct restart after acknowledgement.")));
    expect(committed(workspace, "c.hours")).toBeCloseTo(original.resources[0].consumed + 40);
    expect(workspace.outcomes).toHaveLength(1);
    expect(workspace.mandates[0].resources).toEqual(original.resources);
  });

  test("a current resource contradiction exposes feasible and infeasible named alternatives without choosing a winner", () => {
    const workspace = updateClaim(acceptAll(authorize(createWorkspace(PROFILES[0]), "h.transition", "Preserve the broader transition intent.")), "h.crew-claim", 9500);
    const before = structuredClone(workspace);
    const options = responseOptions(workspace, workspace.decisions[0].id);
    expect(options.map(option => option.strategyId)).toEqual(workspace.profile.strategies.map(strategy => strategy.id));
    expect(options.find(option => option.strategyId === "h.stabilize")!.evaluation.feasible).toBe(true);
    expect(options.find(option => option.strategyId === "h.transition")!.evaluation.feasible).toBe(false);
    expect(options.find(option => option.strategyId === "h.accelerate")!.evaluation.feasible).toBe(false);
    expect(options.every(option => option.requiresStop)).toBe(true);
    expect(workspace).toEqual(before);
    expect(() => responseOptions(workspace, "missing")).toThrow("Unknown decision");
  });
});
