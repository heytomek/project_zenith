import { capabilityAmount, claimValue, committed } from "./core";
import type { Mandate, Profile, Workspace } from "./types";
import { reviewWorld } from "./review";

export type WorldPhase = "understand" | "choose" | "delegate" | "act" | "review";
export type InsightView = "situation" | "strategies" | "mandates" | "ledger";
export type WorldAttention = {
  id: string;
  kind: "capacity" | "evidence" | "mandate" | "outcome";
  title: string;
  detail: string;
  view: InsightView;
  /** Claim for capacity/evidence, mandate for execution, decision for outcomes. */
  referenceId?: string;
  severity: "warning" | "neutral";
};
export type WorldInsights = {
  phase: WorldPhase;
  next: {
    label: string;
    view: InsightView;
    kind: "claim" | "decision" | "navigate";
    referenceId?: string;
  };
  attention: WorldAttention[];
  summary: {
    proposed: number;
    active: number;
    blocked: number;
    completed: number;
    changedClaims: number;
  };
};

const ACTIVE = new Set<Mandate["status"]>(["accepted", "running", "blocked", "stopping"]);
const EPS = 1e-7;
const differs = (a: number, b: number) => Math.abs(a - b) > EPS * Math.max(1, Math.abs(a), Math.abs(b));
const numbers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const format = (value: number) => numbers.format(value);

function includedScopes(profile: Profile, scopeId: string): Set<string> {
  if (scopeId === "*") return new Set(profile.scopes.map((scope) => scope.id));
  if (!profile.scopes.some((scope) => scope.id === scopeId)) return new Set();
  const ids = new Set([scopeId]);
  for (let pass = 0; pass < profile.scopes.length; pass++) {
    let added = false;
    for (const scope of profile.scopes) {
      if (scope.parentId && ids.has(scope.parentId) && !ids.has(scope.id)) {
        ids.add(scope.id);
        added = true;
      }
    }
    if (!added) break;
  }
  return ids;
}

