"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleDashed,
  CircleDot,
  Clock3,
  GitBranch,
  Link2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Square,
  TriangleAlert,
} from "lucide-react";
import {
  acceptAll,
  acceptMandate,
  capabilityAmount,
  claimValue,
  committed,
  evaluate,
  revokeMandate,
  stepAgents,
} from "@/lib/coordination/core";
import type {
  Agent,
  Claim,
  Decision,
  Evaluation,
  Profile,
  Scope,
  Workspace,
} from "@/lib/coordination/types";
import { IconButton, metric, number } from "./primitives";

export type View = "situation" | "strategies" | "mandates" | "ledger";
export type Inspect =
  | { kind: "claim"; id: string }
  | { kind: "agent"; id: string }
  | { kind: "decision"; id: string }
  | { kind: "scope"; id: string };
export function scopeSet(profile: Profile, id: string) {
  if (id === "*") return new Set(profile.scopes.map((scope) => scope.id));
  const ids = new Set([id]);
  for (let i = 0; i < profile.scopes.length; i++)
    for (const scope of profile.scopes)
      if (scope.parentId && ids.has(scope.parentId)) ids.add(scope.id);
  return ids;
}
export function scopeDepth(profile: Profile, scope: Scope): number {
  let depth = 0,
    parent = scope.parentId;
  while (parent) {
    depth++;
    parent =
      profile.scopes.find((item) => item.id === parent)?.parentId ?? null;
  }
  return depth;
}
type ViewProps = {
  workspace: Workspace;
  scopeId: string;
  inspect: (value: Inspect) => void;
  change: (transform: (workspace: Workspace) => Workspace) => boolean;
};
const findLabel = (workspace: Workspace, id: string) =>
  workspace.profile.scopes.find((item) => item.id === id)?.name;
