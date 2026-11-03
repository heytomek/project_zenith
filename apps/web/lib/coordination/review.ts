import { capabilityAmount, claimValue, committed, evaluate, executionWindow, strategySelection } from "./core";
import type { Effect, Evaluation, Mandate, Profile, ResourceUse, Workspace } from "./types";

export type DecisionReviewIssue = {
  id: string;
  kind: "capacity" | "protection" | "timing" | "outcome" | "dependency" | "authority";
  title: string;
  detail: string;
  scopeIds: string[];
  claimIds: string[];
  mandateIds: string[];
  objectiveIds: string[];
};
export type DecisionReviewChange = {
  claimId: string;
  before: number;
  value: number;
  interventionIds: string[];
  objectiveIds: string[];
  capabilityIds: string[];
  reason: "capacity" | "effect" | "timing" | "unlinked";
};
export type DecisionReview = {
  decisionId: string;
  strategyId: string;
  state: "active" | "complete" | "stopped";
  authority: string;
  scopeIds: string[];
  objectives: { objectiveId: string; frozen: number; current: number; remaining: number; projected: number; target: number; protected: boolean }[];
  resources: { capabilityId: string; ceiling: number; consumed: number; reserved: number; available: number; total: number; overcommitted: boolean }[];
  changes: DecisionReviewChange[];
  issues: DecisionReviewIssue[];
  participants: { scopeId: string; steward: string; role: string }[];
  conditional: boolean;
  assumptions: string[];
};
export type ResponseOption = {
  strategyId: string;
  name: string;
  interventionIds: string[];
  evaluation: Evaluation;
  requiresStop: boolean;
  assumptions: string[];
};

const RESERVED = new Set<Mandate["status"]>(["accepted", "running", "blocked", "stopping"]);
const UNFINISHED = new Set<Mandate["status"]>(["proposed", "accepted", "running", "blocked"]);
const EPS = 1e-7;
const round = (value: number) => Math.round(value * 1e8) / 1e8;
const different = (a: number, b: number) => Math.abs(a - b) > EPS * Math.max(1, Math.abs(a), Math.abs(b));
const unique = <T>(values: T[]): T[] => [...new Set(values)];
const formatter = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const format = (value: number) => formatter.format(value);

function scaled(item: Effect | ResourceUse, workspace: Workspace) {
  return round(item.amount * (item.scaleClaimId ? claimValue(workspace, item.scaleClaimId) / (item.scaleBase ?? 1) : 1));
}
function within(value: number, protection?: { min?: number; max?: number }) {
  return !protection || ((protection.min === undefined || value >= protection.min - EPS) && (protection.max === undefined || value <= protection.max + EPS));
}
function ordered(profile: Profile, ids: Iterable<string>) {
  const set = new Set(ids);
  return profile.scopes.filter(scope => set.has(scope.id)).map(scope => scope.id);
}

/**
 * Reassesses an issued course, never proposes issuing its work again.
 *
 * Current is the world baseline plus recorded observations. Remaining effects
 * belong only to unfinished, unstopped mandates. Progress consumes resources,
 * but the current runtime records outcomes only at completion: reducing an
 * unfinished effect by its progress would invent an unrecorded partial result.
 * Completion windows are sensitivities on the original planning horizon;
 * command ticks and the three progress steps are not elapsed calendar months.
 */
