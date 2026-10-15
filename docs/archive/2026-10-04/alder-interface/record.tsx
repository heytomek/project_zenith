"use client";
import { useState } from "react";
import { FileText, Plus, Printer, Save, SquarePen, X } from "lucide-react";
import { EVIDENCE } from "@/lib/commons/evidence";
import {
  BASELINE,
  MODEL_VERSION,
  PATHWAYS,
  PATHWAY_COPY,
  evaluate,
  number,
  type Pathway,
} from "@/lib/commons/model";
import {
  type Decision,
  type DecisionFields,
  type Workspace,
  decisionFieldsSchema,
} from "@/lib/commons/workspace";
export type EditingDecision = { pathway: Pathway; parent: Decision | null };
type ObservationEntry = {
  month: string;
  remaining: string;
  note: string;
  expanded: boolean;
};
const EMPTY_OBSERVATION: ObservationEntry = {
  month: "3",
  remaining: "",
  note: "",
  expanded: false,
};
const pathwayLabel = (pathway: Pathway) =>
  PATHWAYS.some((p) => p.id === pathway.id)
    ? {
        current: "Existing rota",
        coordinate: "Shared rota",
        prevent: "Retrofit",
      }[pathway.kind]
    : pathway.title;
function splitAction(action: string) {
  const end = action.indexOf(". ");
  return end < 0
    ? { title: action, detail: "" }
    : { title: action.slice(0, end + 1), detail: action.slice(end + 2) };
}
export function RecordView({
  workspace,
  selectedId,
  selectedPathway,
  editing,
  select,
  start,
  cancel,
  save,
  observe,
}: {
  workspace: Workspace;
  selectedId: string | null;
  selectedPathway: Pathway;
  editing: EditingDecision | null;
  select: (id: string) => void;
  start: (parent: Decision | null) => void;
  cancel: () => void;
  save: (fields: DecisionFields, editing: EditingDecision) => boolean;
  observe: (
    decisionId: string,
    month: number,
    remaining: number,
    note: string,
  ) => boolean;
}) {
  const selected =
    workspace.decisions.find((d) => d.id === selectedId) ??
    workspace.decisions.at(-1);
  const referenceDate = Math.max(
    0,
    ...[
      ...workspace.decisions,
      ...workspace.challenges,
      ...workspace.observations,
    ].map((item) => Date.parse(item.createdAt)),
  );
  return (
    <>
      <header className="page-heading no-print">
        <h1>Decisions</h1>
        <button
          className="icon-button"
          onClick={() => start(null)}
          disabled={!!editing}
          aria-label="New decision"
          title="New decision"
        >
          <Plus size={18} />
        </button>
      </header>
      <div className="record-layout">
        <aside className="record-index">
          <h2>
            History{" "}
            <span className="record-count">{workspace.decisions.length}</span>
          </h2>
          {workspace.decisions.length > 0 && (
            <div className="mobile-record-history">
              <label htmlFor="record-history">Decision</label>
              <select
                id="record-history"
                value={selected?.id ?? ""}
                disabled={!!editing}
                onChange={(e) => select(e.target.value)}
              >
                {[...workspace.decisions].reverse().map((d, i) => (
                  <option value={d.id} key={d.id} title={d.action}>
                    #{workspace.decisions.length - i}
                    {d.parentId ? " ↳" : ""} · {splitAction(d.action).title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {workspace.decisions.length > 0 && (
            <nav aria-label="Saved decision versions" className="record-list">
              {[...workspace.decisions].reverse().map((d, i) => (
                <button
                  key={d.id}
                  title={d.action}
                  disabled={!!editing}
                  className={selected?.id === d.id && !editing ? "active" : ""}
                  aria-current={
                    selected?.id === d.id && !editing ? "true" : undefined
                  }
                  onClick={() => select(d.id)}
                >
                  <small>
                    #{workspace.decisions.length - i}
                    {d.parentId ? " ↳" : ""}
                  </small>
                  <strong>{splitAction(d.action).title}</strong>
                  <small>
                    {new Date(d.createdAt).toLocaleDateString("en-US")}
                  </small>
                </button>
              ))}
            </nav>
          )}
        </aside>
        <div className="record-main">
          {editing ? (
            <DecisionForm
              key={editing.parent?.id ?? "new"}
              editing={editing}
              referenceDate={referenceDate}
              currentPathway={selectedPathway}
              save={save}
              cancel={cancel}
            />
          ) : selected ? (
            <DecisionDocument
              decision={selected}
              workspace={workspace}
              revise={() => start(selected)}
              observe={observe}
            />
          ) : (
            <div className="record-empty">
              <FileText size={28} strokeWidth={1.3} />
              <h2 className="empty-title">No decisions</h2>
              <button className="button primary" onClick={() => start(null)}>
                <Plus size={16} /> New decision
              </button>
              <p className="fine-print">{pathwayLabel(selectedPathway)}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function DecisionForm({
  editing,
  referenceDate,
  currentPathway,
  save,
  cancel,
}: {
  editing: EditingDecision;
  referenceDate: number;
  currentPathway: Pathway;
  save: (fields: DecisionFields, editing: EditingDecision) => boolean;
  cancel: () => void;
}) {
  const [draftDate] = useState(() => Math.max(referenceDate, Date.now()));
  const date = new Date(draftDate);
  date.setDate(date.getDate() + 30);
  const review = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [fields, setFields] = useState<DecisionFields>(
    editing.parent ?? {
      action: "",
      rationale: "",
      steward: "",
      authority: "",
      consent: PATHWAY_COPY[editing.pathway.kind].consent,
      reviewDate: review,
      success: "",
      reversal: "",
    },
  );
  const [error, setError] = useState("");
  const [useExploration, setUseExploration] = useState(false);
  const proposalPathway = useExploration ? currentPathway : editing.pathway;
  const run = evaluate(proposalPathway);
  const completed = Object.keys(decisionFieldsSchema.shape).filter(
    (key) => fields[key as keyof DecisionFields].trim().length > 0,
  ).length;
  const field = (
    key: keyof DecisionFields,
    label: string,
    help: string,
    rows = 2,
  ) => (
    <div className="record-field">
      <label htmlFor={`decision-${key}`}>{label}</label>
      <p id={`help-${key}`} className="sr-only">
        {help}
      </p>
      {key === "reviewDate" ? (
        <input
          id={`decision-${key}`}
          type="date"
          value={fields[key]}
          onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          required
          aria-describedby={`help-${key}`}
        />
      ) : (
        <textarea
          id={`decision-${key}`}
          value={fields[key]}
          onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          required
          maxLength={key === "steward" ? 200 : 3000}
          rows={rows}
          aria-describedby={`help-${key}`}
        />
      )}
    </div>
  );
  return (
    <form
      className="decision-form"
      onSubmit={(e) => {
        e.preventDefault();
        const checked = decisionFieldsSchema.safeParse(
          Object.fromEntries(
            Object.keys(decisionFieldsSchema.shape).map((k) => [
              k,
              fields[k as keyof DecisionFields],
            ]),
          ),
        );
        if (!checked.success) {
          setError("Complete all eight fields.");
          return;
        }
        if (save(checked.data, { ...editing, pathway: proposalPathway }))
          setError("");
      }}
    >
      <div className="document-toolbar">
        <h2 className="document-title">
          {editing.parent ? "Revision" : "New decision"}
        </h2>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            aria-label="Save decision"
            title="Save decision"
          >
            <Save size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={cancel}
            aria-label="Cancel decision"
            title="Cancel decision"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="draft-progress">
        <span>{completed}/8</span>
        <progress
          aria-label="Draft fields prepared"
          value={completed}
          max={8}
        />
      </div>
      {editing.parent && (
        <div className="record-field">
          <label htmlFor="revision-source">Assumptions</label>
          <select
            id="revision-source"
            value={useExploration ? "current" : "recorded"}
            onChange={(e) => setUseExploration(e.target.value === "current")}
          >
            <option value="recorded">
              Recorded: {pathwayLabel(editing.pathway)}
            </option>
            <option value="current">
              Current: {pathwayLabel(currentPathway)}
            </option>
          </select>
        </div>
      )}
      <div className="snapshot-note">
        <strong>{pathwayLabel(proposalPathway)}</strong>
        <span>
          {number(run.remaining)} needs · {number(run.workHours)} h · month 12
        </span>
        <small>
          {proposalPathway.assumptions.voluntaryHours} h/mo ·{" "}
          {proposalPathway.assumptions.leadMonths} months lead ·{" "}
          {proposalPathway.assumptions.reductionPercent}% reduction
        </small>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <section className="form-section" aria-labelledby="proposal-heading">
        <h3 id="proposal-heading">Experiment</h3>
        {field(
          "action",
          "Action",
          "Define a bounded experiment or action, not a commitment on behalf of others.",
        )}
        {field(
          "rationale",
          "Rationale",
          "Explain the tradeoff and why the other pathways were not chosen.",
          3,
        )}
      </section>
      <section className="form-section" aria-labelledby="agreement-heading">
        <h3 id="agreement-heading">Agreement</h3>
        <div className="form-pair">
          {field(
            "steward",
            "Steward",
            "A proposed person or group; no identity is verified.",
          )}
          {field(
            "authority",
            "Authority",
            "Name the real decision process, or state what is not yet established.",
          )}
        </div>
        {field(
          "consent",
          "Consent",
          "Include affected residents, contributors and any right to decline.",
        )}
      </section>
      <section className="form-section" aria-labelledby="review-heading">
        <h3 id="review-heading">Review</h3>
        <div className="form-pair">
          {field(
            "reviewDate",
            "Review date",
            "A date to revisit this draft; this does not create a reminder.",
          )}
          {field(
            "success",
            "Success criteria",
            "Name observations you can collect, including harm or uneven benefits.",
            3,
          )}
        </div>
        {field(
          "reversal",
          "Stop conditions",
          "State reversal conditions and what cannot be undone.",
          3,
        )}
      </section>
      <div className="form-actions">
        <button
          className="icon-button"
          aria-label="Save decision"
          title="Save decision"
        >
          <Save size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={cancel}
          aria-label="Cancel decision"
          title="Cancel decision"
        >
          <X size={18} />
        </button>
      </div>
    </form>
  );
}
function DecisionDocument({
  decision: d,
  workspace,
  revise,
  observe,
}: {
  decision: Decision;
  workspace: Workspace;
  revise: () => void;
  observe: (
    id: string,
    month: number,
    remaining: number,
    note: string,
  ) => boolean;
}) {
  const action = splitAction(d.action);
  const run = evaluate(d.pathway),
    stress = evaluate(d.pathway, true);
  const [entries, setEntries] = useState<Record<string, ObservationEntry>>({});
  const entry = entries[d.id] ?? EMPTY_OBSERVATION;
  const { month, remaining, note, expanded: showObservation } = entry;
  function updateEntry(patch: Partial<ObservationEntry>) {
    setEntries((previous) => ({
      ...previous,
      [d.id]: { ...EMPTY_OBSERVATION, ...previous[d.id], ...patch },
    }));
  }
  const observations = workspace.observations.filter(
    (o) => o.decisionId === d.id,
  );
  return (
    <article className="decision-document">
      <div className="document-toolbar">
        <div className="document-meta">
          <span className="compact-badge">
            {d.parentId ? "Revision" : "Proposal"}
          </span>
          <span>{pathwayLabel(d.pathway)}</span>
          <time dateTime={d.createdAt}>
            {new Date(d.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
        <div className="toolbar-actions no-print">
          <button
            className="icon-button"
            onClick={() => window.print()}
            aria-label="Print decision"
            title="Print decision"
          >
            <Printer size={17} />
          </button>
          <button
            className="icon-button"
            onClick={revise}
            aria-label="Revise decision"
            title="Revise decision"
          >
            <SquarePen size={17} />
          </button>
        </div>
      </div>
      <h2 className="document-title">{action.title}</h2>
      {action.detail && (
        <p className="decision-action preserve-lines">{action.detail}</p>
      )}
      <section>
        <h3>Rationale</h3>
        <p className="preserve-lines">{d.rationale}</p>
      </section>
      <section>
        <h3>Projection</h3>
        <dl className="record-metrics">
          <div>
            <dt>Needs · month 12</dt>
            <dd>{number(run.remaining)}</dd>
          </div>
          <div>
            <dt>Work · 12 months</dt>
            <dd>{number(run.workHours)} h</dd>
          </div>
          <div>
            <dt>Recurring · month 12</dt>
            <dd>{number(run.recurringAtEnd)} / month</dd>
          </div>
          <div>
            <dt>Needs · stress case</dt>
            <dd>{number(stress.remaining)}</dd>
          </div>
        </dl>
        <details>
          <summary>Model & assumptions</summary>
          <dl className="facts">
            <div>
              <dt>Extra hours</dt>
              <dd>{d.pathway.assumptions.voluntaryHours} h / month</dd>
            </div>
            <div>
              <dt>Lead time</dt>
              <dd>{d.pathway.assumptions.leadMonths} months</dd>
            </div>
            <div>
              <dt>Need reduction</dt>
              <dd>{d.pathway.assumptions.reductionPercent}%</dd>
            </div>
            <div>
              <dt>Baseline</dt>
              <dd>{BASELINE.id}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{MODEL_VERSION}</dd>
            </div>
          </dl>
          <p className="fine-print">
            Saved assumptions rerun against the September synthetic baseline.
            These projections count repair needs, not measured health outcomes.
          </p>
          <p className="fine-print">
            Stress: −25% capacity · +25% incoming needs · +3 months lead · ½
            prevention effect.
          </p>
          <p className="fine-print">
            Current practice ignores added hours and prevention. Sharing ignores
            prevention lead time and reduction.
          </p>
        </details>
      </section>
      <section>
        <h3>Agreement</h3>
        <dl className="document-fields">
          <div>
            <dt>Steward</dt>
            <dd>{d.steward}</dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>{d.authority}</dd>
          </div>
          <div>
            <dt>Consent</dt>
            <dd>{d.consent}</dd>
          </div>
        </dl>
        <p className="fine-print">
          Authority and consent are recorded claims; saving this proposal does
          not authorize work.
        </p>
      </section>
      <section>
        <h3>Review</h3>
        <p className="review-date">
          {new Date(`${d.reviewDate}T12:00:00`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <dl className="document-fields">
          <div>
            <dt>Success criteria</dt>
            <dd>{d.success}</dd>
          </div>
          <div>
            <dt>Stop conditions</dt>
            <dd>{d.reversal}</dd>
          </div>
          <div>
            <dt>Reversibility</dt>
            <dd>{PATHWAY_COPY[d.pathway.kind].reversal}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>
          Challenges <span className="record-count">{d.challenges.length}</span>
        </h3>
        {d.challenges.length ? (
          <ul className="challenge-list">
            {d.challenges.map((c) => (
              <li key={c.id}>
                <strong>{EVIDENCE[c.target].title}</strong>
                <p>{c.text}</p>
                <small>
                  {c.pathway.assumptions.voluntaryHours} h/mo ·{" "}
                  {c.pathway.assumptions.leadMonths} months,{" "}
                  {c.pathway.assumptions.reductionPercent}%
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">None recorded.</p>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>
            Observations{" "}
            <span className="record-count">{observations.length}</span>
          </h3>
          <button
            className="icon-button no-print"
            onClick={() => updateEntry({ expanded: !showObservation })}
            aria-label={
              showObservation ? "Close observation form" : "Add observation"
            }
            title={
              showObservation ? "Close observation form" : "Add observation"
            }
            aria-expanded={showObservation}
            aria-controls="observation-entry"
          >
            {showObservation ? <X size={17} /> : <Plus size={17} />}
          </button>
        </div>
        {observations.map((o) => {
          const predicted = run.months[o.month].remaining;
          return (
            <div className="observation" key={o.id}>
              <strong>
                Month {o.month} · {number(o.remaining)} needs
              </strong>
              <p>
                {number(predicted)} projected · Δ{" "}
                {number(o.remaining - predicted)}
              </p>
              <p className="preserve-lines">{o.note}</p>
              <small>
                {new Date(o.createdAt).toLocaleDateString("en-US")} · unverified
              </small>
            </div>
          );
        })}
        {showObservation && (
          <form
            id="observation-entry"
            className="observation-form no-print"
            onSubmit={(e) => {
              e.preventDefault();
              if (observe(d.id, Number(month), Number(remaining), note)) {
                updateEntry({ remaining: "", note: "", expanded: false });
              }
            }}
          >
            <div className="form-pair">
              <div>
                <label htmlFor="observation-month">Month</label>
                <input
                  id="observation-month"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={month}
                  onChange={(e) => updateEntry({ month: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="observation-needs">Needs remaining</label>
                <input
                  id="observation-needs"
                  type="number"
                  min={0}
                  max={10000}
                  step="any"
                  value={remaining}
                  onChange={(e) => updateEntry({ remaining: e.target.value })}
                  required
                />
              </div>
            </div>
            <label htmlFor="observation-note">Source & notes</label>
            <textarea
              id="observation-note"
              value={note}
              onChange={(e) => updateEntry({ note: e.target.value })}
              required
              maxLength={3000}
              rows={3}
            />
            <button
              className="icon-button"
              aria-label="Save observation"
              title="Save observation"
            >
              <Save size={17} />
            </button>
          </form>
        )}
      </section>
    </article>
  );
}
