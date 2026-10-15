import type { Capability, Decision, Effect, Evaluation, Event, Mandate, Profile, ResourceUse, Workspace } from "./types";

const EPS = 1e-7;
const RESERVED = new Set<Mandate["status"]>(["accepted", "running", "blocked", "stopping"]);
const finite = (n: number) => Number.isFinite(n);
const close = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
const round = (n: number) => Math.round(n * 1e8) / 1e8;
const copy = <T>(value: T): T => structuredClone(value);
function fail(message: string): never { throw new Error(message); }
function ensure(condition: unknown, message: string): asserts condition { if (!condition) fail(message); }
function find<T extends { id: string }>(items: T[], id: string, kind: string): T { return items.find((item) => item.id === id) ?? fail(`Unknown ${kind}: ${id}`); }
function timestamp(w: Workspace): string { return new Date(new Date(`${w.profile.date}T00:00:00.000Z`).getTime() + w.tick * 3_600_000).toISOString(); }
function mutate(w: Workspace, expectedRevision = w.revision): Workspace {
  ensure(expectedRevision === w.revision, "This workspace changed. Review the current revision before acting.");
  const next = copy(w); next.revision++; next.tick++; return next;
}
function emit(w: Workspace, kind: Event["kind"], title: string, detail: string, scopeId: string, referenceId?: string, state: Pick<Event, "change" | "progress" | "status"> = {}) {
  w.events.push({ id: `event-${w.revision}-${w.events.length + 1}`, kind, title, detail, scopeId, ...(referenceId ? { referenceId } : {}), ...state, createdAt: timestamp(w) });
}
function scaled(value: ResourceUse | Effect, values: Record<string, number>): number {
  return round(value.amount * (value.scaleClaimId ? values[value.scaleClaimId] / (value.scaleBase ?? 1) : 1));
}
function activeIds(w: Workspace): string[] { return w.mandates.filter((m) => m.status !== "revoked").map((m) => m.interventionId); }
function baselineDeltas(w: Workspace): Record<string, number> {
  return Object.fromEntries(w.profile.objectives.map((objective) => [objective.id, round(w.outcomes.filter((o) => o.objectiveId === objective.id).reduce((sum, o) => sum + o.observed, 0))]));
}
export function claimValue(w: Workspace, id: string): number { return w.claimValues[id] ?? find(w.profile.claims, id, "claim").value; }
export function capabilityAmount(w: Workspace, id: string): number {
  const cap = find(w.profile.capabilities, id, "capability"); return cap.claimId ? claimValue(w, cap.claimId) : cap.amount;
}
export function committed(w: Workspace, id: string): number {
  find(w.profile.capabilities, id, "capability");
  return round(w.mandates.reduce((total, mandate) => total + mandate.resources.filter((resource) => resource.capabilityId === id).reduce((sum, resource) => sum + (RESERVED.has(mandate.status) ? resource.amount : resource.consumed), 0), 0));
}
function evaluateAt(profile: Profile, strategyId: string, values: Record<string, number>, commitments: Record<string, number>, deltas: Record<string, number>, authorizedIds: string[]): Evaluation {
  const strategy = find(profile.strategies, strategyId, "strategy");
  const selected = strategy.interventionIds.map((id) => find(profile.interventions, id, "intervention"));
  const violations: string[] = [];
  const assumptions = new Set<string>();
  const schedule = new Map<string, { interventionId: string; start: number; finish: number }>();
  const required = new Map(profile.capabilities.map((cap) => [cap.id, 0]));
  const outcomeDeltas = new Map(profile.objectives.map((objective) => [objective.id, 0]));
  function captureClaim(id?: string) { if (id) assumptions.add(id); }
  function visit(id: string): { interventionId: string; start: number; finish: number } {
    const known = schedule.get(id); if (known) return known;
    const intervention = find(profile.interventions, id, "intervention");
    let start = 0;
    for (const dependency of intervention.dependencies) {
      if (!strategy.interventionIds.includes(dependency)) {
        violations.push(`${intervention.title} requires ${find(profile.interventions, dependency, "dependency").title}.`);
        start = Infinity;
      } else start = Math.max(start, visit(dependency).finish);
    }
    captureClaim(intervention.leadClaimId);
    const finish = start + (intervention.leadClaimId ? values[intervention.leadClaimId] : intervention.leadMonths);
    const entry = { interventionId: id, start: finite(start) ? round(start) : profile.horizonMonths + 1, finish: finite(finish) ? round(finish) : profile.horizonMonths + 1 };
    schedule.set(id, entry); return entry;
  }
  for (const intervention of selected) {
    if (authorizedIds.includes(intervention.id)) violations.push(`${intervention.title} already has a mandate.`);
    const agent = find(profile.agents, intervention.agentId, "agent");
    if (!agent.scopeIds.includes(intervention.scopeId) || !agent.actions.includes("deliver")) violations.push(`${agent.name} lacks scoped delivery authority for ${intervention.title}.`);
    const timing = visit(intervention.id);
    for (const resource of intervention.resources) {
      const cap = find(profile.capabilities, resource.capabilityId, "capability");
      if (!cap.scopeIds.includes(intervention.scopeId)) violations.push(`${cap.label} is not offered to ${find(profile.scopes, intervention.scopeId, "scope").name}.`);
      captureClaim(resource.scaleClaimId);
      required.set(cap.id, round((required.get(cap.id) ?? 0) + scaled(resource, values)));
    }
    for (const effect of intervention.effects) {
      captureClaim(effect.scaleClaimId);
      if (timing.finish <= profile.horizonMonths) outcomeDeltas.set(effect.objectiveId, round((outcomeDeltas.get(effect.objectiveId) ?? 0) + scaled(effect, values)));
    }
  }
  const resources = profile.capabilities.map((cap) => {
    captureClaim(cap.claimId);
    const total = cap.claimId ? values[cap.claimId] : cap.amount;
    const used = commitments[cap.id] ?? 0;
    const available = round(total - used);
    const demand = required.get(cap.id) ?? 0;
    if (demand > available + EPS) violations.push(`${cap.label}: ${round(demand - available)} ${cap.unit} beyond available capacity.`);
    return { capabilityId: cap.id, required: demand, available, total, committed: used };
  });
  const outcomes = profile.objectives.map((objective) => {
    const delta = outcomeDeltas.get(objective.id) ?? 0;
    const value = round(objective.baseline + (deltas[objective.id] ?? 0) + delta);
    const protectedCondition = !objective.protection || ((objective.protection.min === undefined || value >= objective.protection.min - EPS) && (objective.protection.max === undefined || value <= objective.protection.max + EPS));
    if (!protectedCondition) violations.push(`${objective.label}: ${value} ${objective.unit} breaches a protected condition.`);
    return { objectiveId: objective.id, value, delta, target: objective.target, protected: protectedCondition };
  });
  return { strategyId, feasible: violations.length === 0, violations: [...new Set(violations)], resources, outcomes, schedule: selected.map((i) => schedule.get(i.id)!), assumptions: [...assumptions].sort() };
}
export function evaluate(w: Workspace, strategyId: string): Evaluation {
  return evaluateAt(w.profile, strategyId, w.claimValues, Object.fromEntries(w.profile.capabilities.map((cap) => [cap.id, committed(w, cap.id)])), baselineDeltas(w), activeIds(w));
}
export function createWorkspace(input: Profile): Workspace {
  const profile = validateProfile(input);
  return { version: 2, profile, revision: 0, tick: 0, claimValues: Object.fromEntries(profile.claims.map((claim) => [claim.id, claim.value])), decisions: [], mandates: [], outcomes: [], events: [] };
}
export function updateClaim(w: Workspace, id: string, value: number, expectedRevision = w.revision): Workspace {
  const claim = find(w.profile.claims, id, "claim");
  ensure(finite(value) && value >= claim.min && value <= claim.max, `${claim.label} must be between ${claim.min} and ${claim.max} ${claim.unit}.`);
  ensure(expectedRevision === w.revision, "This workspace changed. Review the current revision before acting.");
  if (close(claimValue(w, id), value)) return copy(w);
  const next = mutate(w, expectedRevision); next.claimValues[id] = value;
  emit(next, "claim", claim.label, `${claimValue(w, id)} → ${value} ${claim.unit}. Source revision retained.`, claim.scopeId, id, { change: { before: claimValue(w, id), value } });
  for (const cap of next.profile.capabilities.filter((cap) => cap.claimId === id)) {
    if (committed(next, cap.id) > capabilityAmount(next, cap.id) + EPS) emit(next, "blocked", `${cap.label} needs review`, `${committed(next, cap.id)} ${cap.unit} committed; ${capabilityAmount(next, cap.id)} available. Existing ceilings remain fixed.`, claim.scopeId, cap.id);
  }
  return next;
}
export function authorize(w: Workspace, strategyId: string, rationale: string, expectedRevision = w.revision): Workspace {
  ensure(typeof rationale === "string" && rationale.trim().length > 0 && rationale.length <= 4000, "Record a rationale for this decision.");
  const next = mutate(w, expectedRevision);
  const evaluation = evaluate(w, strategyId);
  ensure(evaluation.feasible, evaluation.violations.join(" "));
  const strategy = find(w.profile.strategies, strategyId, "strategy");
  const decisionId = `decision-${next.revision}-${next.decisions.length + 1}`;
  const mandateIds = strategy.interventionIds.map((_, index) => `mandate-${next.revision}-${next.mandates.length + index + 1}`);
  const decision: Decision = { id: decisionId, strategyId, revision: w.revision, claimValues: copy(w.claimValues), evaluation: copy(evaluation), snapshot: { commitments: Object.fromEntries(w.profile.capabilities.map((cap) => [cap.id, committed(w, cap.id)])), baselineDeltas: baselineDeltas(w), authorizedInterventionIds: activeIds(w) }, authority: w.profile.authority, rationale: rationale.trim(), mandateIds, createdAt: timestamp(next) };
  next.decisions.push(decision);
  strategy.interventionIds.forEach((id, index) => {
    const intervention = find(w.profile.interventions, id, "intervention");
    const resources = new Map<string, number>();
    intervention.resources.forEach((r) => resources.set(r.capabilityId, round((resources.get(r.capabilityId) ?? 0) + scaled(r, decision.claimValues))));
    const finishMonths = evaluation.schedule.find((entry) => entry.interventionId === id)!.finish;
    next.mandates.push({ id: mandateIds[index], decisionId, interventionId: id, agentId: intervention.agentId, scopeId: intervention.scopeId, status: "proposed", progress: 0, resources: [...resources].map(([capabilityId, amount]) => ({ capabilityId, amount, consumed: 0 })), expectedEffects: finishMonths <= w.profile.horizonMonths ? intervention.effects.map((effect) => ({ objectiveId: effect.objectiveId, amount: scaled(effect, decision.claimValues) })) : [], dependencies: intervention.dependencies.map((dependency) => mandateIds[strategy.interventionIds.indexOf(dependency)]), expiresAt: next.tick + Math.max(12, Math.ceil(w.profile.horizonMonths * 3)), issuedRevision: next.revision, finishMonths, observedFactor: intervention.observedFactor, createdAt: timestamp(next) });
  });
  emit(next, "decision", strategy.name, `${w.profile.authority}: ${rationale.trim()}`, w.profile.scopes.find((scope) => scope.parentId === null)!.id, decisionId);
  return next;
}
function rights(w: Workspace, mandate: Mandate) {
  const agent = find(w.profile.agents, mandate.agentId, "agent");
  ensure(agent.scopeIds.includes(mandate.scopeId), `${agent.name} has no authority in this scope.`);
  ensure(agent.actions.includes("deliver"), `${agent.name} cannot deliver interventions.`);
  ensure(w.tick + 1 <= mandate.expiresAt, "This mandate has expired.");
  for (const resource of mandate.resources) ensure(find(w.profile.capabilities, resource.capabilityId, "capability").scopeIds.includes(mandate.scopeId), "This capability is not offered in the mandate's scope.");
  for (const id of mandate.dependencies) ensure(find(w.mandates, id, "dependency").status !== "revoked" && find(w.mandates, id, "dependency").status !== "stopping", "A required mandate has stopped. Review this strategy.");
}
function acceptBatch(w: Workspace, ids: string[], expectedRevision = w.revision): Workspace {
  ensure(expectedRevision === w.revision, "This workspace changed. Review the current revision before acting.");
  const proposed = ids.map((id) => find(w.mandates, id, "mandate")).filter((m) => m.status === "proposed");
  for (const id of ids) ensure(find(w.mandates, id, "mandate").status !== "revoked" && find(w.mandates, id, "mandate").status !== "stopping", "A stopped mandate cannot be accepted.");
  if (!proposed.length) return copy(w);
  proposed.forEach((m) => rights(w, m));
  for (const cap of w.profile.capabilities) {
    const required = proposed.reduce((sum, m) => sum + m.resources.filter((r) => r.capabilityId === cap.id).reduce((subtotal, r) => subtotal + r.amount, 0), 0);
    ensure(committed(w, cap.id) + required <= capabilityAmount(w, cap.id) + EPS, `${cap.label} has insufficient uncommitted capacity. Review this decision.`);
  }
  const next = mutate(w, expectedRevision);
  for (const item of proposed) {
    const mandate = find(next.mandates, item.id, "mandate");
    mandate.status = "accepted";
    emit(next, "accepted", find(next.profile.interventions, mandate.interventionId, "intervention").title, `${find(next.profile.agents, mandate.agentId, "agent").name} accepted the frozen resource ceiling.`, mandate.scopeId, mandate.id);
  }
  return next;
}
export function acceptMandate(w: Workspace, id: string, expectedRevision = w.revision): Workspace { return acceptBatch(w, [id], expectedRevision); }
export function acceptAll(w: Workspace): Workspace { return acceptBatch(w, w.mandates.filter((m) => m.status === "proposed").map((m) => m.id)); }
export function revokeMandate(w: Workspace, id: string): Workspace {
  const before = find(w.mandates, id, "mandate");
  if (before.status === "revoked" || before.status === "stopping") return copy(w);
  ensure(before.status !== "completed", "Completed work cannot be revoked; its consumed resources and outcomes remain recorded.");
  const next = mutate(w); const mandate = find(next.mandates, id, "mandate");
  mandate.status = before.status === "proposed" ? "revoked" : "stopping";
  mandate.reason = mandate.status === "stopping" ? "Stop requested; unconsumed capacity remains reserved until acknowledgement." : "Proposal withdrawn.";
  emit(next, "revoked", find(next.profile.interventions, mandate.interventionId, "intervention").title, mandate.reason, mandate.scopeId, id, { status: mandate.status });
  return next;
}
export function rejectProbe(w: Workspace, id: string): Workspace {
  const mandate = find(w.mandates, id, "mandate"); const next = mutate(w);
  emit(next, "rejected", "Outside mandate", `${find(w.profile.agents, mandate.agentId, "agent").name} requested an expanded resource ceiling. Rejected: this decision grants no authority to expand spending or borrow another scope's capacity.`, mandate.scopeId, id);
  return next;
}
export function stepAgents(w: Workspace): Workspace {
  if (!w.mandates.some((m) => RESERVED.has(m.status))) return copy(w);
  const next = mutate(w);
  const overcommitted = new Set(next.profile.capabilities.filter((cap) => committed(next, cap.id) > capabilityAmount(next, cap.id) + EPS).map((cap) => cap.id));
  for (const mandate of next.mandates) {
    if (!RESERVED.has(mandate.status)) continue;
    const intervention = find(next.profile.interventions, mandate.interventionId, "intervention");
    if (mandate.status === "stopping" || next.tick > mandate.expiresAt) {
      mandate.status = "revoked"; mandate.reason = next.tick > mandate.expiresAt ? "Expired; simulated specialist acknowledged stop." : "Simulated specialist acknowledged stop.";
      emit(next, "revoked", intervention.title, `${mandate.reason} Only unconsumed reservations released.`, mandate.scopeId, mandate.id, { status: "revoked" }); continue;
    }
    const agent = find(next.profile.agents, mandate.agentId, "agent");
    let reason: string | undefined;
    if (!agent.scopeIds.includes(mandate.scopeId) || !agent.actions.includes("deliver")) reason = "Delegated authority no longer permits execution.";
    else if (mandate.resources.some((r) => overcommitted.has(r.capabilityId))) reason = "A source revision reduced shared capacity below commitments. Human review required.";
    else if (mandate.dependencies.some((id) => find(w.mandates, id, "dependency").status !== "completed")) reason = "Waiting for the required mandate to complete.";
    if (reason) {
      if (mandate.status !== "blocked" || mandate.reason !== reason) emit(next, "blocked", intervention.title, reason, mandate.scopeId, mandate.id);
      mandate.status = "blocked"; mandate.reason = reason; continue;
    }
    delete mandate.reason;
    mandate.progress = Math.min(3, mandate.progress + 1);
    mandate.resources.forEach((r) => { r.consumed = round(r.amount * mandate.progress / 3); });
    mandate.status = mandate.progress === 3 ? "completed" : "running";
    emit(next, "progress", intervention.title, `Simulated specialist ${mandate.progress}/3; consumption stays within the frozen ceiling.`, mandate.scopeId, mandate.id, { progress: mandate.progress });
    if (mandate.status === "completed") {
      for (const effect of mandate.expectedEffects) {
        const observed = round(effect.amount * (mandate.observedFactor ?? intervention.observedFactor));
        const outcomeId = `outcome-${next.revision}-${next.outcomes.length + 1}`;
        next.outcomes.push({ id: outcomeId, mandateId: mandate.id, decisionId: mandate.decisionId, objectiveId: effect.objectiveId, expected: effect.amount, observed, source: `Synthetic completion · ${agent.name}`, createdAt: timestamp(next) });
        emit(next, "outcome", find(next.profile.objectives, effect.objectiveId, "objective").label, `${observed} observed; ${effect.amount} expected. Synthetic result, not field evidence.`, mandate.scopeId, outcomeId);
      }
    }
  }
  return next;
}

