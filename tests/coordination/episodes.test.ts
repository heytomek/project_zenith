import { describe, expect, test } from "bun:test";
import { decisionEpisode } from "../../apps/web/lib/coordination/episodes";
import { PROFILES, makeProfile } from "../../apps/web/lib/coordination/profiles";
import { createWorkspace, currentClaimSource, validateWorkspace } from "../../apps/web/lib/coordination/core";
import { exportLibrary, importLibrary } from "../../apps/web/lib/coordination/storage";
import { reviewWorld } from "../../apps/web/lib/coordination/review";

const CASES = {
  harbor: { strategy: "h.transition", claim: "h.crew-claim", value: 9500 },
  meridian: { strategy: "m.diversify", claim: "m.lead-claim", value: 12 },
  atlas: { strategy: "a.federate", claim: "a.lead-claim", value: 16 },
} as const;

describe("active strategic decision episodes", () => {
  for (const profile of PROFILES) {
    test(`${profile.name} retains a frozen promise, actual consumption and a consequential source change`, async () => {
      const original = structuredClone(profile);
      const episode = decisionEpisode(profile);
      const expected = CASES[profile.id as keyof typeof CASES];
      expect(episode.decisions).toHaveLength(1);
      const decision = episode.decisions[0];
      expect(decision.strategyId).toBe(expected.strategy);
      expect(decision.evaluation.feasible).toBe(true);
      expect(decision.authority).toBe(profile.authority);
      expect(decision.rationale.length).toBeGreaterThan(100);
      expect(decision.claimValues[expected.claim]).toBe(profile.claims.find((claim) => claim.id === expected.claim)!.value);
      expect(episode.claimValues[expected.claim]).toBe(expected.value);
      expect(episode.claimValues[expected.claim]).not.toBe(decision.claimValues[expected.claim]);
      expect(episode.events.some((event) => event.referenceId === expected.claim && event.change?.value === expected.value)).toBe(true);
      const source = currentClaimSource(episode, expected.claim);
      expect(source.title).toContain("synthetic");
      expect(source.author).toBe(profile.claims.find((claim) => claim.id === expected.claim)!.source.author);
      expect(source.date).toBe(profile.date);
      expect(episode.profile.claims.find((claim) => claim.id === expected.claim)!.source).toEqual(original.claims.find((claim) => claim.id === expected.claim)!.source);
      expect(episode.mandates.some((mandate) => mandate.status === "blocked")).toBe(true);
      expect(episode.mandates.some((mandate) => mandate.status === "completed")).toBe(true);
      expect(episode.mandates.flatMap((mandate) => mandate.resources).some((resource) => resource.consumed > 0)).toBe(true);
      expect(episode.mandates.flatMap((mandate) => mandate.resources).some((resource) => resource.consumed < resource.amount)).toBe(true);
      for (const outcome of episode.outcomes) {
        expect(episode.mandates.find((mandate) => mandate.id === outcome.mandateId)?.status).toBe("completed");
        expect(outcome.source).toStartWith("Synthetic completion");
      }
      expect(validateWorkspace(JSON.parse(JSON.stringify(episode)))).toEqual(episode);
      const review = reviewWorld(episode)[0];
      expect(review.decisionId).toBe(decision.id);
      expect(review.state).toBe("active");
      expect(review.conditional).toBe(true);
      const issue = review.issues.find((entry) => entry.kind === (profile.id === "harbor" ? "capacity" : "timing") && entry.claimIds.includes(expected.claim));
      expect(issue).toBeDefined();
      expect(issue!.mandateIds.length).toBeGreaterThan(0);
      expect(issue!.objectiveIds.length).toBeGreaterThan(0);
      const library = { version: 2 as const, activeId: profile.id, onboardingDone: false, workspaces: [episode] };
      expect(await importLibrary(await exportLibrary(library))).toEqual(library);
      expect(profile).toEqual(original);
      expect(createWorkspace(profile).decisions).toHaveLength(0);
    });
  }

  test("episodes are deterministic and independent", () => {
    const first = decisionEpisode(PROFILES[0]);
    const second = decisionEpisode(PROFILES[0]);
    expect(first).toEqual(second);
    first.mandates[0].resources[0].consumed = -1;
    expect(second.mandates[0].resources[0].consumed).toBeGreaterThanOrEqual(0);
  });

  test("a small custom world uses the same bounded source-and-decision loop", () => {
    const profile = makeProfile({ id: "episode-small", name: "Repair commons", objective: "Restore shared access" });
    const episode = decisionEpisode(profile);
    expect(episode.profile.id).toBe(profile.id);
    expect(episode.decisions).toHaveLength(1);
    expect(episode.claimValues["c.hours-claim"]).toBe(60);
    expect(episode.profile.agents).toHaveLength(1);
    expect(validateWorkspace(episode)).toEqual(episode);
  });

  test("an inadmissible or unsupported episode is not silently made executable", () => {
    const profile = structuredClone(PROFILES[0]);
    profile.strategies = [profile.strategies[2]];
    expect(() => decisionEpisode(profile)).toThrow("no feasible strategy");
    const small = makeProfile({ id: "episode-no-source", name: "Unchanged", objective: "Make a useful change" });
    small.shocks = [];
    expect(() => decisionEpisode(small)).toThrow("no relevant source change");
  });
});