/** Derived from current contracts, never historical event wording or a risk score. */
export function inspectWorld(workspace: Workspace, scopeId = "*"): WorldInsights {
  const profile = workspace.profile;
  const scopes = includedScopes(profile, scopeId);
  const mandates = workspace.mandates.filter((mandate) => scopes.has(mandate.scopeId));
  const active = mandates.filter((mandate) => ACTIVE.has(mandate.status));
  const proposed = mandates.filter((mandate) => mandate.status === "proposed");
  const decisionIds = new Set(mandates.map((mandate) => mandate.decisionId));
  const latestDecision = [...workspace.decisions].reverse().find((decision) => scopeId === "*" || decisionIds.has(decision.id));
  const claims = profile.claims.filter((claim) => scopes.has(claim.scopeId));
  const comparisonValue = (id: string, initial: number) => latestDecision?.claimValues[id] ?? initial;
  const changedClaims = claims.filter((claim) => differs(claimValue(workspace, claim.id), comparisonValue(claim.id, claim.value)));
  const changedIds = new Set(changedClaims.map((claim) => claim.id));
  const attention: WorldAttention[] = [];

  // A shared pool keeps its global reservations even when viewing one consumer.
  // Proposed ceilings are also checked: an action must not suggest acceptance
  // when a source change or competing proposal already makes it impossible.
  const overCapacity = new Set<string>();
  for (const capability of profile.capabilities) {
    if (!capability.scopeIds.some((id) => scopes.has(id))) continue;
    const reserved = committed(workspace, capability.id);
    const pending = workspace.mandates
      .filter((mandate) => mandate.status === "proposed")
      .flatMap((mandate) => mandate.resources)
      .filter((resource) => resource.capabilityId === capability.id)
      .reduce((sum, resource) => sum + resource.amount, 0);
    const amount = capabilityAmount(workspace, capability.id);
    if (reserved + pending <= amount + EPS) continue;
    overCapacity.add(capability.id);
    attention.push({
      id: `capacity:${capability.id}`,
      kind: "capacity",
      title: `${capability.label} exceeds capacity`,
      detail: `${format(reserved)} committed${pending ? ` + ${format(pending)} proposed` : ""} / ${format(amount)} ${capability.unit}.`,
      view: capability.claimId ? "situation" : "mandates",
      ...(capability.claimId ? { referenceId: capability.claimId } : {}),
      severity: "warning",
    });
  }

  const needsReview: Mandate[] = [];
  for (const mandate of [...proposed, ...active]) {
    if (mandate.status === "stopping") continue;
    const agent = profile.agents.find((candidate) => candidate.id === mandate.agentId)!;
    const intervention = profile.interventions.find((candidate) => candidate.id === mandate.interventionId)!;
    const dependency = mandate.dependencies
      .map((id) => workspace.mandates.find((candidate) => candidate.id === id)!)
      .find((candidate) => candidate.status === "revoked" || candidate.status === "stopping");
    const denied = !agent.scopeIds.includes(mandate.scopeId) || !agent.actions.includes("deliver")
      || mandate.resources.some((resource) => !profile.capabilities.find((capability) => capability.id === resource.capabilityId)!.scopeIds.includes(mandate.scopeId));
    const expiredProposal = mandate.status === "proposed" && workspace.tick + 1 > mandate.expiresAt;
    if (!dependency && !denied && !expiredProposal) continue;
    needsReview.push(mandate);
    attention.push({
      id: `mandate:${mandate.id}`,
      kind: "mandate",
      title: intervention.title,
      detail: dependency ? "A required mandate has stopped." : denied ? "Current authority does not permit this work." : "This proposal has expired.",
      view: "mandates",
      referenceId: mandate.id,
      severity: "warning",
    });
  }

  const evidence = [...changedClaims, ...claims.filter((claim) => claim.status === "contested" && !changedIds.has(claim.id))];
  for (const claim of evidence.slice(0, 3)) {
    const changed = changedIds.has(claim.id);
    attention.push({
      id: `evidence:${claim.id}`,
      kind: "evidence",
      title: claim.label,
      detail: changed
        ? `${format(comparisonValue(claim.id, claim.value))} → ${format(claimValue(workspace, claim.id))} ${claim.unit}${latestDecision ? " since authorization" : " from the starting source"}.`
        : `Contested source · ${claim.source.author} · ${claim.source.date}.`,
      view: "situation",
      referenceId: claim.id,
      severity: claim.status === "contested" ? "warning" : "neutral",
    });
  }

  const scopedOutcomes = workspace.outcomes.filter((outcome) => {
    const mandate = workspace.mandates.find((candidate) => candidate.id === outcome.mandateId)!;
    const objective = profile.objectives.find((candidate) => candidate.id === outcome.objectiveId)!;
    return scopes.has(mandate.scopeId) || scopes.has(objective.scopeId);
  });
  if (latestDecision) {
    for (const objective of profile.objectives) {
      const outcomes = scopedOutcomes.filter((outcome) => outcome.decisionId === latestDecision.id && outcome.objectiveId === objective.id);
      if (!outcomes.length) continue;
      const expected = outcomes.reduce((sum, outcome) => sum + outcome.expected, 0);
      const observed = outcomes.reduce((sum, outcome) => sum + outcome.observed, 0);
      if (!differs(expected, observed)) continue;
      const weaker = (observed - expected) * (objective.direction === "increase" ? 1 : -1) < 0;
      attention.push({
        id: `outcome:${latestDecision.id}:${objective.id}`,
        kind: "outcome",
        title: `${objective.label}: ${weaker ? "weaker" : "stronger"} outcome`,
        detail: `${format(expected)} projected · ${format(observed)} observed ${objective.unit}.`,
        view: "ledger",
        referenceId: latestDecision.id,
        severity: weaker ? "warning" : "neutral",
      });
    }
  }

  let phase: WorldPhase = "choose";
  let next: WorldInsights["next"] = { label: "Compare strategies", view: "strategies", kind: "navigate" };
  if (overCapacity.size || needsReview.length) {
    phase = "understand";
    const capacity = attention.find((item) => item.kind === "capacity");
    next = capacity?.referenceId
      ? { label: "Review capacity", view: "situation", kind: "claim", referenceId: capacity.referenceId }
      : { label: overCapacity.size ? "Review capacity" : "Review mandates", view: "mandates", kind: "navigate" };
  } else if (proposed.length) {
    phase = "delegate";
    next = { label: "Accept mandates", view: "mandates", kind: "navigate" };
  } else if (active.length) {
    phase = "act";
    next = { label: "Continue", view: "mandates", kind: "navigate" };
  } else if (scopedOutcomes.length) {
    phase = "review";
    next = { label: "Review outcomes", view: "ledger", kind: "navigate" };
  } else if (evidence.length) {
    phase = "understand";
    next = { label: "Inspect evidence", view: "situation", kind: "claim", referenceId: evidence[0].id };
  }

  const reviews = reviewWorld(workspace, scopeId);
  const challenged = [...reviews].reverse().find(review => review.state === "active" && review.issues.some(issue => issue.kind !== "outcome"));
  if (challenged) {
    phase = "understand";
    next = { label: "Review course", view: "situation", kind: "decision", referenceId: challenged.decisionId };
  } else if (phase === "review" && latestDecision) {
    next = { label: "Review outcomes", view: "ledger", kind: "decision", referenceId: latestDecision.id };
  }

  return {
    phase,
    next,
    attention: attention.slice(0, 6),
    summary: {
      proposed: proposed.length,
      active: active.length,
      blocked: mandates.filter((mandate) => mandate.status === "blocked").length,
      completed: mandates.filter((mandate) => mandate.status === "completed").length,
      changedClaims: changedClaims.length,
    },
  };
}
