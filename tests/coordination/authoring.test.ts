import { describe, expect, test } from "bun:test";
import {
  acceptAll, addStrategy, authorize, committed, createWorkspace, evaluate,
  previewStrategy, stepAgents, strategySelection, updateClaim, validateWorkspace,
} from "../../apps/web/lib/coordination/core";
import { PROFILES, makeProfile } from "../../apps/web/lib/coordination/profiles";
import { workedExample } from "../../apps/web/lib/coordination/examples";
import { exportLibrary, importLibrary } from "../../apps/web/lib/coordination/storage";
import type { Library, Workspace } from "../../apps/web/lib/coordination/types";

const fresh = () => createWorkspace(makeProfile({ name: "Watershed recovery", objective: "Restore river habitat", id: "authoring-world" }));
const checked = (world: Workspace) => { expect(validateWorkspace(JSON.parse(JSON.stringify(world)))).toEqual(world); return world; };
const library = (world: Workspace): Library => ({ version: 2, activeId: world.profile.id, onboardingDone: true, workspaces: [world] });
function complete(world: Workspace) {
  for (let i = 0; i < 12 && world.mandates.some((mandate) => mandate.status !== "completed"); i++) world = checked(stepAgents(world));
  expect(world.mandates.every((mandate) => mandate.status === "completed")).toBe(true);
  return world;
}

