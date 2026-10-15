import { describe, expect, test } from "bun:test";
import { PROFILES, makeProfile, profileById } from "../../apps/web/lib/coordination/profiles";
import { acceptAll, authorize, committed, createWorkspace, evaluate, stepAgents, updateClaim, validateProfile, validateWorkspace } from "../../apps/web/lib/coordination/core";
import type { Profile } from "../../apps/web/lib/coordination/types";

const custom = () => makeProfile({ name: "Neighborhood repair circle", objective: "Reduce unresolved access barriers", id: "repair-circle" });
const cases: Profile[] = [...PROFILES, custom()];

describe("Strategic worked profiles", () => {
  test("three distinct scales use one finite, scoped contract", () => {
    expect(PROFILES.map((profile) => profile.id)).toEqual(["harbor", "meridian", "atlas"]);
    expect(PROFILES.map((profile) => profile.icon)).toEqual(["region", "enterprise", "commons"]);
    expect(PROFILES.map((profile) => profile.horizonMonths)).toEqual([36, 12, 18]);
    expect(profileById("harbor")).toBe(PROFILES[0]);
    expect(profileById("not-a-profile")).toBeUndefined();
    for (const profile of PROFILES) {
      expect(validateProfile(profile)).toEqual(profile);
      expect(profile.scopes.length).toBeGreaterThanOrEqual(5);
      expect(profile.objectives).toHaveLength(5);
      expect(profile.claims).toHaveLength(8);
      expect(profile.capabilities).toHaveLength(5);
      expect(profile.interventions).toHaveLength(7);
      expect(profile.strategies).toHaveLength(3);
      expect(profile.agents).toHaveLength(4);
      expect(profile.shocks).toHaveLength(2);
      expect(profile.context.toLowerCase()).toContain("fictional");
      expect(profile.objectives.some((objective) => objective.protection)).toBe(true);
      expect(profile.scopes.filter((scope) => scope.parentId === null).length).toBeGreaterThan(1);
      expect(profile.scopes.some((scope) => scope.relatedIds.length > 1)).toBe(true);
      expect(new Set(profile.claims.map((claim) => claim.status))).toEqual(new Set(["observed", "assumed", "contested"]));
      for (const claim of profile.claims) {
        expect(claim.source.title).toContain("synthetic");
        expect(claim.source.excerpt.length).toBeGreaterThan(80);
        expect(claim.source.date <= profile.date).toBe(true);
        expect(claim.value).toBeGreaterThanOrEqual(claim.min);
        expect(claim.value).toBeLessThanOrEqual(claim.max);
        if (claim.status === "contested") expect(claim.dissent?.length).toBeGreaterThan(20);
      }
      for (const capability of profile.capabilities) {
        const source = profile.claims.find((claim) => claim.id === capability.claimId)!;
        expect(source.value).toBe(capability.amount);
        expect(source.unit).toBe(capability.unit);
      }
      for (const intervention of profile.interventions) {
        const agent = profile.agents.find((candidate) => candidate.id === intervention.agentId)!;
        expect(agent.actions).toContain("deliver");
        expect(agent.scopeIds).toContain(intervention.scopeId);
        for (const resource of intervention.resources) {
          expect(profile.capabilities.find((capability) => capability.id === resource.capabilityId)!.scopeIds).toContain(intervention.scopeId);
        }
      }
    }
  });

  for (const profile of cases) {
    test(`${profile.name} compares achievable tradeoffs and refuses an inadmissible portfolio`, () => {
      const workspace = createWorkspace(profile);
      const evaluations = profile.strategies.map((strategy) => evaluate(workspace, strategy.id));
      expect(evaluations.map((evaluation) => evaluation.feasible)).toEqual([true, true, false]);
      expect(evaluations[0].outcomes).not.toEqual(evaluations[1].outcomes);
      expect(evaluations[2].outcomes.some((outcome) => !outcome.protected)).toBe(true);
      expect(() => authorize(workspace, profile.strategies[2].id, "A high benefit does not permit a protected-limit violation.")).toThrow();
      expect(workspace.revision).toBe(0);
      expect(workspace.mandates).toHaveLength(0);
      for (const strategy of profile.strategies) {
        for (const interventionId of strategy.interventionIds) {
          const intervention = profile.interventions.find((candidate) => candidate.id === interventionId)!;
          for (const dependency of intervention.dependencies) expect(strategy.interventionIds).toContain(dependency);
        }
      }
    });

    test(`${profile.name} freezes a decision, delegates within scope and retains forecast error`, () => {
      let workspace = authorize(createWorkspace(profile), profile.strategies[1].id, "Choose this portfolio after reviewing its protected conditions and resource ceilings.");
      const decision = structuredClone(workspace.decisions[0]);
      const responseClaim = profile.claims.find((claim) => claim.status === "assumed" && profile.interventions.some((intervention) => intervention.effects.some((effect) => effect.scaleClaimId === claim.id)))!;
      workspace = updateClaim(workspace, responseClaim.id, (responseClaim.min + responseClaim.value) / 2);
      expect(workspace.decisions[0]).toEqual(decision);
      workspace = acceptAll(workspace);
      const iterations = profile.interventions.length * 3;
      for (let step = 0; step < iterations; step++) {
        workspace = stepAgents(workspace);
        expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
      }
      expect(workspace.mandates.every((mandate) => mandate.status === "completed")).toBe(true);
      expect(workspace.outcomes.length).toBeGreaterThan(0);
      expect(workspace.decisions[0]).toEqual(decision);
      expect(workspace.outcomes.some((outcome) => outcome.observed !== outcome.expected)).toBe(true);
      for (const mandate of workspace.mandates) {
        const intervention = profile.interventions.find((candidate) => candidate.id === mandate.interventionId)!;
        for (const reservation of mandate.resources) expect(reservation.consumed).toBe(reservation.amount);
        for (const outcome of workspace.outcomes.filter((candidate) => candidate.mandateId === mandate.id)) {
          expect(outcome.observed).toBeCloseTo(outcome.expected * intervention.observedFactor, 6);
        }
      }
      for (const capability of profile.capabilities) {
        const consumed = workspace.mandates.flatMap((mandate) => mandate.resources).filter((resource) => resource.capabilityId === capability.id).reduce((sum, resource) => sum + resource.consumed, 0);
        expect(committed(workspace, capability.id)).toBeCloseTo(consumed, 6);
      }
    });

    test(`${profile.name} cannot borrow a parent's capability or another agent's authority`, () => {
      const deniedCapability = structuredClone(profile);
      const strategy = deniedCapability.strategies[0];
      const intervention = deniedCapability.interventions.find((candidate) => candidate.id === strategy.interventionIds[0])!;
      const capability = deniedCapability.capabilities.find((candidate) => candidate.id === intervention.resources[0].capabilityId)!;
      capability.scopeIds = [deniedCapability.scopes[0].id];
      expect(evaluate(createWorkspace(deniedCapability), strategy.id).feasible).toBe(false);
      expect(() => authorize(createWorkspace(deniedCapability), strategy.id, "Parenthood is not resource permission.")).toThrow();

      const deniedAgent = structuredClone(profile);
      const agent = deniedAgent.agents.find((candidate) => candidate.id === intervention.agentId)!;
      agent.scopeIds = [deniedAgent.scopes[0].id];
      expect(() => acceptAll(authorize(createWorkspace(deniedAgent), strategy.id, "A decision cannot invent delegated authority."))).toThrow();
    });
  }

  test("capacity shocks change the feasible choice across all three domains", () => {
    for (const profile of PROFILES) {
      const shock = profile.shocks.find((candidate) => profile.capabilities.some((capability) => capability.claimId === candidate.claimId))!;
      const changed = updateClaim(createWorkspace(profile), shock.claimId, shock.value);
      expect(evaluate(changed, profile.strategies[0].id).feasible).toBe(true);
      expect(evaluate(changed, profile.strategies[1].id).feasible).toBe(false);
      expect(changed.events[0].kind).toBe("claim");
      expect(changed.events[0].referenceId).toBe(shock.claimId);
      expect(profile.claims.find((claim) => claim.id === shock.claimId)!.value).not.toBe(shock.value);
    }
  });

  test("the worked choices expose concrete outcomes and reconciled allocations", () => {
    const h = createWorkspace(PROFILES[0]);
    const winter = evaluate(h, "h.stabilize");
    const homes = evaluate(h, "h.transition");
    expect(winter.outcomes.find((outcome) => outcome.objectiveId === "h.emissions")!.value).toBe(91);
    expect(homes.outcomes.find((outcome) => outcome.objectiveId === "h.emissions")!.value).toBe(67);
    expect(homes.outcomes.find((outcome) => outcome.objectiveId === "h.comfort")!.value).toBe(760);
    expect(homes.resources.find((resource) => resource.capabilityId === "h.money")!.required).toBe(39);
    expect(homes.resources.find((resource) => resource.capabilityId === "h.crews")!.required).toBe(11900);
    expect(homes.resources.find((resource) => resource.capabilityId === "h.consent")!.required).toBe(400);

    const m = createWorkspace(PROFILES[1]);
    const diversify = evaluate(m, "m.diversify");
    const internal = evaluate(m, "m.internal");
    expect(diversify.outcomes.find((outcome) => outcome.objectiveId === "m.service")!.value).toBe(88);
    expect(internal.outcomes.find((outcome) => outcome.objectiveId === "m.service")!.value).toBe(86);
    expect(diversify.outcomes.find((outcome) => outcome.objectiveId === "m.concentration")!.value).toBe(37);
    expect(internal.outcomes.find((outcome) => outcome.objectiveId === "m.emissions")!.value).toBe(21);
    expect(internal.resources.find((resource) => resource.capabilityId === "m.technical")!.required).toBe(13800);
    expect(internal.resources.find((resource) => resource.capabilityId === "m.money")!.required).toBe(11.8);

    const a = createWorkspace(PROFILES[2]);
    const trust = evaluate(a, "a.trust");
    const federation = evaluate(a, "a.federate");
    expect(trust.outcomes.find((outcome) => outcome.objectiveId === "a.governed")!.value).toBe(100);
    expect(federation.outcomes.find((outcome) => outcome.objectiveId === "a.governed")!.value).toBe(88);
    expect(trust.outcomes.find((outcome) => outcome.objectiveId === "a.reuse")!.value).toBe(420);
    expect(federation.outcomes.find((outcome) => outcome.objectiveId === "a.reuse")!.value).toBe(840);
    expect(federation.outcomes.find((outcome) => outcome.objectiveId === "a.maintenance")!.value).toBe(22);
    expect(federation.resources.find((resource) => resource.capabilityId === "a.volunteers")!.required).toBe(1870);
  });

  test("lead-time shocks propagate through dependencies and withhold late benefits", () => {
    for (const profile of PROFILES) {
      const shock = profile.shocks.find((candidate) => profile.interventions.some((intervention) => intervention.leadClaimId === candidate.claimId))!;
      const initial = createWorkspace(profile);
      const changed = updateClaim(initial, shock.claimId, shock.value);
      const pairs = profile.strategies.slice(0, 2).map((strategy) => ({ before: evaluate(initial, strategy.id), after: evaluate(changed, strategy.id) }));
      const affected = pairs.find((pair) => pair.after.schedule.some((entry) => entry.finish > profile.horizonMonths))!;
      expect(affected).toBeDefined();
      expect(affected.after.outcomes).not.toEqual(affected.before.outcomes);
      for (const entry of affected.after.schedule.filter((entry) => entry.finish > profile.horizonMonths)) {
        const intervention = profile.interventions.find((candidate) => candidate.id === entry.interventionId)!;
        expect(intervention.effects.length).toBeGreaterThan(0);
      }
      expect(initial.claimValues[shock.claimId]).not.toBe(changed.claimValues[shock.claimId]);
    }
  });

  test("the custom seed is independent, editable and smaller without changing the primitives", () => {
    const first = custom();
    const second = makeProfile({ name: "  Watershed circle  ", objective: "  Restore accessible river habitat  ", domain: "Ecology", id: "watershed" });
    expect(validateProfile(first)).toEqual(first);
    expect(validateProfile(second)).toEqual(second);
    expect(second.name).toBe("Watershed circle");
    expect(second.question).toBe("Restore accessible river habitat");
    expect(second.objectives[0].label).toBe("Restore accessible river habitat");
    expect(second.subtitle).toBe("Ecology");
    expect(first.icon).toBe("custom");
    expect(first.interventions).toHaveLength(3);
    expect(first.claims.every((claim) => claim.status === "assumed")).toBe(true);
    second.claims[0].value = 60;
    second.scopes[0].name = "Edited independently";
    expect(first.claims[0].value).toBe(120);
    expect(first.scopes[0].name).toBe(first.name);
    expect(PROFILES.every((profile) => profile.name !== second.scopes[0].name)).toBe(true);
    expect(makeProfile({ name: "A", objective: "B" }).id).not.toBe(makeProfile({ name: "A", objective: "B" }).id);
  });

  test("optional outcome configuration preserves the original defaults and capacity", () => {
    const profile = custom();
    expect(profile.objectives[0]).toMatchObject({ unit: "units", baseline: 20, target: 50, direction: "increase" });
    expect(profile.interventions.map((intervention) => intervention.effects[0].amount)).toEqual([10, 20, 40]);
    expect(profile.capabilities.map((capability) => capability.amount)).toEqual([120, 12]);
    expect(profile.horizonMonths).toBe(6);
    expect(profile.claims[2].source.excerpt).toContain("pilot changes the outcome by 10 units");
    expect(profile.claims[2].source.excerpt).toContain("extension by 20 units");
    expect(validateProfile(profile)).toEqual(profile);
  });

  for (const config of [
    { name: "Watershed recovery", objective: "Restore usable habitat", unit: "  hectares  ", baseline: 10, target: 100, direction: "increase", pilot: 30, extension: 60, observed: 79 },
    { name: "Emission reduction", objective: "Reduce annual emissions", unit: "kt CO₂e", baseline: 120, target: 30, direction: "decrease", pilot: -30, extension: -60, observed: 51 },
  ]) {
    test(`${config.name} retains a meaningful ${config.direction} outcome through authorization, simulation and replay`, () => {
      const profile = makeProfile(config);
      expect(validateProfile(profile)).toEqual(profile);
      const objective = profile.objectives[0];
      expect(objective).toMatchObject({ unit: config.unit.trim(), baseline: config.baseline, target: config.target, direction: config.direction });
      expect(profile.interventions[0].effects[0].amount).toBe(config.pilot);
      expect(profile.interventions[1].effects[0].amount).toBe(config.extension);
      expect(objective.description).toContain(`${config.pilot} ${config.unit.trim()}`);
      expect(profile.claims[2].source.excerpt).toContain(`${config.extension} ${config.unit.trim()}`);
      let workspace = createWorkspace(profile);
      const projected = evaluate(workspace, "c.extend");
      expect(projected.feasible).toBe(true);
      expect(projected.outcomes.find((outcome) => outcome.objectiveId === "c.outcome")!.value).toBe(config.target);
      expect(evaluate(workspace, "c.short").feasible).toBe(false);
      workspace = acceptAll(authorize(workspace, "c.extend", "Reserve a measurable pilot and dependent extension within the protected limit."));
      for (let step = 0; step < 6; step++) workspace = stepAgents(workspace);
      expect(workspace.mandates.every((mandate) => mandate.status === "completed")).toBe(true);
      expect(workspace.outcomes.every((outcome) => config.direction === "increase" ? outcome.observed > 0 : outcome.observed < 0)).toBe(true);
      expect(config.baseline + workspace.outcomes.reduce((sum, outcome) => sum + outcome.observed, 0)).toBe(config.observed);
      expect(workspace.decisions[0].evaluation.outcomes[0].value).toBe(config.target);
      expect(workspace.profile.objectives[0].unit).toBe(config.unit.trim());
      expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
    });
  }

  test("each optional outcome field can be supplied independently", () => {
    const input = { name: "Test", objective: "Change a declared outcome" };
    expect(makeProfile({ ...input, unit: "cases" }).objectives[0]).toMatchObject({ unit: "cases", baseline: 20, target: 50 });
    expect(makeProfile({ ...input, baseline: 100 }).objectives[0]).toMatchObject({ baseline: 100, target: 50, direction: "decrease" });
    expect(makeProfile({ ...input, target: 0 }).objectives[0]).toMatchObject({ baseline: 20, target: 0, direction: "decrease" });
    const spanningZero = makeProfile({ ...input, baseline: -20, target: 10, unit: "net units" });
    expect(validateProfile(spanningZero)).toEqual(spanningZero);
    expect(evaluate(createWorkspace(spanningZero), "c.extend").outcomes[0].value).toBe(10);
  });

  test("invalid outcome configuration fails explicitly before a profile can be saved", () => {
    const input = { name: "Test", objective: "Change a declared outcome" };
    for (const invalid of [NaN, Infinity, -Infinity, 1e9 + 1, -1e9 - 1]) {
      expect(() => makeProfile({ ...input, baseline: invalid })).toThrow("Baseline and target must be finite numbers");
      expect(() => makeProfile({ ...input, target: invalid })).toThrow("Baseline and target must be finite numbers");
    }
    expect(() => makeProfile({ ...input, baseline: 20, target: 20 })).toThrow("Target must differ from baseline");
    expect(() => makeProfile({ ...input, target: 20 })).toThrow("Target must differ from baseline");
    for (const unit of ["", "   ", "\n\t", "a".repeat(41)]) {
      expect(() => makeProfile({ ...input, unit })).toThrow("Unit must contain 1–40 characters");
    }
    const edges = makeProfile({ ...input, baseline: -1e9, target: 1e9, unit: "u".repeat(40) });
    expect(validateProfile(edges)).toEqual(edges);
    expect(evaluate(createWorkspace(edges), "c.extend").outcomes[0].value).toBeCloseTo(1e9);
  });
});
