"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Info,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  BASELINE,
  PATHWAYS,
  PATHWAY_COPY,
  evaluate,
  number,
  type Pathway,
  type Evaluation,
  type Assumptions,
} from "@/lib/commons/model";
import { EVIDENCE, type EvidenceKey } from "@/lib/commons/evidence";
import type { Challenge } from "@/lib/commons/workspace";
import { PathwayChart, SERIES } from "./chart";
import { EvidencePanel } from "./evidence-panel";
export type AssumptionInputs = Record<keyof Assumptions, string>;
const pathwayLabel = (pathway: Pathway) =>
  PATHWAYS.some((p) => p.id === pathway.id)
    ? {
        current: "Existing rota",
        coordinate: "Shared rota",
        prevent: "Retrofit",
      }[pathway.kind]
    : pathway.title;
export function Pathways({
  active,
  selected,
  inputs,
  dirty,
  error,
  runs: expectedRuns,
  branches,
  challenges,
  evidence,
  choose,
  change,
  apply,
  reset,
  saveBranch,
  record,
  inspect,
  sources,
  addChallenge,
  challengeTarget,
  setChallengeTarget,
}: {
  active: boolean;
  selected: Pathway;
  inputs: AssumptionInputs;
  dirty: boolean;
  error: string | null;
  runs: Evaluation[];
  branches: Pathway[];
  challenges: Challenge[];
  evidence: EvidenceKey | null;
  choose: (p: Pathway) => void;
  change: (key: keyof Assumptions, value: string) => void;
  apply: (assumptions: Assumptions) => void;
  reset: () => void;
  saveBranch: (title: string) => boolean;
  record: () => void;
  inspect: (key: EvidenceKey | null) => void;
  sources: (sourceId: string) => void;
  addChallenge: (target: EvidenceKey, text: string) => boolean;
  challengeTarget: EvidenceKey | null;
  setChallengeTarget: (target: EvidenceKey | null) => void;
}) {
  const challengeInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (challengeTarget) challengeInput.current?.focus();
  }, [challengeTarget]);
  const [branchName, setBranchName] = useState("");
  const [challengeText, setChallengeText] = useState("");
  const [showBranch, setShowBranch] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [stressCase, setStressCase] = useState(false);
  const [month, setMonth] = useState(12);
  const runs = stressCase
    ? expectedRuns.map((r) => evaluate(r.pathway, true))
    : expectedRuns;
  const result = error
    ? null
    : runs.find((r) => r.pathway.kind === selected.kind)!;
  const stress = error ? null : evaluate(selected, true);
  const original = PATHWAYS.find((p) => p.kind === selected.kind)!;
  const originalResult = evaluate(original, stressCase);
  const point = result?.months[month];
  const workToMonth =
    result?.months
      .slice(0, month + 1)
      .reduce((total, m) => total + m.repairHours + m.investmentHours, 0) ?? 0;
  const investmentToMonth =
    result?.months
      .slice(0, month + 1)
      .reduce((total, m) => total + m.investmentHours, 0) ?? 0;
  const relevant = challenges.filter((c) => c.pathway.kind === selected.kind);
  const branchControl = (p: Pathway) => (
    <label className="pathway-option" key={p.id}>
      <input
        type="radio"
        name="pathway"
        checked={selected.id === p.id}
        onChange={() => choose(p)}
      />
      <span>
        <strong>{pathwayLabel(p)}</strong>
      </span>
    </label>
  );
  const inputControl = (
    key: keyof Assumptions,
    label: string,
    unit: string,
    max: number,
    disabled = false,
  ) => (
    <div className="assumption-field">
      <div className="field-heading">
        <label htmlFor={key}>{label}</label>
        <button
          className="icon-button small"
          onClick={() => inspect(key)}
          aria-label={`Inspect ${label.toLowerCase()}`}
          title={`Inspect ${label.toLowerCase()}`}
        >
          <Info size={14} />
        </button>
      </div>
      <div className="unit-input">
        <input
          id={key}
          type="number"
          min={key === "leadMonths" ? 1 : 0}
          max={max}
          step={key === "leadMonths" ? 1 : "any"}
          value={inputs[key]}
          disabled={disabled}
          aria-invalid={!!error && !disabled}
          aria-describedby={error ? "assumption-error" : undefined}
          onChange={(e) => change(key, e.target.value)}
        />
        <span>{unit}</span>
      </div>
      <label className="sr-only" htmlFor={`${key}-range`}>
        {label} slider
      </label>
      <input
        className="assumption-range"
        id={`${key}-range`}
        type="range"
        min={key === "leadMonths" ? 1 : 0}
        max={max}
        step={1}
        value={
          Number.isFinite(Number(inputs[key])) && inputs[key] !== ""
            ? Number(inputs[key])
            : selected.assumptions[key]
        }
        disabled={disabled}
        onChange={(e) => change(key, e.target.value)}
      />
    </div>
  );
  return (
    <>
      <header className="page-heading lab-heading page-enter">
        <h1>Compare</h1>
        <button className="button primary" disabled={!!error} onClick={record}>
          New decision <ArrowRight size={16} />
        </button>
      </header>
      <div className="pathway-layout">
        <aside className="assumptions" aria-label="Pathway and assumptions">
          <h2>
            <SlidersHorizontal size={16} /> Assumptions
          </h2>
          <div className="mobile-pathway-choice">
            <label htmlFor="mobile-pathway">Pathway</label>
            <select
              id="mobile-pathway"
              value={selected.id}
              onChange={(e) => {
                const p = [...PATHWAYS, ...branches].find(
                  (p) => p.id === e.target.value,
                );
                if (p) choose(p);
              }}
            >
              {[...PATHWAYS, ...branches].map((p) => (
                <option key={p.id} value={p.id}>
                  {pathwayLabel(p)}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              aria-expanded={showAssumptions}
              aria-controls="assumption-inputs"
              onClick={() => setShowAssumptions(!showAssumptions)}
            >
              <SlidersHorizontal size={15} /> Assumptions
            </button>
          </div>
          <fieldset className="pathway-choices">
            <legend className="sr-only">Choose a pathway</legend>
            {PATHWAYS.map(branchControl)}
            {branches.length > 0 && (
              <details
                className="saved-branch-choices"
                open={selected.id !== original.id}
              >
                <summary>Branches ({branches.length})</summary>
                {branches.map(branchControl)}
              </details>
            )}
          </fieldset>
          <div
            id="assumption-inputs"
            className={`assumption-inputs ${showAssumptions ? "mobile-expanded" : ""}`}
          >
            <div className="section-heading">
              <h3>Parameters</h3>
              {dirty && (
                <span className="edited-dot" aria-label="Changed assumptions" />
              )}
            </div>
            <div
              className="assumption-presets"
              aria-label="Exploration presets"
            >
              <button onClick={() => apply(original.assumptions)}>
                Default
              </button>
              <button
                disabled={selected.kind === "current"}
                onClick={() =>
                  apply({ ...selected.assumptions, voluntaryHours: 0 })
                }
              >
                No extra hours
              </button>
              <button
                disabled={selected.kind !== "prevent"}
                onClick={() =>
                  apply({
                    ...selected.assumptions,
                    leadMonths: 8,
                    reductionPercent: 20,
                  })
                }
              >
                Slower pilot
              </button>
            </div>
            {inputControl(
              "voluntaryHours",
              "Extra hours",
              "h / mo",
              80,
              selected.kind === "current",
            )}
            {inputControl(
              "leadMonths",
              "Lead time",
              "months",
              12,
              selected.kind !== "prevent",
            )}
            {inputControl(
              "reductionPercent",
              "Need reduction",
              "%",
              80,
              selected.kind !== "prevent",
            )}
            {dirty && (
              <button
                className="icon-button"
                onClick={reset}
                aria-label="Reset assumptions"
                title="Reset assumptions"
              >
                <RotateCcw size={16} />
              </button>
            )}
            {!showBranch ? (
              <button
                className="button secondary full-width"
                disabled={!!error}
                onClick={() => setShowBranch(true)}
              >
                <Plus size={16} /> Branch
              </button>
            ) : (
              <form
                className="branch-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (saveBranch(branchName)) {
                    setBranchName("");
                    setShowBranch(false);
                  }
                }}
              >
                <label htmlFor="branch-name">Branch name</label>
                <input
                  id="branch-name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder="Six-month retrofit"
                  autoFocus
                />
                <button
                  className="icon-button"
                  disabled={!!error}
                  aria-label="Save branch"
                  title="Save branch"
                >
                  <Save size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Cancel branch"
                  title="Cancel branch"
                  onClick={() => setShowBranch(false)}
                >
                  <X size={16} />
                </button>
              </form>
            )}
          </div>
        </aside>
        <div className="pathway-main">
          <header className="work-heading">
            <div>
              <h2>
                {pathwayLabel(selected)}
                {dirty && (
                  <span
                    className="edited-dot"
                    aria-label="Changed assumptions"
                  />
                )}
              </h2>
            </div>
            <div
              className="case-switch"
              role="group"
              aria-label="Evaluation case"
            >
              <button
                aria-pressed={!stressCase}
                onClick={() => setStressCase(false)}
              >
                Expected
              </button>
              <button
                aria-pressed={stressCase}
                onClick={() => setStressCase(true)}
              >
                Stress
              </button>
            </div>
          </header>
          {stressCase && (
            <p className="stress-banner">
              −25% capacity · +25% new needs · +3 months lead · ½ prevention
              effect
            </p>
          )}
          {error ? (
            <div id="assumption-error" className="error-state" role="alert">
              <h2>Invalid assumption</h2>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {point && (
                <dl
                  className="outcome-strip"
                  aria-label={`Selected pathway at month ${month}`}
                >
                  <div>
                    <dt>Needs remaining</dt>
                    <dd>{number(point.remaining)}</dd>
                    <small>
                      at {month === 0 ? "the start" : `month ${month}`}
                    </small>
                  </div>
                  <div>
                    <dt>Work</dt>
                    <dd>
                      {number(workToMonth)} <span>h</span>
                    </dd>
                    <small>through month {month}</small>
                  </div>
                  <div>
                    <dt>New needs</dt>
                    <dd>{month === 0 ? "—" : number(point.incoming)}</dd>
                    <small>
                      {month === 0
                        ? "not yet accrued"
                        : `during month ${month}`}
                    </small>
                  </div>
                  <div>
                    <dt>Investment</dt>
                    <dd>
                      {number(investmentToMonth)} <span>h</span>
                    </dd>
                    <small>included in productive work</small>
                  </div>
                </dl>
              )}
              <section className="chart-surface" aria-labelledby="chart-title">
                <div className="section-heading">
                  <h2 id="chart-title">Needs remaining</h2>
                </div>
                {active && (
                  <PathwayChart
                    runs={runs.map((r) => ({
                      ...r,
                      pathway: { ...r.pathway, title: pathwayLabel(r.pathway) },
                    }))}
                    selectedKind={selected.kind}
                    month={month}
                  />
                )}
                <div className="chart-legend">
                  {runs.map((r, i) => (
                    <span key={r.pathway.kind}>
                      <span
                        className="legend-line"
                        style={{ backgroundColor: SERIES[i] }}
                      />
                      {pathwayLabel(r.pathway)}
                    </span>
                  ))}
                  <span className="axis-note">Month</span>
                </div>
                <div className="timeline-control">
                  <label htmlFor="model-month">
                    Month <strong>{month === 0 ? "Start" : month}</strong>
                  </label>
                  <input
                    id="model-month"
                    type="range"
                    min={0}
                    max={12}
                    step={1}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    aria-valuetext={
                      month === 0 ? "Starting conditions" : `Month ${month}`
                    }
                  />
                  <span>12 months</span>
                </div>
              </section>
              <section className="comparison-surface">
                <div className="section-heading">
                  <h2>12 months</h2>
                  <button
                    className="icon-button small"
                    onClick={() => inspect("baseline")}
                    aria-label="Inspect comparison assumptions"
                    title="Inspect comparison assumptions"
                  >
                    <Info size={16} />
                  </button>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Comparison of three pathways"
                >
                  <table className="comparison-table">
                    <caption className="sr-only">
                      {stressCase ? "Stress case" : "Expected case"}. Same
                      initial 30 needs, same 12-month horizon. Current
                      exploration replaces its original pathway column.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          {stressCase ? "Stress" : "Expected"}
                        </th>
                        {runs.map((r) => (
                          <th
                            scope="col"
                            key={r.pathway.kind}
                            className={`${r.pathway.kind === selected.kind ? "selected-column" : ""} ${r.pathway.kind === "current" ? "baseline-column" : ""}`}
                          >
                            {pathwayLabel(r.pathway)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "Needs remaining",
                          "needs",
                          (r: Evaluation) => number(r.remaining),
                        ],
                        [
                          "Repairs completed",
                          "needs",
                          (r: Evaluation) => number(r.completed),
                        ],
                        [
                          "Work",
                          "repair + investment hours",
                          (r: Evaluation) => `${number(r.workHours)} h`,
                        ],
                        [
                          "Investment",
                          "included in productive work",
                          (r: Evaluation) => `${number(r.investmentHours)} h`,
                        ],
                        [
                          "Recurring needs",
                          "needs / month at month 12",
                          (r: Evaluation) => number(r.recurringAtEnd),
                        ],
                        [
                          "Material demand",
                          "repair-equivalent units",
                          (r: Evaluation) => number(r.materialUnits),
                        ],
                      ].map(([label, unit, value]) => (
                        <tr key={String(label)}>
                          <th scope="row">
                            {String(label)}
                            <small>{String(unit)}</small>
                          </th>
                          {runs.map((r) => (
                            <td
                              key={r.pathway.kind}
                              className={`${r.pathway.kind === selected.kind ? "selected-column" : ""} ${r.pathway.kind === "current" ? "baseline-column" : ""}`}
                            >
                              {typeof value === "function" ? value(r) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {(result && selected.id !== original.id) || dirty ? (
                <p className="delta-note">
                  Δ from {pathwayLabel(original)}:{" "}
                  <strong>
                    {number(
                      (result?.remaining ?? originalResult.remaining) -
                        originalResult.remaining,
                    )}{" "}
                    needs
                  </strong>{" "}
                  ·{" "}
                  <strong>
                    {number(
                      (result?.workHours ?? originalResult.workHours) -
                        originalResult.workHours,
                    )}{" "}
                    h
                  </strong>{" "}
                  over 12 months
                </p>
              ) : null}
              <details className="data-details">
                <summary>Monthly data</summary>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Monthly results"
                >
                  <table className="simple-table">
                    <caption>
                      {stressCase ? "Stress case" : "Expected case"}: needs
                      remaining, by month
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        {runs.map((r) => (
                          <th scope="col" key={r.pathway.kind}>
                            {pathwayLabel(r.pathway)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runs[0].months.map((m, i) => (
                        <tr
                          key={m.month}
                          className={
                            m.month === month ? "inspected-month" : undefined
                          }
                        >
                          <th scope="row">
                            {m.month === 0 ? "Start" : m.month}
                          </th>
                          {runs.map((r) => (
                            <td key={r.pathway.kind}>
                              {number(r.months[i].remaining)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Neighborhood results"
                >
                  <table className="simple-table">
                    <caption>
                      {stressCase ? "Stress case" : "Expected case"}: needs
                      remaining by neighborhood at month 12
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Neighborhood</th>
                        {runs.map((r) => (
                          <th scope="col" key={r.pathway.kind}>
                            {pathwayLabel(r.pathway)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BASELINE.neighborhoods.map((n, i) => (
                        <tr key={n.name}>
                          <th scope="row">{n.name}</th>
                          {runs.map((r) => (
                            <td key={r.pathway.kind}>
                              {number(r.neighborhoodRemaining[i])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="fine-print">
                  Current practice splits capacity equally. Sharing allocates it
                  proportionally to outstanding needs. Neither rule establishes
                  household-level fairness.
                </p>
              </details>
            </>
          )}
        </div>
        <aside
          className="context-rail"
          aria-label="Interpretation and evidence"
        >
          {evidence ? (
            <EvidencePanel
              target={evidence}
              pathway={selected}
              close={() => inspect(null)}
              challenge={(key) => setChallengeTarget(key)}
              sources={sources}
            />
          ) : (
            <>
              <section>
                <div className="section-heading">
                  <h2>Mechanism</h2>
                  <button
                    className="icon-button small"
                    aria-label="Inspect pathway mechanism"
                    title="Inspect pathway mechanism"
                    onClick={() =>
                      inspect(
                        selected.kind === "prevent"
                          ? "reductionPercent"
                          : "capacity",
                      )
                    }
                  >
                    <Info size={16} />
                  </button>
                </div>
                <p>
                  {selected.kind === "prevent"
                    ? result?.activationMonth
                      ? `Retrofit takes 192 hours from repair capacity. New needs fall from month ${result.activationMonth}, after installation is complete.`
                      : "Installation is not complete within 12 months. The retrofit has no modeled benefit during this period."
                    : selected.kind === "coordinate"
                      ? "Pooled hours serve neighborhoods in proportion to outstanding needs. Productive time rises from 45% to an assumed 65%."
                      : "Each neighborhood receives one third of repair capacity. Spare capacity stays local; new needs continue at 4.5 per month."}
                </p>
              </section>
              <section>
                <h2>Stress</h2>
                {stress && (
                  <p className="stress-result">
                    <strong>{number(stress.remaining)}</strong> needs remaining
                    · month 12
                  </p>
                )}
                <p>
                  −25% capacity · +25% new needs · +3 months lead · ½ prevention
                  effect
                </p>
              </section>
              <section>
                <details>
                  <summary>Consent & limits</summary>
                  <p>{PATHWAY_COPY[selected.kind].consent}</p>
                  <p>
                    Hours require explicit agreement. Repair counts do not
                    establish health, fairness, affordability or ecological
                    impact.
                  </p>
                  <p className="fine-print">
                    Stress tests and input bounds are exploratory, not
                    probabilities or confidence intervals.
                  </p>
                </details>
              </section>
            </>
          )}
        </aside>
      </div>
      <section
        className="challenge-section"
        aria-labelledby="challenge-heading"
      >
        <div className="challenge-intro">
          <h2 id="challenge-heading">
            Challenges <span className="record-count">{relevant.length}</span>
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label={
            challengeTarget ? "Close challenge form" : "Add challenge"
          }
          title={challengeTarget ? "Close challenge form" : "Add challenge"}
          onClick={() =>
            setChallengeTarget(challengeTarget ? null : "voluntaryHours")
          }
        >
          {challengeTarget ? <X size={16} /> : <Plus size={16} />}
        </button>
        {challengeTarget && (
          <form
            className="challenge-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (addChallenge(challengeTarget, challengeText)) {
                setChallengeText("");
                setChallengeTarget(null);
              }
            }}
          >
            <label htmlFor="challenge-target">Assumption</label>
            <select
              id="challenge-target"
              value={challengeTarget}
              onChange={(e) =>
                setChallengeTarget(e.target.value as EvidenceKey)
              }
            >
              {Object.entries(EVIDENCE).map(([key, e]) => (
                <option value={key} key={key}>
                  {e.title}
                </option>
              ))}
            </select>
            <label htmlFor="challenge-text">Concern</label>
            <textarea
              ref={challengeInput}
              id="challenge-text"
              value={challengeText}
              onChange={(e) => setChallengeText(e.target.value)}
              required
              maxLength={3000}
              rows={3}
              placeholder="What would change this assumption?"
            />
            <button
              className="icon-button"
              disabled={!!error}
              aria-label="Save challenge"
              title="Save challenge"
            >
              <Save size={16} />
            </button>
          </form>
        )}
        {relevant.length > 0 && (
          <ul className="challenge-list">
            {relevant.map((c) => (
              <li key={c.id}>
                <strong>{EVIDENCE[c.target].title}</strong>
                <p>{c.text}</p>
                <small>
                  {pathwayLabel(c.pathway)} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString("en-US")} ·{" "}
                  {c.pathway.assumptions.voluntaryHours} h/mo,{" "}
                  {c.pathway.assumptions.leadMonths} months,{" "}
                  {c.pathway.assumptions.reductionPercent}%
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mobile-record-action">
        <button className="button primary" disabled={!!error} onClick={record}>
          New decision <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
