"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Check,
  Circle,
  AlertCircle,
} from "lucide-react";
import {
  BASELINE,
  PATHWAYS,
  evaluate,
  number,
  type Pathway,
} from "@/lib/commons/model";
import { type Workspace } from "@/lib/commons/workspace";
import {
  REPAIR_REGISTER,
  CASE_STUDY,
  BUILDINGS,
  CASE_MONTHS,
} from "@/lib/commons/case-study";
import { type EvidenceKey } from "@/lib/commons/evidence";
import { PathwayChart, SERIES } from "./chart";

const shortDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const firstSentence = (text: string) => {
  const end = text.indexOf(". ");
  return end < 0 ? text : text.slice(0, end + 1);
};
export function Overview({
  workspace,
  explore,
  record,
  inspect,
  sources,
}: {
  workspace: Workspace;
  explore: (pathway: Pathway) => void;
  record: (id: string) => void;
  inspect: (key: EvidenceKey) => void;
  sources: () => void;
}) {
  const [area, setArea] = useState("All");
  const [cohort, setCohort] = useState(false);
  const [query, setQuery] = useState("");
  const latest = workspace.decisions.at(-1);
  const current = latest?.pathway ?? workspace.branches.at(-1) ?? PATHWAYS[2];
  const forecast = evaluate(current);
  const observed = [...workspace.observations].sort(
    (a, b) => b.month - a.month || b.createdAt.localeCompare(a.createdAt),
  )[0];
  const observationDecision = workspace.decisions.find(
    (d) => d.id === observed?.decisionId,
  );
  const recordedPrediction =
    observed && observationDecision
      ? evaluate(observationDecision.pathway).months[observed.month].remaining
      : null;
  const difference =
    observed && recordedPrediction !== null
      ? observed.remaining - recordedPrediction
      : 0;
  const runs = PATHWAYS.map((p) =>
    evaluate(
      p.kind === current.kind
        ? current
        : {
            ...p,
            title:
              p.kind === "current"
                ? "Existing rota"
                : p.kind === "coordinate"
                  ? "Shared rota"
                  : "Retrofit",
          },
    ),
  );
  const plotObservations = useMemo(() => {
    const byMonth = new Map<number, Workspace["observations"][number]>();
    [...workspace.observations]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((o) => byMonth.set(o.month, o));
    return [{ month: 0, remaining: 30 }, ...byMonth.values()];
  }, [workspace.observations]);
  const repairRows = REPAIR_REGISTER.filter(
    (issue) =>
      (area === "All" || issue.neighborhood === area) &&
      `${issue.id} ${issue.home} ${issue.issue} ${issue.assignee}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const events = [
    ...workspace.decisions.map((d) => ({
      id: d.id,
      date: d.createdAt,
      kind: "Decision",
      title: d.action,
      note: d.steward,
      decisionId: d.id,
    })),
    ...workspace.observations.map((o) => ({
      id: o.id,
      date: o.createdAt,
      kind: "Observation",
      title: `Month ${o.month}: ${number(o.remaining)} repair units open`,
      note: o.note,
      decisionId: o.decisionId,
    })),
    ...workspace.challenges.map((c) => ({
      id: c.id,
      date: c.createdAt,
      kind: "Challenge",
      title: c.text,
      note: c.pathway.title,
      decisionId: null,
      target: c.target,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  return (
    <div className="view-enter">
      <header className="case-heading">
        <div className="case-title-row">
          <h1>Winter repairs</h1>
        </div>
        <div className="case-meta">
          <span>Alder housing cooperative</span>
          <span>120 homes</span>
          <span>Sep 2026–Mar 2027</span>
          <span className="case-status">Expansion paused</span>
        </div>
      </header>
      <div className="case-layout">
        <div>
          <section className="case-section">
            <div className="case-section-heading">
              <h2>Repairs</h2>
              <span>{shortDate(CASE_STUDY.snapshotDate)}</span>
            </div>
            <div className="case-metrics">
              <div>
                <span>At start</span>
                <strong>30</strong>
                <small>Sep 12</small>
              </div>
              <div>
                <span>Recorded</span>
                <strong>{observed ? number(observed.remaining) : "—"}</strong>
                <small>
                  {observed ? `month ${observed.month}` : "no observations"}
                </small>
              </div>
              <div>
                <span>Forecast</span>
                <strong>{number(forecast.remaining)}</strong>
                <small>at month 12</small>
              </div>
            </div>
            {observed && (
              <p className="case-summary">
                <AlertCircle size={15} />
                <span>
                  {difference > 0
                    ? `${number(difference)} above`
                    : difference < 0
                      ? `${number(-difference)} below`
                      : "Matches"}{" "}
                  the recorded month-{observed.month} forecast
                  {recordedPrediction !== null
                    ? ` (${number(recordedPrediction)})`
                    : ""}
                  .{" "}
                  {firstSentence(
                    observed.note.includes(" · ") && observed.note.includes(". ")
                      ? observed.note.slice(observed.note.indexOf(". ") + 2)
                      : observed.note,
                  )}
                </span>
              </p>
            )}
            <div className="case-chart">
              <PathwayChart
                runs={runs}
                selectedKind={current.kind}
                observations={plotObservations}
                calendar
              />
            </div>
            <div className="chart-legend">
              {runs.map((run, i) => (
                <button
                  key={run.pathway.kind}
                  className="case-link"
                  onClick={() => explore(run.pathway)}
                >
                  <i style={{ background: SERIES[i] }} />
                  {run.pathway.title}
                </button>
              ))}
              <span>
                <i style={{ background: "#28352e", borderRadius: "50%" }} />
                Recorded
              </span>
            </div>
            <details className="case-chart-detail">
              <summary>Monthly ledger</summary>
              <div
                className="table-scroll"
                role="region"
                aria-label="Monthly case ledger"
                tabIndex={0}
              >
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>New</th>
                      <th>Closed</th>
                      <th>Open</th>
                      <th>Homes</th>
                      <th>Retrofit h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CASE_MONTHS.map((m) => (
                      <tr key={m.month}>
                        <th>{shortDate(m.date)}</th>
                        <td>{m.incoming}</td>
                        <td>{m.closed}</td>
                        <td>{m.remaining}</td>
                        <td>{m.affectedHomes}</td>
                        <td>{m.retrofitHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                March audit: 30 + 37 new − 27 closed = 40 open units. The
                30-item September register tracks the original cohort.
              </p>
            </details>
            <details className="case-chart-detail">
              <summary>Forecast basis</summary>
              <p>
                Each plan starts at the September baseline. Recorded points span
                revisions; the curves do not simulate a mid-pilot change of
                plan. Open Compare for the monthly calculations.
              </p>
            </details>
          </section>
          <section className="case-section">
            <div className="case-section-heading">
              <h2>Buildings</h2>
              <button
                className="icon-button"
                aria-label="Inspect baseline assumptions"
                title="Baseline"
                onClick={() => inspect("baseline")}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div
              className="table-scroll"
              role="region"
              aria-label="Buildings at the September baseline"
              tabIndex={0}
            >
              <table className="case-table">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Area</th>
                    <th>Homes</th>
                    <th>Starting repairs</th>
                  </tr>
                </thead>
                <tbody>
                  {BUILDINGS.map((building) => (
                    <tr key={building.id}>
                      <th title={building.note}>
                        <button
                          className="case-link"
                          onClick={() => {
                            setCohort(true);
                            setArea(building.area);
                            document
                              .getElementById("repair-register")
                              ?.scrollIntoView({ block: "start" });
                          }}
                        >
                          {building.name}
                          <ChevronRight size={12} />
                        </button>
                      </th>
                      <td>{building.area}</td>
                      <td>{building.homes}</td>
                      <td>{building.startingRepairs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="case-section" id="repair-register">
            <div className="case-section-heading">
              <h2>September cohort</h2>
              <button
                className="text-button"
                aria-expanded={cohort}
                onClick={() => setCohort(!cohort)}
              >
                {cohort ? "Close" : "30 repairs"}
                <ChevronRight size={14} />
              </button>
            </div>
            {cohort && (
              <>
                <div
                  className="case-tabs"
                  aria-label="Filter repairs by building"
                >
                  {["All", ...BASELINE.neighborhoods.map((n) => n.name)].map(
                    (name) => (
                      <button
                        key={name}
                        aria-pressed={area === name}
                        onClick={() => setArea(name)}
                      >
                        {name}
                      </button>
                    ),
                  )}
                </div>
                <label className="sr-only" htmlFor="repair-search">
                  Search repair register
                </label>
                <input
                  id="repair-search"
                  type="search"
                  placeholder="Find a repair…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="case-worklist">
                  {repairRows.map((issue) => (
                    <details className="case-issue-row" key={issue.id}>
                      <summary>
                        <span className="case-issue-id">{issue.id}</span>
                        <span>
                          <strong>{issue.issue}</strong>
                          <small>
                            {
                              BUILDINGS.find((b) => b.id === issue.buildingId)
                                ?.name
                            }{" "}
                            · {issue.home}
                          </small>
                        </span>
                        <span
                          className={`case-issue-status status-${issue.status.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {issue.status}
                        </span>
                      </summary>
                      <div className="source-note">
                        <p>{issue.note}</p>
                        <p className="source-meta">
                          {issue.assignee} · {issue.hours} h model estimate
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
                <p className="fine-print">
                  Starting cohort only; later incoming repairs are tracked in
                  the monthly observations.
                </p>
              </>
            )}
          </section>
        </div>
        <aside className="case-context" aria-label="Pilot context">
          {latest && (
            <section className="case-section case-focus">
              <div className="case-section-heading">
                <h2>Review</h2>
                <span>{shortDate(latest.reviewDate)}</span>
              </div>
              <button
                className="case-decision-link"
                onClick={() => record(latest.id)}
              >
                <strong>{firstSentence(latest.action)}</strong>
                <ArrowUpRight size={17} />
              </button>
              <p>{firstSentence(latest.rationale)}</p>
              <div className="source-meta">{latest.steward}</div>
            </section>
          )}
          <section className="case-section">
            <div className="case-section-heading">
              <h2>Plan</h2>
              <button
                className="icon-button"
                title="Open working plan"
                aria-label="Open working plan in Compare"
                onClick={() => explore(current)}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            <strong>{current.title}</strong>
            <dl className="case-plan">
              <div>
                <dt>Extra time</dt>
                <dd>{current.assumptions.voluntaryHours} h / mo</dd>
              </div>
              <div>
                <dt>Installations</dt>
                <dd>{current.assumptions.leadMonths} months</dd>
              </div>
              <div>
                <dt>Recurrence effect</dt>
                <dd>−{current.assumptions.reductionPercent}%</dd>
              </div>
              <div>
                <dt>Upfront work</dt>
                <dd>192 h</dd>
              </div>
            </dl>
            <button className="case-link" onClick={sources}>
              Evidence
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="case-section">
            <div className="case-section-heading">
              <h2>Activity</h2>
              <span>{workspace.observations.length} readings</span>
            </div>
            <div className="case-events">
              {events.map((event) => (
                <button
                  className="case-event"
                  key={event.id}
                  onClick={() =>
                    event.decisionId
                      ? record(event.decisionId)
                      : inspect(
                          "target" in event
                            ? (event.target as EvidenceKey)
                            : "baseline",
                        )
                  }
                >
                  <span className="event-icon">
                    {event.kind === "Decision" ? (
                      <Check size={13} />
                    ) : event.kind === "Challenge" ? (
                      <AlertCircle size={13} />
                    ) : (
                      <Circle size={11} />
                    )}
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {shortDate(event.date)} · {event.kind}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