export function Resources({
  workspace,
  evaluation,
  scopeId,
}: {
  workspace: Workspace;
  evaluation?: Evaluation;
  scopeId?: string;
}) {
  const ids = scopeId ? scopeSet(workspace.profile, scopeId) : null;
  const caps = workspace.profile.capabilities.filter(
    (cap) => !ids || cap.scopeIds.some((id) => ids.has(id)),
  );
  return (
    <div className="z-resources">
      {caps.map((cap) => {
        const total = capabilityAmount(workspace, cap.id),
          reserved = committed(workspace, cap.id),
          demand =
            evaluation?.resources.find((entry) => entry.capabilityId === cap.id)
              ?.required ?? 0;
        const over = reserved + demand > total;
        return (
          <div className="resource-row" key={cap.id}>
            <div>
              <strong>{cap.label}</strong>
              <span className={`value ${over ? "negative" : ""}`}>
                {metric(reserved + demand, cap.unit)} / {number(total)}
              </span>
            </div>
            <div
              className="resource-track"
              role="img"
              aria-label={`${cap.label}: ${reserved} committed, ${demand} proposed, ${total} total ${cap.unit}`}
            >
              <span
                className="reserved"
                style={{
                  width: `${Math.min(100, total ? (reserved / total) * 100 : 0)}%`,
                }}
              />
              <span
                className="proposed"
                style={{
                  width: `${Math.min(100, total ? (demand / total) * 100 : 0)}%`,
                }}
              />
            </div>
            <small>
              {cap.provider} · {cap.period}
              {reserved > 0 ? ` · ${number(reserved)} committed` : ""}
            </small>
          </div>
        );
      })}
    </div>
  );
}
function ScopeMap({
  workspace,
  scopeId,
  select,
}: {
  workspace: Workspace;
  scopeId: string;
  select: (id: string) => void;
}) {
  const scopes = workspace.profile.scopes;
  const levels = new Map<number, Scope[]>();
  scopes.forEach((scope) => {
    const depth = scopeDepth(workspace.profile, scope);
    levels.set(depth, [...(levels.get(depth) ?? []), scope]);
  });
  const positions = new Map<string, { x: number; y: number }>();
  const rows = [...levels.values()].reduce(
    (total, items) => total + Math.ceil(items.length / 3),
    0,
  );
  let offset = 0;
  const drawnOverlaps = new Set<string>();
  levels.forEach((items) => {
    items.forEach((scope, i) => {
      const row = Math.floor(i / 3);
      const columns = Math.min(3, items.length - row * 3);
      positions.set(scope.id, {
        x: (((i % 3) + 1) * 100) / (columns + 1),
        y: ((offset + row + 1) * 100) / (rows + 1),
      });
    });
    offset += Math.ceil(items.length / 3);
  });
  return (
    <>
      <div className="z-map-surface">
        <div
          className="map-canvas"
          style={{ height: Math.max(340, rows * 120) }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {scopes.flatMap((scope) => {
              const to = positions.get(scope.id)!;
              const edges = [];
              if (scope.parentId) {
                const from = positions.get(scope.parentId)!;
                edges.push(
                  <line
                    key={`${scope.id}-parent`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    strokeWidth=".3"
                  />,
                );
              }
              for (const related of scope.relatedIds) {
                const pair = [scope.id, related].sort().join("|");
                if (drawnOverlaps.has(pair)) continue;
                drawnOverlaps.add(pair);
                const from = positions.get(related)!;
                edges.push(
                  <line
                    key={pair}
                    data-overlap={pair}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    strokeWidth=".3"
                    strokeDasharray="1 1"
                  />,
                );
              }
              return edges;
            })}
          </svg>
          {scopes.map((scope) => {
            const pos = positions.get(scope.id)!;
            const caps = workspace.profile.capabilities.filter(
              (cap) =>
                cap.scopeIds.includes(scope.id) && cap.scopeIds.length > 1,
            ).length;
            return (
              <button
                key={scope.id}
                className={`map-node ${scopeId === scope.id ? "selected" : ""}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => select(scope.id)}
                aria-pressed={scopeId === scope.id}
              >
                <GitBranch size={15} />
                <span>{scope.name}</span>
                <small>{caps} shared capabilities</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="z-map-key">
        <span>
          <i />
          Contained scope
        </span>
        <span>
          <Link2 size={12} />
          Overlapping responsibility
        </span>
      </div>
    </>
  );
}
export function Situation({
  workspace,
  scopeId,
  inspect,
  selectScope,
  navigate,
  shock,
}: ViewProps & {
  selectScope: (id: string) => void;
  navigate: (view: View) => void;
  shock: (id: string) => void;
}) {
  const profile = workspace.profile,
    ids = scopeSet(profile, scopeId);
  const objectives = profile.objectives.filter((item) => ids.has(item.scopeId));
  const claims = profile.claims.filter((item) => ids.has(item.scopeId));
  const over = profile.capabilities.filter(
    (cap) => committed(workspace, cap.id) > capabilityAmount(workspace, cap.id),
  );
  return (
    <div className="z-situation-grid">
      <div>
        <section className="z-question">
          <h2>
            {scopeId === "*"
              ? profile.question
              : profile.scopes.find((scope) => scope.id === scopeId)
                  ?.description}
          </h2>
        </section>
        {over.length > 0 && (
          <button className="z-alert" onClick={() => navigate("mandates")}>
            <TriangleAlert />
            <span>
              <strong>
                {over.length} shared capacity{" "}
                {over.length === 1 ? "conflict" : "conflicts"}
              </strong>
              Committed resources exceed revised availability. Mandates need
              review.
            </span>
            <ChevronRight size={16} />
          </button>
        )}
        <section className="z-section">
          <div className="section-heading">
            <h2>Objectives</h2>
            <small>Current → target</small>
          </div>
          <div className="z-objectives">
            {objectives.map((objective) => {
              const observed = workspace.outcomes
                .filter((outcome) => outcome.objectiveId === objective.id)
                .reduce((total, outcome) => total + outcome.observed, 0);
              const value = objective.baseline + observed;
              const progress =
                objective.target === objective.baseline
                  ? 1
                  : (value - objective.baseline) /
                    (objective.target - objective.baseline);
              return (
                <div className="objective-row" key={objective.id}>
                  <div>
                    <span>{objective.label}</span>
                    {objective.protection && (
                      <LockKeyhole
                        size={12}
                        className="objective-lock"
                        aria-label="Protected condition"
                      />
                    )}
                    <div className="progress-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="metric">
                    {number(value)}
                    <small>{objective.unit}</small>
                  </div>
                  <div className="target">
                    {objective.direction === "increase" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )}{" "}
                    {number(objective.target)}
                  </div>
                </div>
              );
            })}
            {!objectives.length && (
              <p className="z-empty">No objectives in this scope.</p>
            )}
          </div>
        </section>
        <section className="z-section">
          <div className="section-heading">
            <h2>System</h2>
          </div>
          <ScopeMap
            workspace={workspace}
            scopeId={scopeId}
            select={selectScope}
          />
        </section>
        <section className="z-section">
          <div className="section-heading">
            <h2>Stress the assumptions</h2>
            <small>Source revisions</small>
          </div>
          <div className="z-shocks">
            {profile.shocks.map((item) => (
              <button
                className="button"
                key={item.id}
                onClick={() => shock(item.id)}
                title={item.description}
              >
                <TriangleAlert size={14} />
                {item.name}
              </button>
            ))}
          </div>
        </section>
      </div>
      <aside className="z-inspector">
        <section className="z-section">
          <div className="section-heading">
            <h2>Capacity</h2>
            <span className="mono">{profile.horizonMonths} mo</span>
          </div>
          <Resources workspace={workspace} scopeId={scopeId} />
        </section>
        <section className="z-section">
          <div className="section-heading">
            <h2>Evidence</h2>
            <small>{claims.length}</small>
          </div>
          <div className="z-facts">
            {claims.map((claim) => (
              <button
                className="fact-row"
                key={claim.id}
                onClick={() => inspect({ kind: "claim", id: claim.id })}
              >
                {claim.status === "observed" ? (
                  <CircleDot aria-label="Observed" />
                ) : claim.status === "contested" ? (
                  <TriangleAlert aria-label="Contested" />
                ) : (
                  <CircleDashed aria-label="Assumed" />
                )}
                <span>
                  <strong>{claim.label}</strong>
                  <span>
                    {metric(claimValue(workspace, claim.id), claim.unit)}
                  </span>
                  <small>
                    {claim.source.author} · {claim.source.date}
                  </small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </div>
        </section>
        <button
          className="primary button"
          onClick={() => navigate("strategies")}
        >
          Compare strategies <ArrowRight size={16} />
        </button>
      </aside>
    </div>
  );
}
export function Strategies({
  workspace,
  scopeId,
  inspect,
  onAuthorize,
}: ViewProps & { onAuthorize: (id: string, rationale: string) => void }) {
  const profile = workspace.profile;
  const [selected, setSelected] = useState(profile.strategies[0].id);
  const [rationale, setRationale] = useState("");
  const evaluations = profile.strategies.map((item) =>
    evaluate(workspace, item.id),
  );
  const evaluation = evaluations.find((item) => item.strategyId === selected)!;
  const strategy = profile.strategies.find((item) => item.id === selected)!;
  const ids = scopeSet(profile, scopeId);
  const objectives = profile.objectives.filter((item) => ids.has(item.scopeId));
  return (
    <>
      <div className="z-strategy-grid" role="group" aria-label="Strategies">
        {profile.strategies.map((item, i) => (
          <button
            type="button"
            key={item.id}
            className={`strategy-card ${selected === item.id ? "selected" : ""} ${!evaluations[i].feasible ? "infeasible" : ""}`}
            onClick={() => setSelected(item.id)}
            aria-pressed={selected === item.id}
          >
            <div className="strategy-top">
              <h2>{item.name}</h2>
              {evaluations[i].feasible ? (
                <Check size={16} aria-label="Feasible" />
              ) : (
                <TriangleAlert size={16} aria-label="Infeasible" />
              )}
            </div>
            <p className="strategy-thesis">{item.thesis}</p>
            <div className="strategy-outcome">
              {objectives.slice(0, 2).map((objective) => {
                const value = evaluations[i].outcomes.find(
                  (entry) => entry.objectiveId === objective.id,
                )!.value;
                return (
                  <div key={objective.id}>
                    <span>{objective.label}</span>
                    <strong>
                      {number(value)}
                      <small> {objective.unit}</small>
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="strategy-footer">
              <span>{item.interventionIds.length} interventions</span>
              <span>
                {evaluations[i].feasible
                  ? "Within bounds"
                  : `${evaluations[i].violations.length} conflicts`}
              </span>
            </div>
          </button>
        ))}
      </div>
      <section className="z-section">
        <div className="section-heading">
          <h2>Consequences</h2>
          <small>Projection at {profile.horizonMonths} months</small>
        </div>
        <div
          className="table-wrap"
          role="region"
          aria-label="Strategy consequences"
          tabIndex={0}
        >
          <table className="z-comparison">
            <thead>
              <tr>
                <th scope="col">Objective</th>
                {profile.strategies.map((item) => (
                  <th
                    key={item.id}
                    className={selected === item.id ? "selected" : ""}
                    scope="col"
                  >
                    {item.name}
                  </th>
                ))}
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((objective) => (
                <tr key={objective.id}>
                  <td>
                    {objective.label}
                    {objective.protection && (
                      <LockKeyhole size={12} aria-label="Protected condition" />
                    )}
                    <small>{objective.unit}</small>
                  </td>
                  {evaluations.map((entry) => {
                    const outcome = entry.outcomes.find(
                      (o) => o.objectiveId === objective.id,
                    )!;
                    return (
                      <td
                        key={entry.strategyId}
                        className={`${selected === entry.strategyId ? "selected" : ""} ${!outcome.protected ? "negative" : ""}`}
                      >
                        {number(outcome.value)}
                        <small>
                          {outcome.delta >= 0 ? "+" : ""}
                          {number(outcome.delta)} from intervention
                        </small>
                      </td>
                    );
                  })}
                  <td>
                    {objective.direction === "increase" ? "≥" : "≤"}{" "}
                    {number(objective.target)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="z-situation-grid strategy-detail">
        <div>
          <section className="z-section">
            <div className="section-heading">
              <h2>{strategy.name}</h2>
              <small>Whole portfolio</small>
            </div>
            {evaluation.violations.length > 0 && (
              <div className="z-alert">
                <TriangleAlert />
                <div>
                  {evaluation.violations.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="z-timeline">
              {evaluation.schedule.map((entry) => {
                const intervention = profile.interventions.find(
                  (item) => item.id === entry.interventionId,
                )!;
                return (
                  <div className="timeline-item" key={entry.interventionId}>
                    <div className="timeline-row">
                      <span>{intervention.title}</span>
                      <div className="timeline-track">
                        <div
                          className="timeline-bar"
                          style={{
                            marginLeft: `${Math.min(95, (entry.start / profile.horizonMonths) * 100)}%`,
                            width: `${Math.max(2, Math.min(100 - (entry.start / profile.horizonMonths) * 100, ((entry.finish - entry.start) / profile.horizonMonths) * 100))}%`,
                          }}
                        />
                      </div>
                      <span>
                        {number(entry.start)}–{number(entry.finish)} mo
                      </span>
                    </div>
                    <p className="intervention-mechanism">
                      {intervention.mechanism}
                    </p>
                    {intervention.dependencies.length > 0 && (
                      <small className="muted">
                        <GitBranch size={12} />{" "}
                        {intervention.dependencies
                          .map(
                            (id) =>
                              profile.interventions.find(
                                (item) => item.id === id,
                              )?.title,
                          )
                          .join(" + ")}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="z-section">
            <div className="section-heading">
              <h2>Model inputs</h2>
              <small>Inspect to revise</small>
            </div>
            <div className="claim-chips">
              {evaluation.assumptions.map((id) => (
                <button
                  className="button"
                  key={id}
                  onClick={() => inspect({ kind: "claim", id })}
                >
                  {profile.claims.find((item) => item.id === id)?.label}
                  <span className="mono">
                    {number(claimValue(workspace, id))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="z-inspector">
          <div className="section-heading">
            <h2>Shared capacity</h2>
            <small>Committed + proposed</small>
          </div>
          <Resources workspace={workspace} evaluation={evaluation} />
        </aside>
      </div>
      <form
        className="z-decision-bar"
        onSubmit={(event) => {
          event.preventDefault();
          if (evaluation.feasible && rationale.trim())
            onAuthorize(selected, rationale);
        }}
      >
        <label className="sr-only" htmlFor="rationale">
          Decision rationale
        </label>
        <input
          id="rationale"
          className="z-rationale"
          maxLength={4000}
          placeholder="Why this strategy?"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
        <button
          className="button primary"
          type="submit"
          disabled={!evaluation.feasible || !rationale.trim()}
        >
          Authorize <ArrowRight size={16} />
        </button>
      </form>
    </>
  );
}
export function Mandates({
  workspace,
  scopeId,
  inspect,
  change,
  navigate,
}: ViewProps & { navigate: (view: View) => void }) {
  const ids = scopeSet(workspace.profile, scopeId);
  const mandates = workspace.mandates.filter((item) => ids.has(item.scopeId));
  const proposed = workspace.mandates.some(
    (item) => item.status === "proposed",
  );
  const advancing = workspace.mandates.some((item) =>
    ["accepted", "running", "blocked", "stopping"].includes(item.status),
  );
  return (
    <>
      {workspace.mandates.length > 0 && (
        <div className="mandate-controls">
          <span className="muted">Simulation · step {workspace.tick}</span>
          <div>
            {proposed && (
              <button className="button" onClick={() => change(acceptAll)}>
                <Check size={16} />
                Accept portfolio
              </button>
            )}
            <button
              className="button primary"
              onClick={() => change(stepAgents)}
              disabled={!advancing}
            >
              <Play size={15} />
              Advance
            </button>
          </div>
        </div>
      )}
      {mandates.length ? (
        <div className="z-mandate-list">
          {mandates.map((mandate) => {
            const intervention = workspace.profile.interventions.find(
              (item) => item.id === mandate.interventionId,
            )!;
            const agent = workspace.profile.agents.find(
              (item) => item.id === mandate.agentId,
            )!;
            return (
              <article className="mandate-row" key={mandate.id}>
                <div className="mandate-top">
                  <span className="agent-avatar" title={agent.name}>
                    {agent.initials}
                  </span>
                  <div>
                    <h2>{intervention.title}</h2>
                    <small>
                      {agent.name} · {findLabel(workspace, mandate.scopeId)}
                    </small>
                  </div>
                  <span className={`state-tag ${mandate.status}`}>
                    {mandate.status}
                  </span>
                  <div className="mandate-actions">
                    {mandate.status === "proposed" && (
                      <IconButton
                        icon={Check}
                        label={`Accept ${intervention.title}`}
                        onClick={() =>
                          change((w) => acceptMandate(w, mandate.id))
                        }
                      />
                    )}
                    {!["completed", "revoked", "stopping"].includes(
                      mandate.status,
                    ) && (
                      <IconButton
                        icon={Square}
                        label={`Stop ${intervention.title}`}
                        onClick={() =>
                          change((w) => revokeMandate(w, mandate.id))
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="mandate-detail">
                  <div
                    className="progress-track"
                    role="img"
                    aria-label={`Progress ${mandate.progress} of 3`}
                  >
                    <span
                      style={{ width: `${(mandate.progress / 3) * 100}%` }}
                    />
                  </div>
                  <p>{mandate.reason ?? intervention.mechanism}</p>
                  <div className="mandate-resources">
                    {mandate.resources.map((resource) => {
                      const cap = workspace.profile.capabilities.find(
                        (item) => item.id === resource.capabilityId,
                      )!;
                      return (
                        <span key={cap.id}>
                          {cap.label}{" "}
                          <strong>
                            {number(resource.consumed)} /{" "}
                            {metric(resource.amount, cap.unit)}
                          </strong>
                        </span>
                      );
                    })}
                  </div>
                  {mandate.dependencies.length > 0 && (
                    <small>
                      <GitBranch size={12} />{" "}
                      {mandate.dependencies
                        .map(
                          (id) =>
                            workspace.profile.interventions.find(
                              (item) =>
                                item.id ===
                                workspace.mandates.find((m) => m.id === id)
                                  ?.interventionId,
                            )?.title,
                        )
                        .join(" + ")}
                    </small>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="z-empty">
          <ShieldCheck size={30} />
          <h2>
            {workspace.mandates.length
              ? "No mandates in this scope."
              : "No authority delegated yet."}
          </h2>
          <p>
            A decision sets the resource ceilings and scope for each specialist.
          </p>
          <button className="button" onClick={() => navigate("strategies")}>
            Compare strategies <ArrowRight size={15} />
          </button>
        </div>
      )}
    </>
  );
}
const eventIcons = {
  claim: CircleDashed,
  decision: GitBranch,
  accepted: ShieldCheck,
  progress: Play,
  blocked: TriangleAlert,
  revoked: Square,
  outcome: Check,
  rejected: LockKeyhole,
};
export function Ledger({ workspace, scopeId, inspect }: ViewProps) {
  const ids = scopeSet(workspace.profile, scopeId);
  const events = workspace.events
    .filter((item) => ids.has(item.scopeId))
    .slice()
    .reverse();
  const outcomes = workspace.outcomes.filter((item) =>
    ids.has(
      workspace.profile.objectives.find(
        (objective) => objective.id === item.objectiveId,
      )!.scopeId,
    ),
  );
  return (
    <>
      {outcomes.length > 0 && (
        <section className="z-section">
          <div className="section-heading">
            <h2>Outcomes</h2>
            <small>Synthetic completion · deltas</small>
          </div>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Expected and observed outcomes"
          >
            <table className="z-outcome-table">
              <thead>
                <tr>
                  <th scope="col">Objective</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Observed</th>
                  <th scope="col">Difference</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((outcome) => {
                  const objective = workspace.profile.objectives.find(
                    (item) => item.id === outcome.objectiveId,
                  )!;
                  return (
                    <tr key={outcome.id}>
                      <td>
                        {objective.label}
                        <small>{outcome.source}</small>
                      </td>
                      <td>{metric(outcome.expected, objective.unit)}</td>
                      <td>{metric(outcome.observed, objective.unit)}</td>
                      <td>
                        {outcome.observed - outcome.expected >= 0 ? "+" : ""}
                        {number(outcome.observed - outcome.expected)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="z-section">
        <div className="section-heading">
          <h2>Trace</h2>
          <small>
            {events.length} events · revision {workspace.revision}
          </small>
        </div>
        <div className="z-ledger">
          {events.map((event) => {
            const Icon = eventIcons[event.kind];
            const decision = workspace.decisions.find(
              (item) => item.id === event.referenceId,
            );
            const claim = workspace.profile.claims.find(
              (item) => item.id === event.referenceId,
            );
            return (
              <article className="event-row" key={event.id}>
                <div className={`event-icon ${event.kind}`}>
                  <Icon size={15} />
                </div>
                <div className="event-body">
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                  <small>
                    {findLabel(workspace, event.scopeId)} ·{" "}
                    <time dateTime={event.createdAt}>
                      {event.createdAt.slice(0, 10)}{" "}
                      {event.createdAt.slice(11, 16)}
                    </time>
                  </small>
                </div>
                {decision && (
                  <IconButton
                    icon={ArrowRight}
                    label={`Inspect ${event.title} decision`}
                    onClick={() =>
                      inspect({ kind: "decision", id: decision.id })
                    }
                  />
                )}
                {claim && (
                  <IconButton
                    icon={ArrowRight}
                    label={`Inspect ${event.title} source`}
                    onClick={() => inspect({ kind: "claim", id: claim.id })}
                  />
                )}
              </article>
            );
          })}
          {!events.length && (
            <div className="z-empty">
              <Clock3 size={28} />
              <h2>No changes yet.</h2>
              <p>Source revisions, authority, and outcomes appear here.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
export function DecisionDetail({
  workspace,
  decision,
}: {
  workspace: Workspace;
  decision: Decision;
}) {
  const strategy = workspace.profile.strategies.find(
    (item) => item.id === decision.strategyId,
  )!;
  const changed = workspace.profile.claims.filter(
    (claim) =>
      decision.claimValues[claim.id] !== claimValue(workspace, claim.id),
  );
  return (
    <div className="decision-detail">
      <p className="decision-rationale">{decision.rationale}</p>
      <div className="source-meta">
        <span>{decision.authority}</span>
        <span>
          {decision.createdAt.slice(0, 10)} · revision {decision.revision}
        </span>
      </div>
      <div className="section-heading">
        <h3>{strategy.name}</h3>
        <span className="state-tag accepted">Frozen</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Objective</th>
              <th scope="col">Projection</th>
            </tr>
          </thead>
          <tbody>
            {decision.evaluation.outcomes.map((outcome) => {
              const objective = workspace.profile.objectives.find(
                (item) => item.id === outcome.objectiveId,
              )!;
              return (
                <tr key={objective.id}>
                  <td>{objective.label}</td>
                  <td>{metric(outcome.value, objective.unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3>Ceilings</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Capacity</th>
              <th scope="col">Authorized</th>
              <th scope="col">Available</th>
            </tr>
          </thead>
          <tbody>
            {decision.evaluation.resources
              .filter((entry) => entry.required > 0)
              .map((entry) => {
                const cap = workspace.profile.capabilities.find(
                  (item) => item.id === entry.capabilityId,
                )!;
                return (
                  <tr key={cap.id}>
                    <td>{cap.label}</td>
                    <td>{metric(entry.required, cap.unit)}</td>
                    <td>{metric(entry.available, cap.unit)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <h3>Source changes since authorization</h3>
      {changed.length ? (
        changed.map((claim) => (
          <p key={claim.id}>
            {claim.label}{" "}
            <strong>
              {number(decision.claimValues[claim.id])} →{" "}
              {metric(claimValue(workspace, claim.id), claim.unit)}
            </strong>
          </p>
        ))
      ) : (
        <p className="muted">Inputs unchanged.</p>
      )}
      <details className="frozen-inputs">
        <summary>Inputs ({workspace.profile.claims.length})</summary>
        {workspace.profile.claims.map((claim) => (
          <p key={claim.id}>
            {claim.label}{" "}
            <span className="mono">
              {metric(decision.claimValues[claim.id], claim.unit)}
            </span>
          </p>
        ))}
      </details>
    </div>
  );
}
export function ClaimDetail({
  workspace,
  claim,
  onSave,
}: {
  workspace: Workspace;
  claim: Claim;
  onSave: (value: number, revision: number) => void;
}) {
  const [value, setValue] = useState(String(claimValue(workspace, claim.id)));
  const [revision, setRevision] = useState(workspace.revision);
  return (
    <div className="z-source">
      <div className="source-meta">
        <span className={`state-tag ${claim.status}`}>{claim.status}</span>
        <span>
          {claim.source.author} · {claim.source.date}
        </span>
      </div>
      <h3>{claim.source.title}</h3>
      <blockquote>{claim.source.excerpt}</blockquote>
      {claim.dissent && (
        <div className="z-alert">
          <TriangleAlert size={16} />
          <p>{claim.dissent}</p>
        </div>
      )}
      <form
        className="z-fields"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(Number(value), revision);
        }}
      >
        <label>
          {claim.label}
          <div className="input-row">
            <input
              type="number"
              required
              min={claim.min}
              max={claim.max}
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <span>{claim.unit}</span>
          </div>
        </label>
        <small className="muted">
          {number(claim.min)}–{metric(claim.max, claim.unit)} · original{" "}
          {number(claim.value)}
        </small>
        <button
          className="button primary"
          type="submit"
          disabled={
            value === "" ||
            !Number.isFinite(Number(value)) ||
            revision !== workspace.revision
          }
        >
          Revise <ArrowRight size={15} />
        </button>
        {revision !== workspace.revision && (
          <div className="z-alert">
            <TriangleAlert size={16} />
            <span>
              Workspace changed. Current:{" "}
              {metric(claimValue(workspace, claim.id), claim.unit)}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setValue(String(claimValue(workspace, claim.id)));
                  setRevision(workspace.revision);
                }}
              >
                Reload source
              </button>
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
export function AgentDetail({
  workspace,
  agent,
  probe,
}: {
  workspace: Workspace;
  agent: Agent;
  probe: (id: string) => void;
}) {
  const mandates = workspace.mandates.filter(
    (item) => item.agentId === agent.id,
  );
  return (
    <div className="agent-detail">
      <p>{agent.role}</p>
      <div className="section-heading">
        <h3>Permitted scopes</h3>
      </div>
      <div className="claim-chips">
        {agent.scopeIds.map((id) => (
          <span className="state-tag" key={id}>
            {findLabel(workspace, id)}
          </span>
        ))}
      </div>
      <div className="section-heading">
        <h3>Actions</h3>
      </div>
      <div className="claim-chips">
        {agent.actions.map((action) => (
          <span className="state-tag" key={action}>
            {action}
          </span>
        ))}
      </div>
      <div className="section-heading">
        <h3>Mandates</h3>
        <small>{mandates.length}</small>
      </div>
      {mandates.map((mandate) => (
        <div className="agent-mandate" key={mandate.id}>
          <span>
            {
              workspace.profile.interventions.find(
                (item) => item.id === mandate.interventionId,
              )?.title
            }
          </span>
          <span className={`state-tag ${mandate.status}`}>
            {mandate.status}
          </span>
          <IconButton
            icon={LockKeyhole}
            label="Test an unauthorized resource expansion"
            onClick={() => probe(mandate.id)}
          />
        </div>
      ))}
      <small className="muted">
        Local simulated specialist. Each mandate has its own ceiling; scope
        containment grants no additional rights.
      </small>
    </div>
  );
}