// Imports use the same finite, scoped contract as the bundled examples. Unknown keys
// are rejected rather than quietly preserving an unvalidated competing record.
type Obj = Record<string, unknown>;
function object(value: unknown, name: string, keys: string[]): Obj {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value), `${name} must be an object.`);
  const obj = value as Obj; ensure(Object.keys(obj).every((key) => keys.includes(key)), `${name} contains an unsupported field.`); return obj;
}
function text(value: unknown, name: string, max = 4000): string { ensure(typeof value === "string" && value.trim().length > 0 && value.length <= max, `${name} must be nonempty text, at most ${max} characters.`); return value; }
function id(value: unknown, name: string): string { const result = text(value, name, 100); ensure(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result) && !["__proto__", "constructor", "prototype"].includes(result), `${name} is not a valid identifier.`); return result; }
function number(value: unknown, name: string, min = -1e12, max = 1e12): number { ensure(typeof value === "number" && finite(value) && value >= min && value <= max, `${name} must be finite and between ${min} and ${max}.`); return value; }
function integer(value: unknown, name: string, min = 0, max = 1e6): number { const n = number(value, name, min, max); ensure(Number.isInteger(n), `${name} must be an integer.`); return n; }
function boolean(value: unknown, name: string): boolean { ensure(typeof value === "boolean", `${name} must be true or false.`); return value; }
function list<T>(value: unknown, name: string, parse: (v: unknown, n: string) => T, max = 200): T[] { ensure(Array.isArray(value) && value.length <= max, `${name} must be an array with at most ${max} items.`); return value.map((v, i) => parse(v, `${name}[${i}]`)); }
function ids(value: unknown, name: string): string[] { const result = list(value, name, id); ensure(new Set(result).size === result.length, `${name} contains duplicate identifiers.`); return result; }
function unique<T extends { id: string }>(items: T[], name: string): T[] { ensure(new Set(items.map((item) => item.id)).size === items.length, `${name} contains duplicate identifiers.`); return items; }
function oneOf<T extends string>(value: unknown, name: string, values: T[]): T { ensure(typeof value === "string" && values.includes(value as T), `${name} is invalid.`); return value as T; }
function date(value: unknown, name: string): string { const result = text(value, name, 10); ensure(/^\d{4}-\d{2}-\d{2}$/.test(result) && finite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result, `${name} must be a valid date.`); return result; }
function instant(value: unknown, name: string): string { const result = text(value, name, 30); ensure(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) && finite(Date.parse(result)), `${name} must be a UTC timestamp.`); return result; }
function unit(value: unknown, name: string): string { return text(value, name, 80); }
function references(items: { id: string }[], values: string[], name: string) { values.forEach((value) => find(items, value, name)); }
function acyclic(items: { id: string; dependencies: string[] }[], name: string) {
  const visited = new Set<string>(); const visiting = new Set<string>();
  function visit(key: string) { if (visited.has(key)) return; ensure(!visiting.has(key), `${name} contains a cycle.`); visiting.add(key); const item = find(items, key, name); item.dependencies.forEach(visit); visiting.delete(key); visited.add(key); }
  items.forEach((item) => visit(item.id));
}
function scaledRecord(value: unknown, name: string, key: "capabilityId" | "objectiveId"): ResourceUse | Effect {
  const v = object(value, name, [key, "amount", "scaleClaimId", "scaleBase"]);
  const result = { [key]: id(v[key], `${name}.${key}`), amount: number(v.amount, `${name}.amount`, key === "capabilityId" ? 0 : -1e12), ...(v.scaleClaimId !== undefined ? { scaleClaimId: id(v.scaleClaimId, `${name}.scaleClaimId`) } : {}), ...(v.scaleBase !== undefined ? { scaleBase: number(v.scaleBase, `${name}.scaleBase`, EPS) } : {}) };
  ensure((v.scaleClaimId === undefined) === (v.scaleBase === undefined), `${name} requires both scaling claim and base.`);
  return result as ResourceUse | Effect;
}
export function validateProfile(input: unknown): Profile {
  const p = object(input, "Profile", ["id", "name", "icon", "subtitle", "question", "context", "date", "horizonMonths", "authority", "principles", "scopes", "objectives", "claims", "capabilities", "interventions", "strategies", "agents", "shocks"]);
  const result: Profile = {
    id: id(p.id, "Profile.id"), name: text(p.name, "Profile.name", 160), icon: oneOf(p.icon, "Profile.icon", ["region", "enterprise", "commons", "custom"]), subtitle: text(p.subtitle, "Profile.subtitle"), question: text(p.question, "Profile.question"), context: text(p.context, "Profile.context"), date: date(p.date, "Profile.date"), horizonMonths: number(p.horizonMonths, "Profile.horizonMonths", 1, 1200), authority: text(p.authority, "Profile.authority", 160), principles: list(p.principles, "Profile.principles", (v, n) => text(v, n), 30),
    scopes: unique(list(p.scopes, "Scopes", (value, name) => { const s = object(value, name, ["id", "name", "parentId", "relatedIds", "kind", "steward", "description"]); return { id: id(s.id, `${name}.id`), name: text(s.name, `${name}.name`, 160), parentId: s.parentId === null ? null : id(s.parentId, `${name}.parentId`), relatedIds: ids(s.relatedIds, `${name}.relatedIds`), kind: text(s.kind, `${name}.kind`, 80), steward: text(s.steward, `${name}.steward`, 160), description: text(s.description, `${name}.description`) }; }), "Scopes"),
    objectives: unique(list(p.objectives, "Objectives", (value, name) => { const o = object(value, name, ["id", "scopeId", "label", "unit", "baseline", "target", "direction", "protection", "description"]); let protection; if (o.protection !== undefined) { const q = object(o.protection, `${name}.protection`, ["min", "max"]); ensure(q.min !== undefined || q.max !== undefined, `${name} protection has no bound.`); protection = { ...(q.min !== undefined ? { min: number(q.min, `${name}.min`) } : {}), ...(q.max !== undefined ? { max: number(q.max, `${name}.max`) } : {}) }; ensure(protection.min === undefined || protection.max === undefined || protection.min <= protection.max, `${name} protection bounds are inverted.`); } return { id: id(o.id, `${name}.id`), scopeId: id(o.scopeId, `${name}.scopeId`), label: text(o.label, `${name}.label`, 160), unit: unit(o.unit, `${name}.unit`), baseline: number(o.baseline, `${name}.baseline`), target: number(o.target, `${name}.target`), direction: oneOf(o.direction, `${name}.direction`, ["increase", "decrease"]), ...(protection ? { protection } : {}), description: text(o.description, `${name}.description`) }; }), "Objectives"),
    claims: unique(list(p.claims, "Claims", (value, name) => { const c = object(value, name, ["id", "scopeId", "label", "value", "unit", "status", "min", "max", "step", "source", "dissent"]); const s = object(c.source, `${name}.source`, ["title", "author", "date", "excerpt"]); return { id: id(c.id, `${name}.id`), scopeId: id(c.scopeId, `${name}.scopeId`), label: text(c.label, `${name}.label`, 160), value: number(c.value, `${name}.value`), unit: unit(c.unit, `${name}.unit`), status: oneOf(c.status, `${name}.status`, ["observed", "assumed", "contested"]), min: number(c.min, `${name}.min`), max: number(c.max, `${name}.max`), step: number(c.step, `${name}.step`, EPS), source: { title: text(s.title, `${name}.source.title`, 160), author: text(s.author, `${name}.source.author`, 160), date: date(s.date, `${name}.source.date`), excerpt: text(s.excerpt, `${name}.source.excerpt`) }, ...(c.dissent !== undefined ? { dissent: text(c.dissent, `${name}.dissent`) } : {}) }; }), "Claims"),
    capabilities: unique(list(p.capabilities, "Capabilities", (value, name) => { const c = object(value, name, ["id", "scopeIds", "label", "unit", "amount", "claimId", "provider", "period"]); return { id: id(c.id, `${name}.id`), scopeIds: ids(c.scopeIds, `${name}.scopeIds`), label: text(c.label, `${name}.label`, 160), unit: unit(c.unit, `${name}.unit`), amount: number(c.amount, `${name}.amount`, 0), ...(c.claimId !== undefined ? { claimId: id(c.claimId, `${name}.claimId`) } : {}), provider: text(c.provider, `${name}.provider`, 160), period: text(c.period, `${name}.period`, 160) }; }), "Capabilities"),
    interventions: unique(list(p.interventions, "Interventions", (value, name) => { const i = object(value, name, ["id", "scopeId", "title", "mechanism", "agentId", "dependencies", "resources", "effects", "leadMonths", "leadClaimId", "reversible", "observedFactor"]); return { id: id(i.id, `${name}.id`), scopeId: id(i.scopeId, `${name}.scopeId`), title: text(i.title, `${name}.title`, 160), mechanism: text(i.mechanism, `${name}.mechanism`), agentId: id(i.agentId, `${name}.agentId`), dependencies: ids(i.dependencies, `${name}.dependencies`), resources: list(i.resources, `${name}.resources`, (v, n) => scaledRecord(v, n, "capabilityId") as ResourceUse), effects: list(i.effects, `${name}.effects`, (v, n) => scaledRecord(v, n, "objectiveId") as Effect), leadMonths: number(i.leadMonths, `${name}.leadMonths`, 0, 1200), ...(i.leadClaimId !== undefined ? { leadClaimId: id(i.leadClaimId, `${name}.leadClaimId`) } : {}), reversible: boolean(i.reversible, `${name}.reversible`), observedFactor: number(i.observedFactor, `${name}.observedFactor`, 0, 2) }; }), "Interventions"),
    strategies: unique(list(p.strategies, "Strategies", (value, name) => { const s = object(value, name, ["id", "name", "thesis", "interventionIds"]); return { id: id(s.id, `${name}.id`), name: text(s.name, `${name}.name`, 160), thesis: text(s.thesis, `${name}.thesis`), interventionIds: ids(s.interventionIds, `${name}.interventionIds`) }; }), "Strategies"),
    agents: unique(list(p.agents, "Agents", (value, name) => { const a = object(value, name, ["id", "name", "initials", "role", "scopeIds", "actions"]); return { id: id(a.id, `${name}.id`), name: text(a.name, `${name}.name`, 160), initials: text(a.initials, `${name}.initials`, 6), role: text(a.role, `${name}.role`, 160), scopeIds: ids(a.scopeIds, `${name}.scopeIds`), actions: ids(a.actions, `${name}.actions`) }; }), "Agents"),
    shocks: unique(list(p.shocks, "Shocks", (value, name) => { const s = object(value, name, ["id", "name", "claimId", "value", "description"]); return { id: id(s.id, `${name}.id`), name: text(s.name, `${name}.name`, 160), claimId: id(s.claimId, `${name}.claimId`), value: number(s.value, `${name}.value`), description: text(s.description, `${name}.description`) }; }), "Shocks"),
  };
  const identities = [...result.scopes, ...result.objectives, ...result.claims, ...result.capabilities, ...result.interventions, ...result.strategies, ...result.agents, ...result.shocks].map((item) => item.id);
  ensure(new Set(identities).size === identities.length, "Primitive identities must remain unique across the profile.");
  ensure(result.scopes.length > 0 && result.objectives.length > 0 && result.strategies.length > 0 && result.interventions.length > 0, "A profile needs scopes, objectives, interventions and strategies.");
  ensure(result.scopes.some((scope) => scope.parentId === null), "A profile needs a root scope.");
  ensure(result.objectives.some((objective) => objective.protection), "Declare at least one protected condition.");
  result.scopes.forEach((scope) => { if (scope.parentId !== null) find(result.scopes, scope.parentId, "parent scope"); references(result.scopes, scope.relatedIds, "related scope"); ensure(!scope.relatedIds.includes(scope.id), "A scope cannot relate to itself."); });
  acyclic(result.scopes.map((scope) => ({ id: scope.id, dependencies: scope.parentId ? [scope.parentId] : [] })), "Scope hierarchy");
  result.objectives.forEach((objective) => { find(result.scopes, objective.scopeId, "objective scope"); ensure(objective.direction === "increase" ? objective.target >= objective.baseline : objective.target <= objective.baseline, `${objective.label} target contradicts its direction.`); });
  result.claims.forEach((claim) => { find(result.scopes, claim.scopeId, "claim scope"); ensure(claim.min <= claim.value && claim.value <= claim.max, `${claim.label} is outside its bounds.`); });
  result.capabilities.forEach((cap) => { ensure(cap.scopeIds.length > 0, `${cap.label} needs offered scopes.`); references(result.scopes, cap.scopeIds, "capability scope"); if (cap.claimId) { const claim = find(result.claims, cap.claimId, "capability claim"); ensure(claim.unit === cap.unit && claim.min >= 0, `${cap.label} and its claim require matching, nonnegative units.`); } });
  result.agents.forEach((agent) => references(result.scopes, agent.scopeIds, "agent scope"));
  result.interventions.forEach((intervention) => {
    find(result.scopes, intervention.scopeId, "intervention scope"); find(result.agents, intervention.agentId, "intervention agent"); references(result.interventions, intervention.dependencies, "dependency");
    ensure(new Set(intervention.effects.map((effect) => effect.objectiveId)).size === intervention.effects.length, "An intervention cannot duplicate an objective effect.");
    intervention.resources.forEach((resource) => find(result.capabilities, resource.capabilityId, "intervention capability"));
    intervention.effects.forEach((effect) => find(result.objectives, effect.objectiveId, "intervention objective"));
    [...intervention.resources, ...intervention.effects].forEach((value) => { if (value.scaleClaimId) { const claim = find(result.claims, value.scaleClaimId, "scaling claim"); ensure(claim.min >= 0, "Scaling claims must be nonnegative."); } });
    if (intervention.leadClaimId) { const claim = find(result.claims, intervention.leadClaimId, "lead claim"); ensure(/^months?$/i.test(claim.unit) && claim.min >= 0 && claim.max <= 1200, "Lead claims must use nonnegative months, at most 1200."); }
  });
  const maximumValues = Object.fromEntries(result.claims.map((claim) => [claim.id, claim.max]));
  result.capabilities.forEach((cap) => {
    const maximum = result.interventions.reduce((sum, intervention) => sum + intervention.resources.filter((resource) => resource.capabilityId === cap.id).reduce((subtotal, resource) => subtotal + scaled(resource, maximumValues), 0), 0);
    ensure(finite(maximum) && maximum <= 1e12, `${cap.label} scaled demand exceeds the model's numeric bounds.`);
  });
  result.objectives.forEach((objective) => {
    const maximum = result.interventions.reduce((sum, intervention) => sum + intervention.effects.filter((effect) => effect.objectiveId === objective.id).reduce((subtotal, effect) => subtotal + Math.abs(scaled(effect, maximumValues)) * Math.max(1, intervention.observedFactor), 0), 0);
    ensure(finite(maximum) && Math.abs(objective.baseline) + maximum <= 1e12, `${objective.label} scaled effects exceed the model's numeric bounds.`);
  });
  acyclic(result.interventions, "Intervention dependencies");
  result.strategies.forEach((strategy) => { ensure(strategy.interventionIds.length > 0, `${strategy.name} has no interventions.`); references(result.interventions, strategy.interventionIds, "strategy intervention"); });
  result.shocks.forEach((shock) => { const claim = find(result.claims, shock.claimId, "shock claim"); ensure(shock.value >= claim.min && shock.value <= claim.max, `${shock.name} is outside its claim bounds.`); });
  return result;
}

