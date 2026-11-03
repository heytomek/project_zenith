import { describe, expect, test } from "bun:test";
import {
  acceptAll, acceptMandate, addStrategy, authorize, committed, createWorkspace,
  currentClaimSource, executionWindow, recordEvidence, respondToDecision,
  stepAgents, updateClaim, validateWorkspace,
} from "../../apps/web/lib/coordination/core";
import { PROFILES } from "../../apps/web/lib/coordination/profiles";
import { exportLibrary, importLibrary } from "../../apps/web/lib/coordination/storage";
import type { EvidenceSource, Library, Workspace } from "../../apps/web/lib/coordination/types";

const profile = PROFILES.find((candidate) => candidate.id === "meridian")!;
const fresh = () => createWorkspace(profile);
const proposed = () => authorize(fresh(), "m.diversify", "Preserve the bounded supplier and training course.");
const approved = () => acceptAll(proposed());
const source: EvidenceSource = { title: "Laboratory slot withdrawal · synthetic", author: "Owen Shah", date: "2027-04-13", excerpt: "The provisional slot has been withdrawn; the next available qualification window takes twelve months after the audit." };
const checked = (world: Workspace) => { expect(validateWorkspace(JSON.parse(JSON.stringify(world)))).toEqual(world); return world; };
const qualify = (world: Workspace) => world.mandates.find((mandate) => mandate.interventionId === "m.qualify")!;
const library = (world: Workspace): Library => ({ version: 2, activeId: world.profile.id, onboardingDone: true, workspaces: [world] });
function advance(world: Workspace, count = 3) { for (let n = 0; n < count; n++) world = checked(stepAgents(world)); return world; }