describe("strategy authoring", () => {
  test("selection closes transitive prerequisites once in catalogue order and rejects unknown IDs and cycles", () => {
    const profile = fresh().profile;
    profile.interventions[2].dependencies = ["c.expand"];
    expect(strategySelection(profile, ["c.shortcut", "c.expand", "c.shortcut"])).toEqual(["c.pilot", "c.expand", "c.shortcut"]);
    expect(strategySelection(profile, [])).toEqual([]);
    expect(() => strategySelection(profile, ["absent"])).toThrow("Unknown intervention");
    profile.interventions[0].dependencies = ["c.shortcut"];
    expect(() => strategySelection(profile, ["c.shortcut"])).toThrow("cycle");
  });

  test("an empty preview shows baseline consequences without granting execution authority", () => {
    const world = fresh(); const original = structuredClone(world);
    const preview = previewStrategy(world, []);
    expect(preview.schedule).toEqual([]);
    expect(preview.resources.every((resource) => resource.required === 0)).toBe(true);
    expect(preview.outcomes.map((outcome) => outcome.value)).toEqual(world.profile.objectives.map((objective) => objective.baseline));
    expect(world).toEqual(original);
    const reservedId = structuredClone(world); reservedId.profile.strategies[0].id = "draft-preview";
    expect(previewStrategy(reservedId, ["c.expand"]).schedule.map((entry) => entry.interventionId)).toEqual(["c.pilot", "c.expand"]);
  });

  test("saved drafts are immutable, append-only and distinct from authorization, even when infeasible", () => {
    const world = fresh(); const original = structuredClone(world);
    let next = checked(addStrategy(world, { name: "  Explicit test  ", thesis: "  Preserve the staged dependency.  ", interventionIds: ["c.expand"] }));
    const saved = next.profile.strategies.at(-1)!;
    expect(saved).toEqual({ id: "strategy-1-4", name: "Explicit test", thesis: "Preserve the staged dependency.", interventionIds: ["c.pilot", "c.expand"], authoredRevision: 1 });
    expect(next.profile.strategies.slice(0, -1)).toEqual(original.profile.strategies);
    expect(next.events[0]).toMatchObject({ kind: "strategy", referenceId: saved.id, strategy: saved });
    expect(next.decisions).toEqual([]); expect(next.mandates).toEqual([]);
    expect(world).toEqual(original);
    next = checked(addStrategy(next, { name: "Expose the conflict", thesis: "Keep the failed alternative visible.", interventionIds: ["c.shortcut"] }));
    const unsafe = next.profile.strategies.at(-1)!;
    expect(evaluate(next, unsafe.id).feasible).toBe(false);
    expect(() => authorize(next, unsafe.id, "Cannot override a protection.")).toThrow("protected condition");
  });

  test("authoring rejects stale writes, malformed inputs and bounded catalogue overflow without changing state", () => {
    const world = fresh(); const original = structuredClone(world);
    const draft = { name: "New course", thesis: "Start with evidence.", interventionIds: ["c.pilot"] };
    const next = addStrategy(world, draft);
    expect(() => addStrategy(next, draft, 0)).toThrow("changed");
    for (const invalid of [
      { ...draft, name: " " }, { ...draft, name: "x".repeat(81) },
      { ...draft, thesis: "" }, { ...draft, thesis: "x".repeat(1001) },
      { ...draft, interventionIds: [] }, { ...draft, interventionIds: ["unknown"] },
      { ...draft, interventionIds: "c.pilot" }, { ...draft, authority: "Invented" },
    ]) expect(() => addStrategy(world, invalid as typeof draft)).toThrow();
    expect(world).toEqual(original);
    const full = structuredClone(world.profile);
    full.strategies = Array.from({ length: 200 }, (_, index) => ({ ...draft, id: `catalogue-${index}` }));
    expect(() => addStrategy(createWorkspace(full), draft)).toThrow("at most 200");
  });

  test("generated strategy identities avoid collisions with the complete primitive catalogue", () => {
    const profile = fresh().profile;
    profile.shocks[0].id = "strategy-1-4";
    const next = checked(addStrategy(createWorkspace(profile), { name: "Independent identity", thesis: "Keep source identities distinct.", interventionIds: ["c.pilot"] }));
    expect(next.profile.strategies.at(-1)!.id).toBe("strategy-1-5");
  });

  test("new drafts cannot alter existing decisions, mandate ceilings or source values", () => {
    let world = authorize(fresh(), "c.learn", "Preserve the first bounded test.");
    const before = structuredClone(world);
    world = checked(addStrategy(world, { name: "Another course", thesis: "Compare without reauthorizing the original.", interventionIds: ["c.expand"] }));
    expect(world.decisions).toEqual(before.decisions);
    expect(world.mandates).toEqual(before.mandates);
    expect(world.claimValues).toEqual(before.claimValues);
    expect(world.profile.strategies.slice(0, -1)).toEqual(before.profile.strategies);
    expect(evaluate(world, world.profile.strategies.at(-1)!.id).violations.join(" ")).toContain("already has a mandate");
  });

  for (const profile of PROFILES) {
    test(`${profile.name} previews, saves, authorizes and reopens through the same kernel`, async () => {
      let world = createWorkspace(profile);
      const course = profile.strategies.find((candidate) => evaluate(world, candidate.id).feasible)!;
      const preview = previewStrategy(world, course.interventionIds);
      const expected = evaluate(world, course.id);
      expect({ ...preview, strategyId: expected.strategyId }).toEqual(expected);
      world = checked(addStrategy(world, { name: "Locally composed course", thesis: "Retain accountable limits and test the same model.", interventionIds: course.interventionIds }));
      const saved = world.profile.strategies.at(-1)!;
      world = checked(authorize(world, saved.id, "Act within the explicit portfolio and resource envelope."));
      world = checked(acceptAll(world)); world = complete(world);
      expect(world.outcomes.length).toBeGreaterThan(0);
      expect(await importLibrary(await exportLibrary(library(world)))).toEqual(library(world));
    });
  }

  test("completed prerequisites are reused without spending their resources or applying their effects twice", async () => {
    let world = complete(acceptAll(authorize(fresh(), "c.learn", "Complete the initial pilot.")));
    const pilot = structuredClone(world.mandates[0]); const priorDecision = structuredClone(world.decisions[0]);
    expect(strategySelection(world.profile, ["c.expand"])).toEqual(["c.pilot", "c.expand"]);
    expect(strategySelection(world, ["c.expand"])).toEqual(["c.expand"]);
    const preview = previewStrategy(world, ["c.expand"]);
    expect(preview.feasible).toBe(true);
    expect(preview.schedule).toEqual([{ interventionId: "c.expand", start: 0, finish: 3 }]);
    expect(preview.resources.find((resource) => resource.capabilityId === "c.hours")?.required).toBe(70);
    expect(preview.outcomes.find((outcome) => outcome.objectiveId === "c.outcome")?.value).toBe(48);
    world = checked(addStrategy(world, { name: "Extend after learning", thesis: "Reuse the completed prerequisite and reserve only the new work.", interventionIds: ["c.expand"] }));
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "The pilot is complete; authorize the distinct extension."));
    expect(world.mandates).toHaveLength(2);
    expect(world.mandates[1].dependencies).toEqual([pilot.id]);
    expect(world.decisions[1].snapshot?.completedInterventionIds).toEqual(["c.pilot"]);
    world = checked(acceptAll(world)); expect(committed(world, "c.hours")).toBe(110);
    world = complete(world);
    expect(world.mandates[0]).toEqual(pilot); expect(world.decisions[0]).toEqual(priorDecision);
    expect(world.outcomes.map((outcome) => outcome.observed)).toEqual([8, 15]);
    expect(world.outcomes.filter((outcome) => outcome.mandateId === pilot.id)).toHaveLength(1);
    expect(committed(world, "c.hours")).toBe(110);
    expect(await importLibrary(await exportLibrary(library(world)))).toEqual(library(world));
  });

  test("running work is not a completed prerequisite, and explicit repeats remain infeasible", () => {
    let world = checked(stepAgents(acceptAll(authorize(fresh(), "c.learn", "Start the pilot."))));
    expect(strategySelection(world, ["c.expand"])).toEqual(["c.pilot", "c.expand"]);
    expect(previewStrategy(world, ["c.expand"]).violations.join(" ")).toContain("already has a mandate");
    world = complete(world);
    expect(strategySelection(world, ["c.pilot", "c.expand"])).toEqual(["c.pilot", "c.expand"]);
    expect(previewStrategy(world, ["c.pilot", "c.expand"]).feasible).toBe(false);
    const drafted = checked(addStrategy(world, { name: "Explicit repeat", thesis: "Retain the refusal rather than silently dropping an explicit choice.", interventionIds: ["c.pilot", "c.expand"] }));
    expect(() => authorize(drafted, drafted.profile.strategies.at(-1)!.id, "Do not repeat completed work.")).toThrow("already has a mandate");
  });

  test("the worked Meridian case can continue with an internal cell after the completed supplier audit", () => {
    let world = workedExample(PROFILES.find((profile) => profile.id === "meridian")!);
    const audit = structuredClone(world.mandates.find((mandate) => mandate.interventionId === "m.audit")!);
    const beforeOutcomes = structuredClone(world.outcomes);
    world = updateClaim(world, world.profile.capabilities.find((capability) => capability.id === "m.technical")!.claimId!, 16000);
    const preview = previewStrategy(world, ["m.cell"]);
    expect(preview.feasible).toBe(true);
    expect(preview.schedule).toEqual([{ interventionId: "m.cell", start: 0, finish: 4 }]);
    expect(preview.resources.find((resource) => resource.capabilityId === "m.technical")?.required).toBe(6500);
    world = checked(addStrategy(world, { name: "Internal route", thesis: "Build from the completed audit after confirming the engineering allocation.", interventionIds: ["m.cell"] }));
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "The audit is complete and capacity is now confirmed."));
    expect(world.mandates.at(-1)?.dependencies).toEqual([audit.id]);
    world = complete(acceptAll(world));
    expect(world.mandates.find((mandate) => mandate.id === audit.id)).toEqual(audit);
    expect(world.outcomes.slice(0, beforeOutcomes.length)).toEqual(beforeOutcomes);
    expect(world.outcomes.filter((outcome) => outcome.mandateId === audit.id)).toEqual(beforeOutcomes.filter((outcome) => outcome.mandateId === audit.id));
    expect(committed(world, "m.technical")).toBe(15500);
  });

  test("imports reject missing, changed, reordered or premature strategy authoring traces", () => {
    let world = addStrategy(fresh(), { name: "First authored course", thesis: "Begin with a bounded test.", interventionIds: ["c.pilot"] });
    world = addStrategy(world, { name: "Dependent authored course", thesis: "Retain its dependency closure.", interventionIds: ["c.expand"] });
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "Freeze the selected authored portfolio."));
    const firstId = world.profile.strategies[3].id;
    for (const damage of [
      (value: Workspace) => { value.events.splice(0, 1); },
      (value: Workspace) => { value.events[0].strategy!.thesis = "Changed receipt"; },
      (value: Workspace) => { value.profile.strategies[3].name = "Changed course"; },
      (value: Workspace) => { value.profile.strategies[4].interventionIds = ["c.expand"]; },
      (value: Workspace) => { value.events[0].strategy!.authoredRevision = 2; },
      (value: Workspace) => { value.events[0].scopeId = "c.work"; },
      (value: Workspace) => { value.events[0].referenceId = value.profile.strategies[4].id; },
      (value: Workspace) => { value.events[0].createdAt = value.events.at(-1)!.createdAt; },
      (value: Workspace) => { value.events[1].strategy = undefined; },
      (value: Workspace) => { value.profile.strategies.reverse(); },
      (value: Workspace) => { value.events[0].strategy!.id = firstId + ".forged"; },
    ]) { const damaged = structuredClone(world); damage(damaged); expect(() => validateWorkspace(damaged)).toThrow(); }
  });

  test("a completed-prerequisite snapshot cannot invent completion or hide reused authority", () => {
    let world = complete(acceptAll(authorize(fresh(), "c.learn", "Complete the pilot.")));
    world = addStrategy(world, { name: "Continuation", thesis: "Reserve the extension only.", interventionIds: ["c.expand"] });
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "Continue from observed completion."));
    for (const damage of [
      (value: Workspace) => { delete value.decisions[1].snapshot!.completedInterventionIds; },
      (value: Workspace) => { value.decisions[1].snapshot!.completedInterventionIds = ["c.shortcut"]; },
      (value: Workspace) => { value.mandates[1].dependencies = []; },
      (value: Workspace) => { value.decisions[0].snapshot!.completedInterventionIds = ["c.pilot"]; },
    ]) { const damaged = structuredClone(world); damage(damaged); expect(() => validateWorkspace(damaged)).toThrow(); }
  });

  test("fresh independent worlds keep the authored catalogue without retaining the previous world's command clock", () => {
    const original = addStrategy(fresh(), { name: "Future option", thesis: "Retain a complete dependency-closed comparison.", interventionIds: ["c.expand"] });
    const fork = checked(createWorkspace({ ...original.profile, id: "independent-world", name: "Independent world" }));
    expect(fork.profile.strategies.at(-1)?.authoredRevision).toBeUndefined();
    expect(original.profile.strategies.at(-1)?.authoredRevision).toBe(1);
    expect(fork.events).toEqual([]); expect(fork.revision).toBe(0);
    const next = checked(addStrategy(fork, { name: "Another option", thesis: "Avoid the retained strategy's original identity.", interventionIds: ["c.pilot"] }));
    expect(new Set(next.profile.strategies.map((strategy) => strategy.id)).size).toBe(next.profile.strategies.length);
  });

  test("pre-authoring version-two exports still reopen with their original frozen shape", async () => {
    const serialized = await Bun.file(new URL("../../examples/coordination/worked-worlds.json", import.meta.url)).text();
    const existing = await importLibrary(serialized);
    expect(existing.workspaces).toHaveLength(3);
    const legacy = structuredClone(existing);
    legacy.workspaces.forEach((world) => world.decisions.forEach((decision) => { delete decision.snapshot!.completedInterventionIds; }));
    const restored = await importLibrary(await exportLibrary(legacy));
    expect(restored).toEqual(legacy);
    expect(restored.workspaces.every((world) => world.decisions[0].snapshot?.completedInterventionIds === undefined)).toBe(true);
    const changed = updateClaim(restored.workspaces[0], restored.workspaces[0].profile.claims[0].id, restored.workspaces[0].profile.claims[0].value);
    checked(changed);
  });
});
