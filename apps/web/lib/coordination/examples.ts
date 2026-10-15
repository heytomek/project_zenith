import { acceptAll, authorize, createWorkspace, evaluate, stepAgents, updateClaim } from "./core";
import type { Profile, Workspace } from "./types";

/** A replayable synthetic history; the same commands drive the interactive workspace. */
export function workedExample(profile: Profile): Workspace {
  let workspace = createWorkspace(profile);
  const strategy = profile.strategies.find((candidate) => evaluate(workspace, candidate.id).feasible);
  if (!strategy) throw new Error("This profile has no feasible strategy for a worked example.");

  workspace = acceptAll(authorize(workspace, strategy.id, strategy.thesis));
  for (let step = 0; step < 12 && workspace.mandates.some((mandate) => mandate.status !== "completed"); step++) {
    workspace = stepAgents(workspace);
  }
  if (workspace.mandates.some((mandate) => mandate.status !== "completed")) {
    throw new Error("The worked example did not complete within twelve simulation steps.");
  }

  const used = new Set(workspace.decisions[0].evaluation.resources.filter((resource) => resource.required > 0).map((resource) => resource.capabilityId));
  const shock = profile.shocks.find((candidate) => profile.capabilities.some((capability) => capability.claimId === candidate.claimId && used.has(capability.id)))
    ?? profile.shocks.find((candidate) => workspace.decisions[0].evaluation.assumptions.includes(candidate.claimId));
  if (shock) workspace = updateClaim(workspace, shock.claimId, shock.value);
  return workspace;
}
