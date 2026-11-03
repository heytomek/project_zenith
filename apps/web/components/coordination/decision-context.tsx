"use client";

import { ArrowRight, BookOpen, Check, ChevronRight, CircleDashed, Compass, GitBranch, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { inspectWorld, type WorldAttention, type WorldPhase } from "@/lib/coordination/insights";
import type { Workspace } from "@/lib/coordination/types";
import { IconButton } from "./primitives";
import type { Inspect, View } from "./views";

const phases: WorldPhase[] = ["understand", "choose", "delegate", "act", "review"];
const icons = { understand: Compass, choose: GitBranch, delegate: ShieldCheck, act: CircleDashed, review: BookOpen };

export function DecisionContext({ workspace, scopeId, view, guided, evidenceViewed, inspect, navigate, dismiss }: {
  workspace: Workspace; scopeId: string; view: View; guided: boolean; evidenceViewed: boolean;
  inspect: (inspection: Inspect) => void; navigate: (view: View) => void; dismiss: () => void;
}) {
  const insights = inspectWorld(workspace, scopeId);
  const initialReview = !workspace.decisions.length && insights.phase === "understand" && !insights.attention.some(a => a.kind === "capacity" || a.kind === "mandate");
  const phase = initialReview && (evidenceViewed || !guided) ? "choose" : insights.phase;
  const next = phase !== insights.phase ? { label: "Compare strategies", kind: "navigate" as const, view: "strategies" as const } : insights.next;
  const Icon = icons[phase];
  const summary = insights.summary;
  const title = phase === "understand" && next.kind === "decision" ? "Decision required" : phase === "delegate" ? `${summary.proposed} mandates ready` : phase === "act" ? `${summary.active} active mandates` : phase === "review" ? `${summary.completed} completed mandates` : phase === "choose" ? `${workspace.profile.strategies.length} alternatives` : insights.attention.some(a => a.kind === "capacity") ? "Capacity needs review" : `${workspace.profile.claims.length} sources`;
  const detail = phase === "review" ? `${summary.changedClaims} source${summary.changedClaims === 1 ? "" : "s"} changed` : phase === "delegate" ? "Scoped authority · fixed ceilings" : phase === "act" ? `${summary.blocked} waiting · simulated execution` : phase === "choose" ? `${workspace.profile.objectives.length} objectives · ${workspace.profile.horizonMonths} months` : insights.attention[0]?.detail;
  const showAction = next.kind !== "navigate" || next.view !== view;
  return <div className="decision-context" data-phase={phase}>
    <div className="context-phase"><Icon size={19} aria-hidden="true" /></div>
    <div className="context-copy"><strong>{title}</strong><small>{detail}</small></div>
    <div className="context-progress" role="img" aria-label={`Decision cycle: ${phase}`}>
      {phases.map((item, i) => <span key={item} className={item === phase ? "active" : i < phases.indexOf(phase) ? "completed" : ""} />)}
    </div>
    {showAction && <button className="button context-action" onClick={() => next.kind !== "navigate" && next.referenceId ? inspect({ kind: next.kind, id: next.referenceId }) : navigate(next.view)}>{next.label}<ArrowRight size={15} /></button>}
    {guided && <IconButton icon={X} label="Skip guide" onClick={dismiss} />}
  </div>;
}

export function Attention({ workspace, scopeId, inspect, navigate }: {
  workspace: Workspace; scopeId: string; inspect: (inspection: Inspect) => void; navigate: (view: View) => void;
}) {
  const items = inspectWorld(workspace, scopeId).attention;
  if (!items.length) return null;
  const open = (item: WorldAttention) => {
    if (item.referenceId && (item.kind === "capacity" || item.kind === "evidence")) inspect({ kind: "claim", id: item.referenceId });
    else if (item.referenceId && item.kind === "outcome") inspect({ kind: "decision", id: item.referenceId });
    else navigate(item.view);
  };
  return <section className="z-section">
    <div className="section-heading"><h2>Attention</h2><small>{items.length}</small></div>
    <div className="attention-list">{items.map(item => <button className={`attention-row ${item.severity}`} key={item.id} onClick={() => open(item)}>
      {item.severity === "warning" ? <TriangleAlert size={16} /> : <Check size={16} />}
      <span><strong>{item.title}</strong><small className="attention-detail">{item.detail}</small></span><ChevronRight size={15} />
    </button>)}</div>
  </section>;
}