export function reviewDecision(workspace: Workspace, decisionId: string): DecisionReview {
  const decision = workspace.decisions.find(item => item.id === decisionId);
  if (!decision) throw new Error(`Unknown decision: ${decisionId}`);
  const profile = workspace.profile;
  const mandates = decision.mandateIds.map(id => {
    const mandate = workspace.mandates.find(item => item.id === id);
    if (!mandate) throw new Error(`Unknown decision mandate: ${id}`);
    return mandate;
  });
  const intervention = (mandate: Mandate) => profile.interventions.find(item => item.id === mandate.interventionId)!;
  const issues: DecisionReviewIssue[] = [];
  const scopeRoles = new Map<string, Set<string>>();
  const addScope = (id: string, role: string) => {
    const roles = scopeRoles.get(id) ?? new Set<string>();
    roles.add(role); scopeRoles.set(id, roles);
  };
  const event = workspace.events.find(item => item.kind === "decision" && item.referenceId === decisionId);
  if (event) addScope(event.scopeId, "Decision context");
  for (const mandate of mandates) {
    addScope(mandate.scopeId, "Delivery");
    for (const effect of intervention(mandate).effects) {
      const objective = profile.objectives.find(item => item.id === effect.objectiveId)!;
      addScope(objective.scopeId, "Affected objective");
    }
  }
  const effectsOf = (items: Mandate[]) => unique(items.flatMap(item => intervention(item).effects.map(effect => effect.objectiveId)));
  const downstream = (starting: Mandate[]) => {
    const ids = new Set(starting.map(item => item.id));
    for (let pass = 0; pass < mandates.length; pass++)
      for (const mandate of mandates) if (mandate.dependencies.some(id => ids.has(id))) ids.add(mandate.id);
    return mandates.filter(item => ids.has(item.id));
  };
  const addIssue = (issue: Omit<DecisionReviewIssue, "id">, key: string) => {
    const entry = { ...issue, id: `${decisionId}:${key}`, scopeIds: ordered(profile, issue.scopeIds), claimIds: unique(issue.claimIds), mandateIds: unique(issue.mandateIds), objectiveIds: unique(issue.objectiveIds) };
    issues.push(entry);
    for (const id of entry.scopeIds) addScope(id, "Review participant");
  };

  const changes: DecisionReviewChange[] = [];
  for (const claim of profile.claims) {
    const before = decision.claimValues[claim.id], value = claimValue(workspace, claim.id);
    if (!different(before, value)) continue;
    const capacityUsers = mandates.filter(mandate => intervention(mandate).resources.some(resource => {
      const capability = profile.capabilities.find(item => item.id === resource.capabilityId)!;
      return resource.scaleClaimId === claim.id || capability.claimId === claim.id;
    }));
    const effectUsers = mandates.filter(mandate => intervention(mandate).effects.some(effect => effect.scaleClaimId === claim.id));
    const timingUsers = mandates.filter(mandate => intervention(mandate).leadClaimId === claim.id);
    const users = downstream(unique([...capacityUsers, ...effectUsers, ...timingUsers]));
    // evaluate() captures every capacity claim. An unused pool is not a causal
    // input to this decision merely because it appears in that broad list.
    if (!users.length) continue;
    const capabilityIds = profile.capabilities.filter(cap => capacityUsers.some(mandate => intervention(mandate).resources.some(resource => resource.capabilityId === cap.id && (cap.claimId === claim.id || resource.scaleClaimId === claim.id)))).map(cap => cap.id);
    changes.push({ claimId: claim.id, before, value, interventionIds: unique(users.map(item => item.interventionId)), objectiveIds: effectsOf(users), capabilityIds, reason: capacityUsers.length ? "capacity" : timingUsers.length ? "timing" : "effect" });
    addScope(claim.scopeId, "Evidence owner");
  }

  const resources = profile.capabilities.flatMap(cap => {
    const users = mandates.filter(mandate => mandate.resources.some(resource => resource.capabilityId === cap.id));
    if (!users.length) return [];
    const allocations = users.flatMap(mandate => mandate.resources.filter(resource => resource.capabilityId === cap.id).map(resource => ({ mandate, resource })));
    const ceiling = round(allocations.reduce((sum, item) => sum + item.resource.amount, 0));
    const consumed = round(allocations.reduce((sum, item) => sum + item.resource.consumed, 0));
    const reserved = round(allocations.reduce((sum, item) => sum + (RESERVED.has(item.mandate.status) ? item.resource.amount - item.resource.consumed : 0), 0));
    const pending = round(allocations.reduce((sum, item) => sum + (item.mandate.status === "proposed" ? item.resource.amount : 0), 0));
    const used = committed(workspace, cap.id), total = capabilityAmount(workspace, cap.id);
    const overcommitted = used + pending > total + EPS;
    if (overcommitted) {
      const allUsers = workspace.mandates.filter(mandate => mandate.resources.some(resource => resource.capabilityId === cap.id && (resource.consumed > 0 || mandate.status !== "revoked")));
      const claim = profile.claims.find(item => item.id === cap.claimId);
      addIssue({ kind: "capacity", title: `${cap.label} cannot cover commitments`, detail: `${format(used)} committed${pending ? ` + ${format(pending)} proposed` : ""} / ${format(total)} ${cap.unit}; ${format(used + pending - total)} beyond current supply. Existing ceilings remain fixed.`, scopeIds: [...allUsers.map(item => item.scopeId), ...(claim ? [claim.scopeId] : [])], claimIds: cap.claimId ? [cap.claimId] : [], mandateIds: users.map(item => item.id), objectiveIds: effectsOf(downstream(users)) }, `capacity:${cap.id}`);
    }
    return [{ capabilityId: cap.id, ceiling, consumed, reserved, available: round(total - used), total, overcommitted }];
  });

  // A stopped ancestor invalidates its dependent path without manufacturing a
  // completion date. Timing itself comes from the same helper execution uses.
  const stoppedPath = new Set(workspace.mandates.filter(mandate => ["revoked", "stopping"].includes(mandate.status)).map(mandate => mandate.id));
  for (let pass = 0; pass < workspace.mandates.length; pass++)
    for (const mandate of workspace.mandates) if (mandate.dependencies.some(id => stoppedPath.has(id))) stoppedPath.add(mandate.id);
  const remaining = new Map(profile.objectives.map(item => [item.id, 0]));
  for (const mandate of mandates) {
    if (!UNFINISHED.has(mandate.status)) continue;
    const item = intervention(mandate);
    const descendants = downstream([mandate]);
    const objectiveIds = effectsOf(descendants);
    const stopped = mandate.dependencies.map(id => workspace.mandates.find(candidate => candidate.id === id)!).filter(predecessor => predecessor.status === "revoked" || predecessor.status === "stopping");
    if (stopped.length) addIssue({ kind: "dependency", title: `${item.title} lost a prerequisite`, detail: `${stopped.map(predecessor => intervention(predecessor).title).join(" + ")} stopped. Its dependent forecast is excluded; the original authority is retained.`, scopeIds: [mandate.scopeId, ...stopped.map(predecessor => predecessor.scopeId)], claimIds: [], mandateIds: [mandate.id, ...stopped.map(predecessor => predecessor.id)], objectiveIds }, `dependency:${mandate.id}`);
    const agent = profile.agents.find(candidate => candidate.id === mandate.agentId)!;
    const denied = !agent.actions.includes("deliver") || !agent.scopeIds.includes(mandate.scopeId) || mandate.resources.some(resource => !profile.capabilities.find(cap => cap.id === resource.capabilityId)!.scopeIds.includes(mandate.scopeId));
    const expired = workspace.tick + 1 > mandate.expiresAt;
    if (denied || expired) addIssue({ kind: "authority", title: `${item.title} needs renewed authority`, detail: denied ? "Current explicit scope or capability offers do not permit this work. Containment grants no additional rights." : "The next execution step would exceed this mandate's expiry. A review cannot extend it.", scopeIds: [mandate.scopeId], claimIds: [], mandateIds: [mandate.id], objectiveIds }, `authority:${mandate.id}`);
    for (const reservation of mandate.resources) {
      const estimate = round(item.resources.filter(resource => resource.capabilityId === reservation.capabilityId).reduce((sum, resource) => sum + scaled(resource, workspace), 0) * (1 - mandate.progress / 3));
      const envelope = round(reservation.amount - reservation.consumed);
      if (estimate <= envelope + EPS) continue;
      const capability = profile.capabilities.find(cap => cap.id === reservation.capabilityId)!;
      const claimIds = item.resources.filter(resource => resource.capabilityId === capability.id && resource.scaleClaimId).map(resource => resource.scaleClaimId!);
      addIssue({ kind: "authority", title: `${item.title} exceeds its resource envelope`, detail: `${format(estimate)} ${capability.unit} reassessed for unfinished work / ${format(envelope)} remaining in the frozen ceiling. No additional spending is authorized.`, scopeIds: [mandate.scopeId, ...claimIds.map(id => profile.claims.find(claim => claim.id === id)!.scopeId)], claimIds, mandateIds: [mandate.id], objectiveIds }, `envelope:${mandate.id}:${capability.id}`);
    }
    const window = executionWindow(workspace, mandate.id);
    const completion = stoppedPath.has(mandate.id) ? null : window.finish;
    if (completion !== null && window.invalidated) {
      const claimIds = window.claimIds.filter(id => changes.some(change => change.claimId === id));
      addIssue({ kind: "timing", title: `${item.title} leaves the decision horizon`, detail: `${format(mandate.finishMonths!)} → ${format(completion)} months; expected benefits now fall outside the ${profile.horizonMonths}-month decision horizon.`, scopeIds: unique(descendants.map(candidate => candidate.scopeId)), claimIds, mandateIds: descendants.map(candidate => candidate.id), objectiveIds }, `timing:${mandate.id}`);
    }
    if (completion === null || completion > profile.horizonMonths || denied || expired) continue;
    for (const effect of item.effects) remaining.set(effect.objectiveId, round((remaining.get(effect.objectiveId) ?? 0) + scaled(effect, workspace)));
  }

  const objectives = profile.objectives.map(objective => {
    const current = round(objective.baseline + workspace.outcomes.filter(outcome => outcome.objectiveId === objective.id).reduce((sum, outcome) => sum + outcome.observed, 0));
    const forecast = remaining.get(objective.id) ?? 0;
    const projected = round(current + forecast);
    const frozen = decision.evaluation.outcomes.find(outcome => outcome.objectiveId === objective.id)!.value;
    const protectedCondition = within(projected, objective.protection);
    const related = mandates.filter(mandate => intervention(mandate).effects.some(effect => effect.objectiveId === objective.id));
    const bounds = objective.protection ? [objective.protection.min !== undefined ? `at least ${format(objective.protection.min)}` : "", objective.protection.max !== undefined ? `at most ${format(objective.protection.max)}` : ""].filter(Boolean).join(" and ") : "";
    if (!within(current, objective.protection) || !protectedCondition) addIssue({ kind: "protection", title: `${objective.label} breaches a protected condition`, detail: `${format(current)} current; ${format(projected)} projected ${objective.unit}. Protected bound: ${bounds} ${objective.unit}.`, scopeIds: [objective.scopeId, ...related.map(mandate => mandate.scopeId)], claimIds: changes.filter(change => change.objectiveIds.includes(objective.id)).map(change => change.claimId), mandateIds: related.map(mandate => mandate.id), objectiveIds: [objective.id] }, `protection:${objective.id}`);
    const observed = workspace.outcomes.filter(outcome => outcome.decisionId === decisionId && outcome.objectiveId === objective.id);
    const expectedDelta = round(observed.reduce((sum, outcome) => sum + outcome.expected, 0)), actualDelta = round(observed.reduce((sum, outcome) => sum + outcome.observed, 0));
    if (different(expectedDelta, actualDelta)) addIssue({ kind: "outcome", title: `${objective.label} differs from the commitment`, detail: `${format(actualDelta)} observed / ${format(expectedDelta)} expected ${objective.unit} from completed work. The cause is not established by this difference.`, scopeIds: [objective.scopeId, ...related.map(mandate => mandate.scopeId)], claimIds: [], mandateIds: unique(observed.map(outcome => outcome.mandateId)), objectiveIds: [objective.id] }, `outcome:${objective.id}`);
    return { objectiveId: objective.id, frozen, current, remaining: forecast, projected, target: objective.target, protected: protectedCondition };
  });
  const state = mandates.every(mandate => mandate.status === "completed") ? "complete" : mandates.every(mandate => ["completed", "revoked"].includes(mandate.status)) ? "stopped" : "active";
  return {
    decisionId, strategyId: decision.strategyId, state, authority: decision.authority,
    scopeIds: ordered(profile, scopeRoles.keys()), objectives, resources, changes, issues,
    participants: profile.scopes.filter(scope => scopeRoles.has(scope.id)).map(scope => ({ scopeId: scope.id, steward: scope.steward, role: [...scopeRoles.get(scope.id)!].join(" · ") })),
    conditional: state === "active" && issues.some(issue => issue.kind !== "outcome"),
    assumptions: [
      "Current conditions include all recorded world outcomes; variance attribution uses only this decision's completed work.",
      "Unfinished effects are reassessed from current claims. Resource ceilings and executable expectations remain frozen.",
      "Capacity conflicts make the remaining projection conditional; this review neither grants resources nor resumes blocked work.",
      "Completion windows are sensitivities on the original planning horizon. Logical ticks and progress steps are not calendar months.",
      "Partial progress records consumption, not an observed partial outcome. Unrealized effects remain whole until completion.",
    ],
  };
}