function numericRecord(input: unknown, name: string, keys: string[]): Record<string, number> {
  const value = object(input, name, keys); ensure(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), `${name} must include each declared value exactly once.`);
  return Object.fromEntries(keys.map((key) => [key, number(value[key], `${name}.${key}`)]));
}
function claimsRecord(input: unknown, name: string, profile: Profile): Record<string, number> {
  const values = numericRecord(input, name, profile.claims.map((claim) => claim.id));
  profile.claims.forEach((claim) => ensure(values[claim.id] >= claim.min && values[claim.id] <= claim.max, `${name}.${claim.id} is outside its claim bounds.`)); return values;
}
function parseEvaluation(input: unknown, name: string): Evaluation {
  const e = object(input, name, ["strategyId", "feasible", "violations", "resources", "outcomes", "schedule", "assumptions"]);
  return { strategyId: id(e.strategyId, `${name}.strategyId`), feasible: boolean(e.feasible, `${name}.feasible`), violations: list(e.violations, `${name}.violations`, (v, n) => text(v, n)), assumptions: ids(e.assumptions, `${name}.assumptions`), resources: list(e.resources, `${name}.resources`, (v, n) => { const r = object(v, n, ["capabilityId", "required", "available", "total", "committed"]); return { capabilityId: id(r.capabilityId, `${n}.capabilityId`), required: number(r.required, `${n}.required`, 0), available: number(r.available, `${n}.available`), total: number(r.total, `${n}.total`, 0), committed: number(r.committed, `${n}.committed`, 0) }; }), outcomes: list(e.outcomes, `${name}.outcomes`, (v, n) => { const o = object(v, n, ["objectiveId", "value", "delta", "target", "protected"]); return { objectiveId: id(o.objectiveId, `${n}.objectiveId`), value: number(o.value, `${n}.value`), delta: number(o.delta, `${n}.delta`), target: number(o.target, `${n}.target`), protected: boolean(o.protected, `${n}.protected`) }; }), schedule: list(e.schedule, `${name}.schedule`, (v, n) => { const s = object(v, n, ["interventionId", "start", "finish"]); return { interventionId: id(s.interventionId, `${n}.interventionId`), start: number(s.start, `${n}.start`, 0), finish: number(s.finish, `${n}.finish`, 0) }; }) };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function same(a: unknown, b: unknown, message: string) { ensure(JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)), message); }
