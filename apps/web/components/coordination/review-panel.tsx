"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronRight, GitBranch, Link2, LockKeyhole, MessageSquare, TriangleAlert } from "lucide-react";
import { currentClaimSource, respondToDecision } from "@/lib/coordination/core";
import { responseOptions, reviewDecision, reviewWorld } from "@/lib/coordination/review";
import type { Decision, Workspace } from "@/lib/coordination/types";
import { metric, number } from "./primitives";
import type { Inspect, View } from "./views";

export function CourseReviews({ workspace, scopeId, inspect }: {
  workspace: Workspace; scopeId: string; inspect: (value: Inspect) => void;
}) {
  const reviews = reviewWorld(workspace, scopeId).slice().reverse();
  if (!reviews.length) return null;
  return <section className="course-reviews z-section" aria-label="Committed courses">
    {reviews.slice(0, 3).map(review => {
      const strategy = workspace.profile.strategies.find(s => s.id === review.strategyId)!;
      const decisive = review.issues.find(issue => issue.kind !== "outcome") ?? review.issues[0];
      const changed = review.objectives.filter(row => Math.abs(row.frozen - row.projected) > 1e-7).slice(0, 2);
      return <button className={`course-review ${review.conditional ? "needs-review" : ""}`} aria-label={`Review ${strategy.name}`} key={review.decisionId} onClick={event => { event.currentTarget.focus({ preventScroll: true }); inspect({ kind: "decision", id: review.decisionId }); }}>
        <span className="course-review-symbol">{decisive ? <TriangleAlert size={18} /> : <Check size={18} />}</span>
        <span className="course-review-copy"><small>{strategy.name}</small><strong>{decisive?.title ?? (review.state === "complete" ? "Course completed" : "Within the current envelope")}</strong>
          <span className="course-review-effects">{changed.map(row => {
            const objective = workspace.profile.objectives.find(o => o.id === row.objectiveId)!;
            return <span key={row.objectiveId}>{objective.label} <s>{number(row.frozen)}</s> <ArrowRight size={11} /> <b>{metric(row.projected, objective.unit)}</b></span>;
          })}</span>
        </span><span className="course-review-open">Review <ArrowRight size={15} /></span>
      </button>;
    })}
  </section>;
}