/** Returns related decisions; filtering context never grants authority over them. */
export function reviewWorld(workspace: Workspace, scopeId = "*"): DecisionReview[] {
  if (scopeId === "*") return workspace.decisions.map(decision => reviewDecision(workspace, decision.id));
  if (!workspace.profile.scopes.some(scope => scope.id === scopeId)) return [];
  const scopes = new Set([scopeId]);
  for (let pass = 0; pass < workspace.profile.scopes.length; pass++)
    for (const scope of workspace.profile.scopes) if (scope.parentId && scopes.has(scope.parentId)) scopes.add(scope.id);
  return workspace.decisions.map(decision => reviewDecision(workspace, decision.id)).filter(review => review.scopeIds.some(id => scopes.has(id)));
}

/**
 * Compare new authorizations after this course alone has acknowledged stopping.
 * The counterfactual is never returned or persisted: it has no execution trace.
 * Spent capacity, completed outcomes and other courses' authority remain real.
 */
export function responseOptions(workspace: Workspace, decisionId: string): ResponseOption[] {
  const decision = workspace.decisions.find(item => item.id === decisionId);
  if (!decision) throw new Error(`Unknown decision: ${decisionId}`);
  const stopping = workspace.mandates.filter(mandate => mandate.decisionId === decisionId && !["completed", "revoked"].includes(mandate.status));
  const counterfactual = structuredClone(workspace);
  for (const mandate of counterfactual.mandates) {
    if (mandate.decisionId === decisionId && !["completed", "revoked"].includes(mandate.status)) mandate.status = "revoked";
  }
  const completed = new Set(workspace.mandates.filter(mandate => mandate.status === "completed").map(mandate => mandate.interventionId));
  return workspace.profile.strategies.flatMap(strategy => {
    const requested = strategy.interventionIds.filter(id => !completed.has(id));
    if (!requested.length) return [];
    const interventionIds = strategySelection(counterfactual, requested);
    const evaluation = evaluate({ ...counterfactual, profile: { ...counterfactual.profile, strategies: [{ ...strategy, interventionIds }] } }, strategy.id);
    return [{
      strategyId: strategy.id, name: strategy.name, interventionIds, evaluation, requiresStop: stopping.length > 0,
      assumptions: [
        "Only this decision's unfinished mandates are assumed stopped and acknowledged. Actual reservations remain until that acknowledgement.",
        "All consumed resources, completed observations and other decisions' commitments are retained.",
        "Restarted unfinished interventions use their full declared work-package cost. Partial spending is not refunded or treated as a completed outcome.",
        "A new authorization and planning window are required. This comparison does not establish recovery of the original deadline.",
        "Timing uses current claim-based lead times from the new planning origin; command ticks are not elapsed months.",
      ],
    }];
  });
}