export function validateWorkspace(input: unknown): Workspace {
  const w = object(input, "Workspace", ["version", "profile", "revision", "tick", "claimValues", "decisions", "mandates", "outcomes", "events"]);
  ensure(w.version === 2, "Unsupported workspace version.");
  const profile = validateProfile(w.profile);
  const result: Workspace = { version: 2, profile, revision: integer(w.revision, "Workspace.revision"), tick: integer(w.tick, "Workspace.tick"), claimValues: claimsRecord(w.claimValues, "Workspace.claimValues", profile), decisions: [], mandates: [], outcomes: [], events: [] };
  ensure(result.tick === result.revision, "The logical clock and revision disagree.");
  result.decisions = unique(list(w.decisions, "Decisions", (value, name) => {
    const d = object(value, name, ["id", "strategyId", "revision", "claimValues", "evaluation", "snapshot", "authority", "rationale", "mandateIds", "createdAt"]);
    const s = object(d.snapshot, `${name}.snapshot`, ["commitments", "baselineDeltas", "authorizedInterventionIds"]);
    const decision: Decision = { id: id(d.id, `${name}.id`), strategyId: id(d.strategyId, `${name}.strategyId`), revision: integer(d.revision, `${name}.revision`), claimValues: claimsRecord(d.claimValues, `${name}.claimValues`, profile), evaluation: parseEvaluation(d.evaluation, `${name}.evaluation`), snapshot: { commitments: numericRecord(s.commitments, `${name}.commitments`, profile.capabilities.map((cap) => cap.id)), baselineDeltas: numericRecord(s.baselineDeltas, `${name}.baselineDeltas`, profile.objectives.map((o) => o.id)), authorizedInterventionIds: ids(s.authorizedInterventionIds, `${name}.authorizedInterventionIds`) }, authority: text(d.authority, `${name}.authority`, 160), rationale: text(d.rationale, `${name}.rationale`), mandateIds: ids(d.mandateIds, `${name}.mandateIds`), createdAt: instant(d.createdAt, `${name}.createdAt`) };
    ensure(decision.revision < result.revision && decision.authority === profile.authority, "A decision has invalid authority or revision.");
    references(profile.interventions, decision.snapshot!.authorizedInterventionIds, "snapshot intervention");
    ensure(Object.values(decision.snapshot!.commitments).every((n) => n >= 0), "A frozen commitment cannot be negative.");
    const computed = evaluateAt(profile, decision.strategyId, decision.claimValues, decision.snapshot!.commitments, decision.snapshot!.baselineDeltas, decision.snapshot!.authorizedInterventionIds);
    same(decision.evaluation, computed, "A frozen decision does not reproduce from its inputs."); ensure(computed.feasible, "An infeasible strategy cannot be authorized."); return decision;
  }, 300), "Decisions");
  result.mandates = unique(list(w.mandates, "Mandates", (value, name) => {
    const m = object(value, name, ["id", "decisionId", "interventionId", "agentId", "scopeId", "status", "progress", "resources", "expectedEffects", "dependencies", "expiresAt", "issuedRevision", "finishMonths", "observedFactor", "reason", "createdAt"]);
    return { id: id(m.id, `${name}.id`), decisionId: id(m.decisionId, `${name}.decisionId`), interventionId: id(m.interventionId, `${name}.interventionId`), agentId: id(m.agentId, `${name}.agentId`), scopeId: id(m.scopeId, `${name}.scopeId`), status: oneOf(m.status, `${name}.status`, ["proposed", "accepted", "running", "blocked", "stopping", "revoked", "completed"]), progress: integer(m.progress, `${name}.progress`, 0, 3), resources: list(m.resources, `${name}.resources`, (v, n) => { const r = object(v, n, ["capabilityId", "amount", "consumed"]); return { capabilityId: id(r.capabilityId, `${n}.capabilityId`), amount: number(r.amount, `${n}.amount`, 0), consumed: number(r.consumed, `${n}.consumed`, 0) }; }), expectedEffects: list(m.expectedEffects, `${name}.expectedEffects`, (v, n) => scaledRecord(v, n, "objectiveId") as Effect), dependencies: ids(m.dependencies, `${name}.dependencies`), expiresAt: integer(m.expiresAt, `${name}.expiresAt`), issuedRevision: integer(m.issuedRevision, `${name}.issuedRevision`, 1), finishMonths: number(m.finishMonths, `${name}.finishMonths`, 0, 1e6), observedFactor: number(m.observedFactor, `${name}.observedFactor`, 0, 2), ...(m.reason !== undefined ? { reason: text(m.reason, `${name}.reason`) } : {}), createdAt: instant(m.createdAt, `${name}.createdAt`) };
  }, 1000), "Mandates");
  result.outcomes = unique(list(w.outcomes, "Outcomes", (value, name) => { const o = object(value, name, ["id", "mandateId", "decisionId", "objectiveId", "expected", "observed", "source", "createdAt"]); return { id: id(o.id, `${name}.id`), mandateId: id(o.mandateId, `${name}.mandateId`), decisionId: id(o.decisionId, `${name}.decisionId`), objectiveId: id(o.objectiveId, `${name}.objectiveId`), expected: number(o.expected, `${name}.expected`), observed: number(o.observed, `${name}.observed`), source: text(o.source, `${name}.source`), createdAt: instant(o.createdAt, `${name}.createdAt`) }; }, 2000), "Outcomes");
  result.events = unique(list(w.events, "Events", (value, name) => {
    const e = object(value, name, ["id", "kind", "title", "detail", "scopeId", "referenceId", "change", "progress", "status", "createdAt"]);
    let change; if (e.change !== undefined) { const c = object(e.change, `${name}.change`, ["before", "value"]); change = { before: number(c.before, `${name}.change.before`), value: number(c.value, `${name}.change.value`) }; }
    return { id: id(e.id, `${name}.id`), kind: oneOf(e.kind, `${name}.kind`, ["claim", "decision", "accepted", "progress", "blocked", "revoked", "outcome", "rejected"]), title: text(e.title, `${name}.title`, 160), detail: text(e.detail, `${name}.detail`), scopeId: id(e.scopeId, `${name}.scopeId`), ...(e.referenceId !== undefined ? { referenceId: id(e.referenceId, `${name}.referenceId`) } : {}), ...(change ? { change } : {}), ...(e.progress !== undefined ? { progress: integer(e.progress, `${name}.progress`, 1, 3) } : {}), ...(e.status !== undefined ? { status: oneOf<Mandate["status"]>(e.status, `${name}.status`, ["proposed", "accepted", "running", "blocked", "stopping", "revoked", "completed"]) } : {}), createdAt: instant(e.createdAt, `${name}.createdAt`) };
  }, 5000), "Events");
  for (const decision of result.decisions) {
    const strategy = find(profile.strategies, decision.strategyId, "strategy");
    ensure(decision.mandateIds.length === strategy.interventionIds.length, "A decision's mandate set is incomplete.");
    decision.mandateIds.forEach((key, index) => {
      const mandate = find(result.mandates, key, "decision mandate");
      ensure(mandate.decisionId === decision.id && mandate.interventionId === strategy.interventionIds[index], "A mandate belongs to another decision or intervention.");
    });
  }
  for (const mandate of result.mandates) {
    const decision = find(result.decisions, mandate.decisionId, "mandate decision");
    const intervention = find(profile.interventions, mandate.interventionId, "mandate intervention");
    ensure(decision.mandateIds.includes(mandate.id) && mandate.agentId === intervention.agentId && mandate.scopeId === intervention.scopeId && mandate.issuedRevision === decision.revision + 1, "A mandate changed its authority boundary.");
    const expectedResources = new Map<string, number>(); intervention.resources.forEach((r) => expectedResources.set(r.capabilityId, round((expectedResources.get(r.capabilityId) ?? 0) + scaled(r, decision.claimValues))));
    same(mandate.resources.map((r) => ({ capabilityId: r.capabilityId, amount: r.amount })), [...expectedResources].map(([capabilityId, amount]) => ({ capabilityId, amount })), "A mandate changed its frozen ceiling.");
    const timing = decision.evaluation.schedule.find((s) => s.interventionId === intervention.id)!;
    ensure(close(mandate.finishMonths!, timing.finish) && close(mandate.observedFactor!, intervention.observedFactor), "A mandate changed its frozen execution model.");
    const expectedEffects = timing.finish <= profile.horizonMonths ? intervention.effects.map((e) => ({ objectiveId: e.objectiveId, amount: scaled(e, decision.claimValues) })) : [];
    same(mandate.expectedEffects, expectedEffects, "A mandate changed its frozen expectations.");
    const dependencies = intervention.dependencies.map((key) => result.mandates.find((m) => m.decisionId === decision.id && m.interventionId === key)?.id);
    same(mandate.dependencies, dependencies, "A mandate changed its required predecessors.");
    ensure(mandate.expiresAt === mandate.issuedRevision + Math.max(12, Math.ceil(profile.horizonMonths * 3)), "A mandate changed its expiry.");
    mandate.resources.forEach((r) => ensure(r.consumed <= r.amount + EPS && close(r.consumed, round(r.amount * mandate.progress / 3)), "A resource ledger has fabricated consumption."));
    ensure(mandate.status !== "completed" || mandate.progress === 3, "Completed work has incomplete progress.");
    ensure(mandate.progress !== 3 || mandate.status === "completed", "Completed progress has an invalid state.");
    ensure(!["proposed", "accepted"].includes(mandate.status) || mandate.progress === 0, "Unstarted work has consumption.");
    ensure(mandate.status !== "running" || (mandate.progress > 0 && mandate.progress < 3), "Running work has invalid progress.");
    if (!["proposed", "revoked"].includes(mandate.status)) { const agent = find(profile.agents, mandate.agentId, "mandate agent"); ensure(agent.scopeIds.includes(mandate.scopeId) && agent.actions.includes("deliver"), "An active mandate lacks scoped delivery authority."); }
    const recorded = result.outcomes.filter((o) => o.mandateId === mandate.id);
    ensure(recorded.length === (mandate.status === "completed" ? expectedEffects.length : 0), "A mandate has missing, duplicate or premature outcomes.");
    expectedEffects.forEach((effect) => { if (mandate.status === "completed") { const outcome = recorded.find((o) => o.objectiveId === effect.objectiveId); ensure(outcome && outcome.decisionId === decision.id && close(outcome.expected, effect.amount) && close(outcome.observed, round(effect.amount * mandate.observedFactor!)), "An outcome does not reproduce from its frozen expectation."); } });
  }
  acyclic(result.mandates.map((m) => ({ id: m.id, dependencies: m.dependencies })), "Mandate dependencies");
  result.outcomes.forEach((outcome) => { find(result.mandates, outcome.mandateId, "outcome mandate"); find(profile.objectives, outcome.objectiveId, "outcome objective"); });
  const allIds = new Set([...profile.scopes, ...profile.objectives, ...profile.claims, ...profile.capabilities, ...profile.interventions, ...profile.strategies, ...profile.agents, ...result.decisions, ...result.mandates, ...result.outcomes].map((item) => item.id));
  const profileIds = [...profile.scopes, ...profile.objectives, ...profile.claims, ...profile.capabilities, ...profile.interventions, ...profile.strategies, ...profile.agents, ...profile.shocks];
  const runtimeIds = [...result.decisions, ...result.mandates, ...result.outcomes, ...result.events];
  ensure(new Set([...profileIds, ...runtimeIds].map((item) => item.id)).size === profileIds.length + runtimeIds.length, "Runtime and primitive identities overlap.");
  result.events.forEach((event) => { find(profile.scopes, event.scopeId, "event scope"); if (event.referenceId) ensure(allIds.has(event.referenceId), "An event refers to an unknown record."); });
  // A capacity shock can legitimately shrink today's ledger below existing commitments.
  // Its ceiling is nevertheless bounded by the source's declared maximum, and every
  // reservation must reproduce from an authorized, feasible frozen run.
  profile.capabilities.forEach((cap: Capability) => {
    const ceiling = cap.claimId ? find(profile.claims, cap.claimId, "capacity claim").max : cap.amount;
    ensure(committed(result, cap.id) <= ceiling + EPS, `${cap.label} ledger exceeds all declared capacity.`);
  });
  const firstTime = Date.parse(`${profile.date}T00:00:00.000Z`); const lastTime = firstTime + result.tick * 3_600_000;
  [...result.decisions, ...result.mandates, ...result.outcomes, ...result.events].forEach((entry) => ensure(Date.parse(entry.createdAt) >= firstTime && Date.parse(entry.createdAt) <= lastTime, "A record lies outside the workspace clock."));
  replayTrace(result);
  return result;
}