export function DecisionReconsideration({ workspace, decision, record, inspect, change, navigate }: {
  workspace: Workspace; decision: Decision; record: ReactNode; inspect: (value: Inspect) => void;
  change: (transform: (current: Workspace) => Workspace) => boolean; navigate: (view: View) => void;
}) {
  const review = reviewDecision(workspace, decision.id);
  const profile = workspace.profile;
  const strategy = profile.strategies.find(s => s.id === decision.strategyId)!;
  const alternatives = responseOptions(workspace, decision.id);
  const blockers = review.issues.filter(issue => issue.kind !== "outcome");
  const [action, setAction] = useState<"retain" | "investigate" | "stop">("investigate");
  const draftKey = `zenith.review-draft.${profile.id}.${decision.id}`;
  const [rationale, setRationale] = useState(() => {
    try { const text = sessionStorage.getItem(draftKey) ?? ""; return text.length <= 4000 ? text : ""; } catch { return ""; }
  });
  const [openedRevision, setOpenedRevision] = useState(workspace.revision);
  const [saved, setSaved] = useState(false);
  const stale = openedRevision !== workspace.revision;
  const receipts = workspace.events.filter(event => event.kind === "review" && event.review?.decisionId === decision.id).slice().reverse();
  const incomplete = workspace.mandates.some(m => m.decisionId === decision.id && !["completed", "revoked", "stopping"].includes(m.status));
  const submit = () => {
    if (!rationale.trim() || stale) return;
    if (change(current => respondToDecision(current, decision.id, { action, rationale: rationale.trim() }, openedRevision))) {
      setRationale(""); setOpenedRevision(openedRevision + 1); setSaved(true);
      try { sessionStorage.removeItem(draftKey); } catch { /* The recorded response is already durable. */ }
    }
  };
  return <>
    <div className="reconsideration">
      <div className="review-intent"><span className={`state-tag ${review.conditional ? "blocked" : "accepted"}`}>{review.state}</span><h3>{strategy.name}</h3><p>{decision.rationale}</p></div>
      {blockers.length > 0 && <div className="review-issues">{blockers.map(issue => <div className={`review-issue ${issue.kind}`} key={issue.id}>
        {issue.kind === "outcome" ? <GitBranch size={16} /> : <TriangleAlert size={16} />}<div><strong>{issue.title}</strong><p>{issue.detail}</p></div>
      </div>)}</div>}
      <div className="section-heading"><h3>Consequences</h3><small>{profile.horizonMonths} mo · {review.conditional ? "conditional" : "reassessed"}</small></div>
      <div className="table-wrap review-comparison" role="region" aria-label="Committed and reassessed consequences" tabIndex={0}><table>
        <thead><tr><th scope="col">Objective</th><th scope="col">Authorized</th><th scope="col">Current</th><th scope="col">Reassessed</th></tr></thead>
        <tbody>{review.objectives.map(row => {
          const objective = profile.objectives.find(o => o.id === row.objectiveId)!;
          return <tr key={objective.id}><td>{objective.label}{objective.protection && <LockKeyhole size={11} aria-label="Protected condition" />}<small>{objective.unit} · {objective.direction === "increase" ? "≥" : "≤"} {number(objective.target)}</small></td><td>{number(row.frozen)}</td><td>{number(row.current)}</td><td className={!row.protected ? "negative" : ""}><strong>{number(row.projected)}</strong>{Math.abs(row.projected - row.frozen) > 1e-7 && <small>{row.projected - row.frozen > 0 ? "+" : ""}{number(row.projected - row.frozen)}</small>}</td></tr>;
        })}</tbody>
      </table></div>
      <div className="review-grid">
        <section><div className="section-heading"><h3>Changed evidence</h3><small>{review.changes.length}</small></div>
          {review.changes.map(change => {
            const claim = profile.claims.find(c => c.id === change.claimId)!;
            const source = currentClaimSource(workspace, claim.id);
            return <button className="review-source" key={claim.id} onClick={() => inspect({ kind: "claim", id: claim.id })}>
              <span><strong>{claim.label}</strong><span>{number(change.before)} <ArrowRight size={12} /> {metric(change.value, claim.unit)}</span><small>{source.title} · {source.date}</small>
                <small className="review-causal-path"><Link2 size={12} />{change.interventionIds.map(id => profile.interventions.find(i => i.id === id)?.title).join(" → ")}</small></span><ChevronRight size={14} />
            </button>;
          })}
          {!review.changes.length && <p className="muted">No changed inputs.</p>}
        </section>
        <section><div className="section-heading"><h3>Participants</h3></div><div className="review-participants">{review.participants.map(participant => <div key={participant.scopeId}><strong>{profile.scopes.find(s => s.id === participant.scopeId)?.name}</strong><small>{participant.steward}</small><small>{participant.role}</small></div>)}</div></section>
      </div>
      {alternatives.length > 0 && <section className="review-options">
        <div className="section-heading"><h3>Alternatives</h3><small>After stop acknowledgement</small></div>
        <div className="review-option-list">{alternatives.map(option => <details className="review-option" key={option.strategyId}>
          <summary><strong>{option.name}</strong><span className={option.evaluation.feasible ? "positive" : "negative"}>{option.evaluation.feasible ? <Check size={15} aria-label="Within bounds" /> : <TriangleAlert size={15} aria-label="Blocked" />}{option.interventionIds.length} interventions</span></summary>
          <div className="review-option-effects">{option.evaluation.outcomes.map(outcome => {
            const objective = profile.objectives.find(o => o.id === outcome.objectiveId)!;
            return <div key={objective.id}><span>{objective.label}</span><strong className={!outcome.protected ? "negative" : ""}>{metric(outcome.value, objective.unit)}</strong></div>;
          })}</div>
          {option.evaluation.violations.map(message => <p className="negative" key={message}>{message}</p>)}
          <details className="review-option-basis"><summary>Basis</summary><ul>{option.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul></details>
        </details>)}</div>
      </section>}
      <details className="strategy-disclosure"><summary>Capacity</summary><div className="review-resource-list">{review.resources.map(resource => {
        const cap = profile.capabilities.find(c => c.id === resource.capabilityId)!;
        return <div key={cap.id} className={resource.overcommitted ? "negative" : ""}><strong>{cap.label}</strong><span>{metric(resource.consumed, cap.unit)} spent · {number(resource.reserved)} reserved</span><small>{cap.provider} · {number(resource.available)} uncommitted</small></div>;
      })}</div></details>
      <details className="strategy-disclosure"><summary>Basis</summary><ul className="review-basis">{review.assumptions.map(item => <li key={item}>{item}</li>)}</ul></details>
      <details className="strategy-disclosure review-record"><summary>Record</summary>{record}</details>
      <section className="review-response"><div className="section-heading"><h3>Response</h3><MessageSquare size={15} /></div>
        <form className="z-fields" onSubmit={event => { event.preventDefault(); submit(); }}>
          <label className="sr-only" htmlFor="review-action">Response</label><select id="review-action" value={action} onChange={e => { setAction(e.target.value as typeof action); setSaved(false); }}><option value="investigate">Investigate</option><option value="retain">Retain intent</option><option value="stop" disabled={!incomplete}>Stop course</option></select>
          <label className="sr-only" htmlFor="review-reason">Review rationale</label><textarea id="review-reason" required maxLength={4000} rows={3} placeholder="What remains valid, what must change, and what evidence comes next?" value={rationale} onChange={e => { setRationale(e.target.value); setSaved(false); try { sessionStorage.setItem(draftKey, e.target.value); } catch { /* Keep editing in memory. */ } }} />
          {stale && <p className="negative" role="alert">The world changed. Reopen this review before responding.</p>}
          {action === "stop" && <small className="muted">Unspent reservations release after stop acknowledgement.</small>}
          <div className="review-response-controls"><small className="muted">{saved ? "Response recorded." : "A response does not clear the underlying condition."}</small><button className="button primary" disabled={!rationale.trim() || stale} type="submit">{action === "stop" ? "Request stop" : "Record"}<ArrowRight size={15} /></button></div>
        </form>
        {receipts.length > 0 && <div className="review-receipts">{receipts.slice(0, 3).map(event => <div key={event.id}><small>{event.review!.action} · r{event.review!.reviewedRevision}</small><p>{event.review!.rationale}</p></div>)}</div>}
      </section>
      <button className="text-button" onClick={() => navigate(action === "stop" && saved ? "mandates" : "strategies")}>{action === "stop" && saved ? "Mandates" : "Strategies"}<ArrowRight size={15} /></button>
    </div>
    <div className="review-print">{record}</div>
  </>;
}
