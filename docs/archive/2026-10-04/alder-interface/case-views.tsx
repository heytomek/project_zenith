"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";
import { CASE_EVIDENCE, TEAM } from "@/lib/commons/case-study";
import { type EvidenceKey } from "@/lib/commons/evidence";
import { type Workspace } from "@/lib/commons/workspace";
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export function CaseEvidence({
  inspect,
  sourceId,
}: {
  inspect: (key: EvidenceKey) => void;
  sourceId: string | null;
}) {
  useEffect(() => {
    if (sourceId)
      document
        .getElementById(`source-${sourceId}`)
        ?.scrollIntoView({ block: "start" });
  }, [sourceId]);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState("All");
  const sources = CASE_EVIDENCE.filter(
    (source) =>
      (target === "All" || source.target === target) &&
      `${source.title} ${source.author} ${source.summary} ${source.content.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="view-enter">
      <header className="case-heading">
        <div className="case-title-row">
          <h1>Evidence</h1>
          <span className="record-count">{CASE_EVIDENCE.length} documents</span>
        </div>
      </header>
      <div className="evidence-filters">
        <div className="search-field">
          <Search size={16} />
          <label className="sr-only" htmlFor="source-search">
            Search evidence
          </label>
          <input
            id="source-search"
            type="search"
            placeholder="Find a document…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="source-target">
          Filter evidence by assumption
        </label>
        <select
          id="source-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="All">All assumptions</option>
          <option value="baseline">Starting repairs</option>
          <option value="capacity">Productive time</option>
          <option value="voluntaryHours">Extra hours</option>
          <option value="leadMonths">Lead time</option>
          <option value="reductionPercent">Recurrence effect</option>
          <option value="materials">Materials</option>
        </select>
      </div>
      <div className="case-sources">
        {sources.map((source, i) => (
          <details
            className="case-source"
            key={source.id}
            id={`source-${source.id}`}
            open={
              (
                sourceId
                  ? sourceId === source.id
                  : i === 0 && !query && target === "All"
              )
                ? true
                : undefined
            }
          >
            <summary>
              <FileText size={18} />
              <div>
                <h2>{source.title}</h2>
                <span className="source-meta">
                  {source.author} · {date(source.date)}
                </span>
              </div>
              <ChevronDown size={16} />
            </summary>
            <div className="source-note">
              <p className="source-summary">{source.summary}</p>
              {source.content.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <div className="source-finding">
                <Check size={16} />
                <p>{source.finding}</p>
              </div>
              <p className="source-limitation">{source.limitation}</p>
              <div className="source-end">
                <span className="source-meta">{source.reference}</span>
                <button
                  className="case-link"
                  onClick={() => inspect(source.target)}
                >
                  Open assumption
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
      {!sources.length && <p className="empty-state">No matching documents.</p>}
    </div>
  );
}
export function CaseTeam({
  workspace,
  sources,
}: {
  workspace: Workspace;
  sources: (id: string) => void;
}) {
  const [selected, setSelected] = useState(TEAM[0].id);
  const person = TEAM.find((p) => p.id === selected) ?? TEAM[0];
  const authored = CASE_EVIDENCE.filter((source) =>
    source.author.includes(person.name),
  );
  const latest = workspace.decisions.at(-1);
  return (
    <div className="view-enter">
      <header className="case-heading">
        <div className="case-title-row">
          <h1>Team</h1>
          <span className="record-count">6 people</span>
        </div>
      </header>
      <div className="team-layout">
        <div className="case-team-list" aria-label="Case team">
          {TEAM.map((member) => (
            <button
              className={`member-row ${member.id === selected ? "is-selected" : ""}`}
              key={member.id}
              onClick={() => setSelected(member.id)}
              aria-pressed={member.id === selected}
            >
              <span className="avatar">{member.initials}</span>
              <span>
                <strong>{member.name}</strong>
                <small>{member.role}</small>
              </span>
            </button>
          ))}
        </div>
        <section
          className="team-detail"
          aria-label={`${person.name} responsibilities`}
        >
          <div className="case-section-heading">
            <h2>{person.name}</h2>
            <span>{person.role}</span>
          </div>
          <p>{person.focus}</p>
          <h3>Documents</h3>
          {authored.length ? (
            authored.map((source) => (
              <button
                className="team-document"
                key={source.id}
                onClick={() => sources(source.id)}
              >
                <FileText size={16} />
                <div>
                  <strong>{source.title}</strong>
                  <small>{date(source.date)}</small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <p className="fine-print">
              Contributes through resident review and the repair register.
            </p>
          )}
          {latest && (
            <details>
              <summary>Decision process</summary>
              <h3>Authority</h3>
              <p>{latest.authority}</p>
              <h3>Agreement</h3>
              <p>{latest.consent}</p>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