function replayTrace(w: Workspace) {
  const states = new Map<string, { status: Mandate["status"]; progress: number; completedAt?: number }>();
  const values = Object.fromEntries(w.profile.claims.map((c) => [c.id, c.value]));
  const observed = Object.fromEntries(w.profile.objectives.map((o) => [o.id, 0]));
  const decisions = new Set<string>(); const outcomes = new Set<string>();
  const firstTime = Date.parse(`${w.profile.date}T00:00:00.000Z`); let previousTick = 0;
  function used(capabilityId: string): number {
    return round(w.mandates.reduce((sum, m) => { const state = states.get(m.id); if (!state) return sum; return sum + m.resources.filter((r) => r.capabilityId === capabilityId).reduce((subtotal, r) => subtotal + (RESERVED.has(state.status) ? r.amount : round(r.amount * state.progress / 3)), 0); }, 0));
  }
  for (const event of w.events) {
    const tick = (Date.parse(event.createdAt) - firstTime) / 3_600_000;
    ensure(Number.isInteger(tick) && tick >= previousTick && tick > 0 && tick <= w.tick, "The audit trace has an invalid logical sequence."); previousTick = tick;
    if (event.kind === "claim") {
      const claim = find(w.profile.claims, event.referenceId ?? "", "source event");
      ensure(event.change && close(event.change.before, values[claim.id]) && event.change.value >= claim.min && event.change.value <= claim.max && event.scopeId === claim.scopeId, "A source revision has no coherent before and after values.");
      values[claim.id] = event.change.value; continue;
    }
    ensure(!event.change, "Only source revisions may change a claim.");
    if (event.kind === "decision") {
      const decision = find(w.decisions, event.referenceId ?? "", "decision event");
      ensure(!decisions.has(decision.id) && tick === decision.revision + 1 && event.createdAt === decision.createdAt, "A decision event has an invalid revision.");
      same(decision.claimValues, values, "A frozen decision did not use the source values at authorization.");
      same(decision.snapshot!.commitments, Object.fromEntries(w.profile.capabilities.map((cap) => [cap.id, used(cap.id)])), "A frozen decision changed existing commitments.");
      same(decision.snapshot!.baselineDeltas, observed, "A frozen decision changed previously observed outcomes.");
      same(decision.snapshot!.authorizedInterventionIds, w.mandates.filter((m) => states.has(m.id) && states.get(m.id)!.status !== "revoked").map((m) => m.interventionId), "A frozen decision changed existing mandates.");
      decisions.add(decision.id); decision.mandateIds.forEach((key) => states.set(key, { status: "proposed", progress: 0 })); continue;
    }
    if (event.kind === "outcome") {
      const outcome = find(w.outcomes, event.referenceId ?? "", "outcome event");
      ensure(!outcomes.has(outcome.id) && states.get(outcome.mandateId)?.status === "completed" && event.createdAt === outcome.createdAt, "An outcome has no completed, unique acknowledgement.");
      observed[outcome.objectiveId] = round(observed[outcome.objectiveId] + outcome.observed); outcomes.add(outcome.id); continue;
    }
    if (event.kind === "blocked" && w.profile.capabilities.some((cap) => cap.id === event.referenceId)) continue;
    const mandate = find(w.mandates, event.referenceId ?? "", "action event"); const state = states.get(mandate.id);
    ensure(state && event.scopeId === mandate.scopeId, "An action preceded its delegated mandate or changed scope.");
    if (event.kind === "accepted") {
      ensure(state.status === "proposed" && tick <= mandate.expiresAt, "An acceptance duplicated or exceeded its authorization.");
      const agent = find(w.profile.agents, mandate.agentId, "agent"); ensure(agent.scopeIds.includes(mandate.scopeId) && agent.actions.includes("deliver"), "An acceptance lacks scoped delivery authority.");
      ensure(mandate.dependencies.every((key) => states.has(key) && !["revoked", "stopping"].includes(states.get(key)!.status)), "An acceptance depends on stopped work.");
      for (const resource of mandate.resources) { const cap = find(w.profile.capabilities, resource.capabilityId, "capability"); const total = cap.claimId ? values[cap.claimId] : cap.amount; ensure(cap.scopeIds.includes(mandate.scopeId) && used(cap.id) + resource.amount <= total + EPS, "The audit trace fabricates overspending or resource authority."); }
      state.status = "accepted";
    } else if (event.kind === "progress") {
      ensure(["accepted", "running", "blocked"].includes(state.status) && event.progress === state.progress + 1 && tick <= mandate.expiresAt, "A progress acknowledgement exceeds its active mandate.");
      ensure(mandate.dependencies.every((key) => states.get(key)?.status === "completed" && states.get(key)!.completedAt! < tick), "Execution preceded a required dependency.");
      for (const resource of mandate.resources) { const cap = find(w.profile.capabilities, resource.capabilityId, "capability"); const total = cap.claimId ? values[cap.claimId] : cap.amount; ensure(used(cap.id) <= total + EPS, "Execution continued despite a capacity exception."); }
      state.progress = event.progress!; state.status = state.progress === 3 ? "completed" : "running"; if (state.status === "completed") state.completedAt = tick;
    } else if (event.kind === "blocked") {
      ensure(["accepted", "running", "blocked"].includes(state.status), "A blocked event lacks active work."); state.status = "blocked";
    } else if (event.kind === "revoked") {
      ensure(event.status === "stopping" || event.status === "revoked", "A revocation lacks a stop state.");
      if (event.status === "stopping") ensure(["accepted", "running", "blocked"].includes(state.status), "A stop request lacks active work.");
      else ensure(state.status === "proposed" || state.status === "stopping" || (RESERVED.has(state.status) && tick > mandate.expiresAt), "A reservation was released without an acknowledged stop.");
      state.status = event.status;
    } else ensure(event.kind === "rejected", "Unsupported action trace.");
  }
  same(values, w.claimValues, "Current claims do not reproduce from source revisions.");
  ensure(decisions.size === w.decisions.length && outcomes.size === w.outcomes.length && states.size === w.mandates.length, "The audit trace omits a decision, mandate or outcome.");
  w.mandates.forEach((mandate) => { const state = states.get(mandate.id)!; ensure(state.status === mandate.status && state.progress === mandate.progress, "The resource ledger does not reproduce from acknowledgements."); });
}
