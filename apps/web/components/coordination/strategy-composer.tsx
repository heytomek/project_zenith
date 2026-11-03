"use client";

import { useState } from "react";
import { ArrowRight, Check, GitBranch, Link2, LockKeyhole, TriangleAlert } from "lucide-react";
import { addStrategy, previewStrategy, strategySelection } from "@/lib/coordination/core";
import type { Workspace } from "@/lib/coordination/types";
import { Dialog, metric, number } from "./primitives";
import { useComposerDraft } from "./use-strategy-draft";

export function StrategyComposer({ workspace, initialIds, onClose, onSave }: {
  workspace: Workspace;
  initialIds: string[];
  onClose: () => void;
  onSave: (transform: (current: Workspace) => Workspace, id: string) => boolean;
}) {
  const profile = workspace.profile;
  const [draft, saveDraft] = useComposerDraft(workspace, initialIds);
  const { requested, name, thesis } = draft;
  const [openedRevision] = useState(workspace.revision);
  const [error, setError] = useState("");
  const selected = strategySelection(workspace, requested);
  const evaluation = previewStrategy(workspace, selected);
  const stale = openedRevision !== workspace.revision;
  const unavailable = new Set(workspace.mandates.filter(m => m.status !== "revoked").map(m => m.interventionId));
  const toggle = (id: string) => {
    setError("");
    saveDraft({ ...draft, requested: requested.includes(id) ? requested.filter(item => item !== id) : [...requested, id] });
  };
  const save = () => {
    try {
      const input = { name: name.trim(), thesis: thesis.trim(), interventionIds: selected };
      const candidate = addStrategy(workspace, input, openedRevision);
      const id = candidate.profile.strategies.at(-1)!.id;
      if (onSave(current => addStrategy(current, input, openedRevision), id)) {
        saveDraft({ name: "", thesis: "", requested: [] });
        onClose();
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Check this strategy."); }
  };
  return (
    <Dialog title="Compose" className="composer-dialog" onClose={onClose} footer={
      <div className="composer-footer">
        <span className="muted">{selected.length} interventions · {evaluation.feasible ? "Within bounds" : `${evaluation.violations.length} conflicts`}</span>
        <button className="button primary" onClick={save} disabled={!name.trim() || !thesis.trim() || !selected.length || stale}>Save strategy <ArrowRight size={16} /></button>
      </div>
    }>
      <div className="composer-controls z-fields">
        <label>Name<input data-autofocus maxLength={80} placeholder="A course worth comparing" value={name} onChange={e => saveDraft({ ...draft, name: e.target.value })} /></label>
        <label>Intent<input maxLength={1000} placeholder="What makes this approach different?" value={thesis} onChange={e => saveDraft({ ...draft, thesis: e.target.value })} /></label>
      </div>
      {stale && <p className="negative" role="alert">The world changed. Reopen Compose to use the current revision.</p>}
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="composer-layout">
        <div className="composer-picks" role="group" aria-label="Interventions">
          {profile.interventions.map(intervention => {
            const included = selected.includes(intervention.id);
            const required = included && !requested.includes(intervention.id);
            const assigned = unavailable.has(intervention.id);
            return <div key={intervention.id} className={`intervention-choice ${included ? "selected" : ""} ${required ? "required" : ""} ${assigned ? "unavailable" : ""}`}>
              <input id={`compose-${intervention.id}`} type="checkbox" checked={included} disabled={required || assigned} onChange={() => toggle(intervention.id)} aria-label={intervention.title} />
              <span><label htmlFor={`compose-${intervention.id}`}><strong>{intervention.title}</strong></label><small>{profile.scopes.find(s => s.id === intervention.scopeId)?.name} · {intervention.leadMonths} mo{assigned ? " · Already mandated" : ""}</small>
                <details><summary>Mechanism</summary><p>{intervention.mechanism}</p></details>
                {intervention.dependencies.length > 0 && <small className="composer-dependency"><Link2 size={12} />{intervention.dependencies.map(id => profile.interventions.find(i => i.id === id)?.title).join(" + ")}</small>}
                {required && <small className="composer-dependency"><LockKeyhole size={12} />Required dependency</small>}
              </span>
              {included && <Check size={15} aria-hidden="true" />}
            </div>;
          })}
        </div>
        <aside className="composer-preview" aria-label="Strategy preview">
          <div className="section-heading"><h3>Consequences</h3><small>{profile.horizonMonths} mo</small></div>
          {evaluation.outcomes.map(outcome => {
            const objective = profile.objectives.find(o => o.id === outcome.objectiveId)!;
            return <div className={`composer-impact ${!outcome.protected ? "negative" : ""}`} key={objective.id}>
              <span>{objective.label}{objective.protection && <LockKeyhole size={11} aria-label="Protected condition" />}</span>
              <strong>{metric(outcome.value, objective.unit)}</strong>
            </div>;
          })}
          <div className="section-heading"><h3>Capacity</h3><GitBranch size={14} /></div>
          <div className="composer-capacity">
            {evaluation.resources.filter(r => r.required > 0 || r.committed > 0).map(resource => {
              const cap = profile.capabilities.find(c => c.id === resource.capabilityId)!;
              return <div className={resource.required > resource.available ? "negative" : ""} key={cap.id}><span>{cap.label}</span><strong>{number(resource.required)} / {metric(resource.available, cap.unit)}</strong></div>;
            })}
          </div>
          {evaluation.violations.length > 0 && <div className="z-alert composer-conflicts"><TriangleAlert size={16} /><div>{evaluation.violations.map(v => <p key={v}>{v}</p>)}</div></div>}
        </aside>
      </div>
    </Dialog>
  );
}
