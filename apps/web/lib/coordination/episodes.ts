import { acceptAll, authorize, createWorkspace, evaluate, recordEvidence, stepAgents } from "./core";
import type { Profile, Workspace } from "./types";

const CASES: Record<string, { strategyId: string; shockId: string; rationale: string; report: string }> = {
  harbor: {
    strategyId: "h.transition",
    shockId: "h.crew-shock",
    rationale: "Authorize the 280-home transition with network commissioning and paid training reserved together. Keep resident consent and the displacement prohibition intact; revisit the sequence if the shared contractor allocation no longer covers the accepted work.",
    report: "Revised contractor commitment · synthetic",
  },
  meridian: {
    strategyId: "m.diversify",
    shockId: "m.lead-shock",
    rationale: "Qualify a second supplier after the component audit and protect paid training instead of relying on unsafe overtime. The delivery recovery depends on the laboratory window; a missed qualification window requires a new executive decision about the route to resilience.",
    report: "Laboratory reservation withdrawal · synthetic",
  },
  atlas: {
    strategyId: "a.federate",
    shockId: "a.review-shock",
    rationale: "Build a portable commons from reviewed public material, preserving contributor consent and the private-record boundary. Authorize catalog, verification, translation and a fork kit as one dependent course; reconsider publication scope if verification no longer supports the planned release window.",
    report: "Revised verification window · synthetic",
  },
};

/** A synthetic decision in progress, with a sourced change requiring judgment. */
export function decisionEpisode(profile: Profile): Workspace {
  let workspace = createWorkspace(profile);
  const configured = CASES[profile.id];
  const strategy = configured
    ? workspace.profile.strategies.find((candidate) => candidate.id === configured.strategyId)
    : workspace.profile.strategies.find((candidate) => evaluate(workspace, candidate.id).feasible);
  if (!strategy || !evaluate(workspace, strategy.id).feasible) {
    throw new Error("This profile has no feasible strategy for a decision episode.");
  }
  const usedClaims = new Set(strategy.interventionIds.flatMap((id) => {
    const intervention = workspace.profile.interventions.find((candidate) => candidate.id === id)!;
    return [
      intervention.leadClaimId,
      ...intervention.effects.map((effect) => effect.scaleClaimId),
      ...intervention.resources.flatMap((resource) => [resource.scaleClaimId, workspace.profile.capabilities.find((capability) => capability.id === resource.capabilityId)?.claimId]),
    ].filter((claimId): claimId is string => claimId !== undefined);
  }));
  const shock = configured
    ? workspace.profile.shocks.find((candidate) => candidate.id === configured.shockId)
    : workspace.profile.shocks.find((candidate) => usedClaims.has(candidate.claimId));
  if (!shock) throw new Error("This profile has no relevant source change for a decision episode.");
  const claim = workspace.profile.claims.find((candidate) => candidate.id === shock.claimId)!;

  workspace = acceptAll(authorize(workspace, strategy.id, configured?.rationale ?? strategy.thesis));
  workspace = stepAgents(stepAgents(workspace));
  workspace = recordEvidence(workspace, {
    claimId: claim.id,
    value: shock.value,
    source: {
      title: configured?.report ?? `${shock.name} · synthetic`,
      author: claim.source.author,
      date: profile.date,
      excerpt: shock.description,
    },
  });
  return stepAgents(workspace);
}