describe("reconsideration and current evidence", () => {
  test("a lost qualification window blocks only its affected work and cannot manufacture its frozen benefit", () => {
    let world = checked(approved());
    const frozen = structuredClone(world.decisions[0]); const ceilings = world.mandates.map((mandate) => structuredClone(mandate.resources));
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 12, source }));
    expect(executionWindow(world, qualify(world).id)).toEqual({ finish: 13, invalidated: true, claimIds: ["m.lead-claim"] });
    world = advance(world, 8);
    expect(qualify(world)).toMatchObject({ status: "blocked", progress: 0, finishMonths: 4 });
    expect(qualify(world).reason).toContain("decision horizon");
    expect(world.mandates.filter((mandate) => mandate.interventionId !== "m.qualify").every((mandate) => mandate.status === "completed")).toBe(true);
    expect(world.outcomes.some((outcome) => outcome.mandateId === qualify(world).id)).toBe(false);
    expect(world.decisions[0]).toEqual(frozen);
    expect(world.mandates.map((mandate) => mandate.resources.map(({ capabilityId, amount }) => ({ capabilityId, amount })))).toEqual(ceilings.map((resources) => resources.map(({ capabilityId, amount }) => ({ capabilityId, amount }))));
    expect(qualify(world).resources.every((resource) => resource.consumed === 0)).toBe(true);
  });

  test("corrected evidence resumes the same bounded mandate without revising prior authority", () => {
    let world = checked(recordEvidence(approved(), { claimId: "m.lead-claim", value: 12, source }));
    world = advance(world, 3); const priorOutcomes = structuredClone(world.outcomes); const frozen = structuredClone(world.decisions[0]);
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 3, source: { ...source, title: "Replacement laboratory slot confirmed", excerpt: "The replacement laboratory has confirmed the original three-month window." } }));
    expect(executionWindow(world, qualify(world).id)).toMatchObject({ finish: 4, invalidated: false });
    world = advance(world, 3);
    expect(qualify(world).status).toBe("completed"); expect(world.outcomes.slice(0, priorOutcomes.length)).toEqual(priorOutcomes);
    expect(world.outcomes.filter((outcome) => outcome.mandateId === qualify(world).id).map((outcome) => outcome.observed)).toEqual([7, -15.4]);
    expect(world.decisions[0]).toEqual(frozen);
  });

  test("invalidated proposals cannot be accepted partially by an atomic portfolio acceptance", () => {
    let world = checked(recordEvidence(proposed(), { claimId: "m.lead-claim", value: 12, source })); const before = structuredClone(world);
    expect(() => acceptAll(world)).toThrow("decision horizon"); expect(world).toEqual(before);
    expect(() => acceptMandate(world, qualify(world).id)).toThrow("decision horizon");
    const audit = world.mandates.find((mandate) => mandate.interventionId === "m.audit")!;
    world = checked(acceptMandate(world, audit.id)); expect(world.mandates.find((mandate) => mandate.id === audit.id)!.status).toBe("accepted");
  });

  test("a deliberately authorized late course remains executable without inventing within-horizon effects", () => {
    let world = checked(acceptAll(authorize(updateClaim(fresh(), "m.lead-claim", 12), "m.diversify", "Authorize only the explicitly modeled within-horizon contribution.")));
    expect(qualify(world).expectedEffects).toEqual([]); expect(executionWindow(world, qualify(world).id).invalidated).toBe(false);
    world = advance(world, 7); expect(qualify(world).status).toBe("completed");
    expect(world.outcomes.some((outcome) => outcome.mandateId === qualify(world).id)).toBe(false);
  });

  test("completed same-course prerequisites retain frozen completion while command ticks never become months", () => {
    const input = structuredClone(profile); input.interventions.find((intervention) => intervention.id === "m.audit")!.leadClaimId = "m.lead-claim";
    let world = checked(acceptAll(authorize(createWorkspace(input), "m.diversify", "Use a six-month modeled sequence.")));
    world = advance(world, 3); expect(world.mandates[0].status).toBe("completed");
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 9, source }));
    expect(executionWindow(world, qualify(world).id)).toEqual({ finish: 12, invalidated: false, claimIds: ["m.lead-claim"] });
    for (let n = 0; n < 5; n++) world = checked(respondToDecision(world, world.decisions[0].id, { action: "investigate", rationale: "Retain the question while gathering a confirmed slot." }));
    expect(executionWindow(world, qualify(world).id).finish).toBe(12);
  });

  test("completed prerequisites from another authorization start a distinct course at zero", () => {
    let world = advance(approved(), 7);
    world = checked(addStrategy(world, { name: "Independent internal capacity", thesis: "Use the completed audit without repeating it.", interventionIds: ["m.cell"] }));
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "The completed audit supports a new internal route."));
    const cell = world.mandates.find((mandate) => mandate.interventionId === "m.cell")!;
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 12, source }));
    expect(executionWindow(world, cell.id)).toEqual({ finish: 4, invalidated: false, claimIds: [] });
  });

  test("provenance revisions preserve starting sources and can record confirmation without a changed number", async () => {
    let world = fresh(); const original = structuredClone(world.profile.claims.find((claim) => claim.id === "m.lead-claim")!.source);
    expect(currentClaimSource(world, "m.lead-claim")).toEqual(original);
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 3, source }));
    expect(world.revision).toBe(1); expect(world.events[0].change).toEqual({ before: 3, value: 3 });
    expect(currentClaimSource(world, "m.lead-claim")).toEqual(source);
    const read = currentClaimSource(world, "m.lead-claim"); read.excerpt = "Mutation outside the kernel.";
    expect(currentClaimSource(world, "m.lead-claim")).toEqual(source);
    world = checked(recordEvidence(world, { claimId: "m.lead-claim", value: 12, source: { ...source, author: "Laboratory liaison" } }));
    expect(world.profile.claims.find((claim) => claim.id === "m.lead-claim")!.source).toEqual(original);
    expect(currentClaimSource(world, "m.lead-claim").author).toBe("Laboratory liaison");
    expect(await importLibrary(await exportLibrary(library(world)))).toEqual(library(world));
  });

  test("evidence rejects stale, malformed, out-of-range and unsupported records atomically", () => {
    const world = fresh(), input = { claimId: "m.lead-claim", value: 12, source };
    for (const invalid of [
      { ...input, value: Infinity }, { ...input, value: 19 }, { ...input, claimId: "missing" }, { ...input, identity: "extra" },
      { ...input, source: { ...source, date: "2027-02-29" } }, { ...input, source: { ...source, author: " " } },
      { ...input, source: { ...source, title: "x".repeat(161) } }, { ...input, source: { ...source, excerpt: "x".repeat(4001) } },
      { ...input, source: { ...source, unvalidatedStatus: "true" } },
    ]) expect(() => recordEvidence(world, invalid as typeof input)).toThrow();
    expect(world).toEqual(fresh()); const next = recordEvidence(world, input);
    expect(() => recordEvidence(next, input, 0)).toThrow("changed");
  });

  test("retain and investigate record judgment without clearing the source condition or expanding authority", () => {
    let world = checked(recordEvidence(approved(), { claimId: "m.lead-claim", value: 12, source }));
    const frozen = structuredClone(world.decisions); const mandates = structuredClone(world.mandates);
    for (const action of ["retain", "investigate"] as const) {
      const revision = world.revision;
      world = checked(respondToDecision(world, world.decisions[0].id, { action, rationale: "Gather a confirmed alternative while retaining the current limits." }));
      expect(world.events.at(-1)!.review).toEqual({ decisionId: world.decisions[0].id, action, rationale: "Gather a confirmed alternative while retaining the current limits.", reviewedRevision: revision, authority: world.decisions[0].authority });
      expect(world.mandates).toEqual(mandates); expect(world.decisions).toEqual(frozen);
      expect(executionWindow(world, qualify(world).id).invalidated).toBe(true);
    }
    world = checked(stepAgents(world)); expect(qualify(world).progress).toBe(0);
    expect(() => respondToDecision(world, world.decisions[0].id, { action: "retain", rationale: "Stale" }, 0)).toThrow("changed");
    expect(() => respondToDecision(world, world.decisions[0].id, { action: "retain", rationale: " " })).toThrow("nonempty");
  });

  test("stopping one course atomically withdraws proposals and requests acknowledgement without touching another course", async () => {
    let world = proposed(); const decisionId = world.decisions[0].id;
    world = checked(acceptMandate(world, world.mandates[0].id)); world = checked(stepAgents(world));
    world = checked(addStrategy(world, { name: "Separate efficiency course", thesis: "Keep independent work outside this stop.", interventionIds: ["m.efficiency"] }));
    world = checked(authorize(world, world.profile.strategies.at(-1)!.id, "Approve a separate bounded improvement."));
    world = checked(acceptMandate(world, world.mandates.at(-1)!.id));
    const other = structuredClone(world.mandates.at(-1)); const frozen = structuredClone(world.decisions);
    const consumed = world.mandates[0].resources.map((resource) => resource.consumed); const before = world.revision;
    world = checked(respondToDecision(world, decisionId, { action: "stop", rationale: "Withdraw only this course pending a revised recovery commitment." }));
    expect(world.revision).toBe(before + 1); expect(world.mandates.slice(0, 3).map((mandate) => mandate.status)).toEqual(["stopping", "revoked", "revoked"]);
    expect(world.mandates.at(-1)).toEqual(other); expect(world.decisions).toEqual(frozen);
    expect(world.events.filter((event) => event.createdAt === world.events.at(-1)!.createdAt).map((event) => event.kind)).toEqual(["review", "revoked", "revoked", "revoked"]);
    expect(world.mandates[0].resources.map((resource) => resource.consumed)).toEqual(consumed);
    expect(committed(world, "m.technical")).toBe(3800);
    world = checked(stepAgents(world)); expect(world.mandates[0].status).toBe("revoked");
    expect(world.mandates[0].resources.map((resource) => resource.consumed)).toEqual(consumed);
    expect(world.mandates.at(-1)!.status).toBe("running");
    expect(await importLibrary(await exportLibrary(library(world)))).toEqual(library(world));
  });

  test("response imports reject altered authority, reviewed revision and incomplete atomic stop groups", () => {
    const world = respondToDecision(approved(), proposed().decisions[0].id, { action: "stop", rationale: "Stop the original course." });
    const review = world.events.findIndex((event) => event.kind === "review");
    for (const damage of [
      (copy: Workspace) => { copy.events[review].review!.authority = "Invented authority"; },
      (copy: Workspace) => { copy.events[review].review!.reviewedRevision--; },
      (copy: Workspace) => { copy.events[review].review!.action = "retain"; },
      (copy: Workspace) => { copy.events[review].review!.rationale = "Rewritten judgment"; },
      (copy: Workspace) => { copy.events.splice(review + 1, 1); },
      (copy: Workspace) => { delete copy.events[review].executionPolicy; },
    ]) { const forged = structuredClone(world); damage(forged); expect(() => validateWorkspace(forged)).toThrow(); }
    const omitted = structuredClone(world); omitted.events.splice(review, 1);
    expect(() => validateWorkspace(omitted)).toThrow();
  });

  test("a forged new-policy continuation cannot complete outside its revised decision window", () => {
    let world = approved(); world = advance(world, 7);
    const forged = structuredClone(world);
    const sourceTick = 3; const sourceEvent = recordEvidence(approved(), { claimId: "m.lead-claim", value: 12, source }).events.at(-1)!;
    // Move the valid completion trace one command later, then insert the source
    // revision before work. Frozen effects and resource totals still look valid.
    for (const [index, event] of forged.events.entries()) {
      if (index < 4) continue;
      event.createdAt = new Date(Date.parse(event.createdAt) + 3_600_000).toISOString();
      const tick = (Date.parse(event.createdAt) - Date.parse(`${profile.date}T00:00:00.000Z`)) / 3_600_000;
      event.id = `event-${tick}-${index + 2}`;
    }
    for (const outcome of forged.outcomes) outcome.createdAt = new Date(Date.parse(outcome.createdAt) + 3_600_000).toISOString();
    forged.events.splice(4, 0, sourceEvent); forged.claimValues["m.lead-claim"] = 12; forged.tick++; forged.revision++;
    expect(sourceEvent.createdAt).toBe(`${profile.date}T0${sourceTick}:00:00.000Z`);
    expect(() => validateWorkspace(forged)).toThrow("decision window");
    delete forged.decisions[0].snapshot!.executionPolicy;
    for (const event of forged.events) if (!event.evidence) delete event.executionPolicy;
    expect(() => validateWorkspace(forged)).toThrow("decision window");
  });

  test("legacy prefixes reopen unchanged while new evidence activates repaired live and replay behavior", async () => {
    let legacy = proposed();
    delete legacy.decisions[0].snapshot!.executionPolicy;
    legacy.events.forEach((event) => { delete event.executionPolicy; });
    legacy = checked(legacy); const prefix = structuredClone(legacy.events);
    expect(await importLibrary(await exportLibrary(library(legacy)))).toEqual(library(legacy));
    const revised = checked(recordEvidence(legacy, { claimId: "m.lead-claim", value: 12, source }));
    expect(revised.events.slice(0, prefix.length)).toEqual(prefix);
    expect(() => acceptAll(revised)).toThrow("decision horizon");
    expect(revised.events.at(-1)!.executionPolicy).toBe("source-window-v1");
  });

  test("earlier authored catalogues replay without retroactively adding execution-policy fields", async () => {
    let legacy = addStrategy(fresh(), { name: "Earlier authored course", thesis: "Retain the prior format's exact receipt.", interventionIds: ["m.audit", "m.qualify", "m.training"] });
    legacy = advance(acceptAll(authorize(legacy, legacy.profile.strategies.at(-1)!.id, "Complete the earlier authored course.")), 7);
    legacy.decisions.forEach((decision) => { delete decision.snapshot!.executionPolicy; });
    legacy.events.forEach((event) => { delete event.executionPolicy; });
    const before = structuredClone(legacy);
    expect(validateWorkspace(legacy)).toEqual(before);
    expect(await importLibrary(await exportLibrary(library(legacy)))).toEqual(library(before));
  });

  test("legacy simulator history remains historical while new receipts cannot use its relaxed window semantics", () => {
    let historical = advance(approved(), 7);
    const originalEvents = structuredClone(historical.events);
    for (const [index, event] of historical.events.entries()) {
      if (index < 4) continue;
      event.createdAt = new Date(Date.parse(event.createdAt) + 3_600_000).toISOString();
      const tick = (Date.parse(event.createdAt) - Date.parse(`${profile.date}T00:00:00.000Z`)) / 3_600_000;
      event.id = `event-${tick}-${index + 2}`;
    }
    for (const outcome of historical.outcomes) outcome.createdAt = new Date(Date.parse(outcome.createdAt) + 3_600_000).toISOString();
    const revision = updateClaim(approved(), "m.lead-claim", 12).events.at(-1)!;
    historical.events.splice(4, 0, revision); historical.claimValues["m.lead-claim"] = 12; historical.revision++; historical.tick++;
    delete historical.decisions[0].snapshot!.executionPolicy;
    historical.events.forEach((event) => { delete event.executionPolicy; });
    historical = checked(historical);
    expect(historical.mandates.every((mandate) => mandate.status === "completed")).toBe(true);
    expect(historical.events.filter((event) => event.kind === "outcome")).toHaveLength(originalEvents.filter((event) => event.kind === "outcome").length);
    const forgedUpgrade = structuredClone(historical);
    forgedUpgrade.events.find((event) => event.kind === "claim")!.executionPolicy = "source-window-v1";
    expect(() => validateWorkspace(forgedUpgrade)).toThrow("decision window");
  });

  test("maximum-length judgment and imported course names still produce valid bounded receipts", () => {
    const input = structuredClone(profile); input.strategies[0].name = "x".repeat(160);
    let world = authorize(createWorkspace(input), "m.diversify", "Retain the explicit old context.");
    world = checked(respondToDecision(world, world.decisions[0].id, { action: "investigate", rationale: "r".repeat(4000) }));
    expect(world.events.at(-1)!.review!.rationale).toHaveLength(4000);
    expect(world.events.at(-1)!.title.length).toBeLessThanOrEqual(160);
    expect(world.events.at(-1)!.detail.length).toBeLessThanOrEqual(4000);
  });
});
