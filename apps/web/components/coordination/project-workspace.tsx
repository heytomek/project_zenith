"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, CircleCheck, Clock3, Compass, Download, FileText, GitBranch, MessageSquare, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Workspace } from "@/lib/coordination/types";
import type { ProjectRecord, ProjectResponse, ProjectSnapshot } from "@/lib/coordination/project-data";
import { projectCoverage, projectReviewers, reviewProject, type ProjectFinding } from "@/lib/coordination/project-review";
import { recordProjectResponse } from "@/lib/coordination/core";
import { Dialog, IconButton, Mark, number } from "./primitives";
import styles from "./project-workspace.module.css";

type ProjectView = "situation" | "sources" | "record";
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const findingIcons = { deadline: Clock3, budget: ShieldCheck, dependency: GitBranch, decision: MessageSquare };
const projectViews = [{ id: "situation", name: "Attention", icon: Compass }, { id: "sources", name: "Sources", icon: FileText }, { id: "record", name: "Record", icon: BookOpen }] as const;

function SourceRecord({ record, snapshot }: { record: ProjectRecord; snapshot: ProjectSnapshot }) {
  const status = snapshot.mapping.status && record.cells[snapshot.mapping.status]?.trim() ? record.status : "Unstated";
  return <details className={styles.evidence}>
    <summary><span><strong>{record.title}</strong><small>{record.project} · {snapshot.name} · record {record.sourceRow}</small></span><span className={styles.recordState}>{status}</span></summary>
    <div className={styles.evidenceBody}>
      <dl className={styles.facts}>
        <div><dt>ID</dt><dd>{record.id}</dd></div>
        {record.owner && <div><dt>Owner</dt><dd>{record.owner}</dd></div>}
        {record.dueDate && <div><dt>Commitment</dt><dd>{dateLabel(record.dueDate)}</dd></div>}
        {record.forecastDate && <div><dt>Forecast</dt><dd>{dateLabel(record.forecastDate)}</dd></div>}
        {record.budget !== null && <div><dt>Budget</dt><dd>{record.currency} {number(record.budget)}</dd></div>}
        {record.forecastCost !== null && <div><dt>Forecast cost</dt><dd>{record.currency} {number(record.forecastCost)}</dd></div>}
        {record.dependsOn.length > 0 && <div><dt>Depends on</dt><dd>{record.dependsOn.join(", ")}</dd></div>}
        {record.updatedAt && <div><dt>Updated</dt><dd>{dateLabel(record.updatedAt)}</dd></div>}
      </dl>
      {record.decision && <p className={styles.sourceDecision}>{record.decision}</p>}
      {record.sourceUrl && <a className="text-button" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">Open source <ArrowRight size={13} /></a>}
      <details className={styles.raw}><summary>Original record</summary><dl>{Object.entries(record.cells).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || "—"}</dd></div>)}</dl></details>
    </div>
  </details>;
}

function FindingReview({ workspace, finding, reviewDate, historicalResponse, onClose, change }: {
  workspace: Workspace; finding: ProjectFinding; reviewDate: string; historicalResponse?: ProjectResponse | null; onClose: () => void; change: (transform: (w: Workspace) => Workspace) => boolean;
}) {
  const project = workspace.project!;
  const snapshot = project.snapshots.find(item => item.id === finding.snapshotId)!;
  const current = historicalResponse ? undefined : reviewProject(project, reviewDate).find(item => item.id === finding.id);
  const response = historicalResponse ?? current?.response;
  const [openedRevision, setOpenedRevision] = useState(workspace.revision);
  const draftKey = `zenith.project-draft.${workspace.profile.id}.${finding.id}`;
  const [note, setNote] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null"); return saved?.fingerprint === finding.fingerprint && typeof saved.text === "string" && saved.text.length <= 4000 ? saved.text : ""; } catch { return ""; }
  });
  const [saved, setSaved] = useState(false);
  const stale = !historicalResponse && (openedRevision !== workspace.revision || current?.fingerprint !== finding.fingerprint);
  const reviewer = projectReviewers.find(item => item.id === finding.reviewerId);
  const submit = () => {
    if (historicalResponse || stale || !note.trim()) return;
    if (change(w => recordProjectResponse(w, finding.id, finding.fingerprint, note, reviewDate, openedRevision))) {
      setOpenedRevision(openedRevision + 1); setNote(""); setSaved(true);
      try { sessionStorage.removeItem(draftKey); } catch { /* The committed record is durable. */ }
    }
  };
  return <Dialog title="Decision" className={styles.reviewDialog} onClose={onClose}>
    <div className={styles.reviewHeading}><small>{finding.project} · {reviewer?.name}</small><h3>{finding.question}</h3><p>{finding.summary}</p></div>
    <div className={styles.sectionHeading}><h3>Evidence</h3><small>Reported {dateLabel(snapshot.asOf)}</small></div>
    <div>{finding.evidenceIds.map(id => snapshot.records.find(record => record.id === id)).filter((record): record is ProjectRecord => Boolean(record)).map(record => <SourceRecord key={record.id} record={record} snapshot={snapshot} />)}</div>
    <details className={styles.basis}><summary>Basis</summary><p>{finding.reason}</p><small>Local rule-based review · {dateLabel(historicalResponse?.reviewDate ?? reviewDate)}</small>{finding.alternatives.length > 0 && <ul>{finding.alternatives.map(option => <li key={option}>{option}</li>)}</ul>}</details>
    {finding.owners.length > 0 && <div className={styles.owners}><span>Owners</span><strong>{finding.owners.join(" · ")}</strong></div>}
    {response && <div className={styles.priorResponse}><span>{historicalResponse ? <BookOpen size={14} /> : <CircleCheck size={14} />}{historicalResponse ? `Recorded · ${dateLabel(response.createdAt.slice(0, 10))}` : "Reviewed · condition still present"}</span><p>{response.decision}</p></div>}
    {!historicalResponse && <form className={styles.response} onSubmit={event => { event.preventDefault(); submit(); }}>
      <label htmlFor="project-decision">Your decision</label>
      <textarea id="project-decision" required maxLength={4000} rows={4} placeholder="What changes, what stays, and who takes it forward?" value={note} onChange={event => {
        setNote(event.target.value); setSaved(false);
        try { sessionStorage.setItem(draftKey, JSON.stringify({ fingerprint: finding.fingerprint, text: event.target.value })); } catch { /* Keep writing in memory. */ }
      }} />
      {stale && <p className="negative" role="alert">The evidence changed. Reopen this decision before recording.</p>}
      <div className={styles.responseFooter}><small role="status">{saved ? "Decision recorded." : "Source data stays unchanged."}</small><button className="button primary" disabled={stale || !note.trim()} type="submit">Record <ArrowRight size={14} /></button></div>
    </form>}
  </Dialog>;
}

export function ProjectWorkspace({ workspace, change, onImport, onExport, onWorlds }: {
  workspace: Workspace; change: (transform: (w: Workspace) => Workspace) => boolean; onImport: () => void; onExport: () => void; onWorlds: () => void;
}) {
  const project = workspace.project!;
  const snapshot = project.snapshots.at(-1)!;
  const [view, setView] = useState<ProjectView>("situation");
  const [reviewDate, setReviewDate] = useState(today);
  const [selectedProject, setSelectedProject] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [finding, setFinding] = useState<ProjectFinding | null>(null);
  const [historicalResponse, setHistoricalResponse] = useState<ProjectResponse | null>(null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("current");
  useEffect(() => {
    const sync = () => { const hash = window.location.hash.slice(1); setView(hash === "sources" || hash === "record" ? hash : "situation"); };
    sync(); window.addEventListener("hashchange", sync);
    const timer = setInterval(() => setReviewDate(today()), 60_000);
    return () => { window.removeEventListener("hashchange", sync); clearInterval(timer); };
  }, []);
  const navigate = (next: ProjectView) => {
    setView(next); window.scrollTo({ top: 0, behavior: "instant" });
    if (window.location.hash !== `#${next}`) window.history.pushState(null, "", `#${next}`);
  };
  const all = reviewProject(project, reviewDate);
  const projects = [...new Set(snapshot.records.map(record => record.project))].sort();
  const activeProject = projects.includes(selectedProject) ? selectedProject : "";
  const filtered = all.filter(item => !activeProject || item.project === activeProject);
  const openCount = filtered.filter(item => !item.reviewed).length;
  const queue = filtered.filter(item => item.reviewed === reviewed);
  const source = project.snapshots.find(item => item.id === sourceId) ?? snapshot;
  const coverage = projectCoverage(source);
  const currentCoverage = projectCoverage(snapshot).filter(issue => !activeProject || issue.recordIds.some(id => snapshot.records.some(record => record.id === id && record.project === activeProject)));
  const reviewer = projectReviewers.find(item => item.id === reviewerId);
  const openFinding = (item: ProjectFinding, trigger: HTMLButtonElement, response?: ProjectResponse) => { trigger.focus({ preventScroll: true }); setHistoricalResponse(response ?? null); setFinding(item); };
  return <div className={`z-app ${styles.app}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="z-rail" aria-label="Workspace navigation"><div className="z-brand"><Mark /></div>
      <nav className="z-nav" aria-label="Views">{projectViews.map(({ id, name, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)} title={name}><Icon aria-hidden="true" /><span>{name}</span></button>)}</nav>
    </aside>
    <div className="z-workspace">
      <header className="z-topbar"><button className="z-context" aria-haspopup="dialog" onClick={onWorlds}><FileText size={18} /><span>{workspace.profile.name}</span><ChevronDown size={14} /></button><span className="z-crumb">{projectViews.find(item => item.id === view)?.name}</span>
        <div className="z-top-actions"><div className="z-team" role="group" aria-label="Review agents">{projectReviewers.map(agent => <button className="avatar" title={agent.name} aria-label={`Inspect ${agent.name}`} key={agent.id} onClick={() => setReviewerId(agent.id)}>{agent.initials}</button>)}</div><span className="z-status" aria-label="Saved locally" title="Saved locally" /><IconButton icon={RefreshCw} label="Refresh data" onClick={onImport} /><IconButton icon={Download} label="Export" onClick={onExport} /></div>
      </header>
      <div className={`z-body ${styles.body}`}>
        <aside className="z-scopebar"><div className="z-scope-heading">Projects</div><nav className="z-scope-tree" aria-label="Projects"><button className={!activeProject ? "active" : ""} aria-pressed={!activeProject} onClick={() => setSelectedProject("")}><Compass size={14} /><span>All projects</span></button>{projects.map(name => <button className={activeProject === name ? "active" : ""} key={name} aria-pressed={activeProject === name} onClick={() => setSelectedProject(name)}><GitBranch size={14} /><span>{name}</span></button>)}</nav><div className="scope-meta"><span>{snapshot.records.length} records</span><small>Reported {dateLabel(snapshot.asOf)}</small></div></aside>
        <main className="z-main" id="main-content" tabIndex={-1}>
          <div className="z-heading"><h1>{projectViews.find(item => item.id === view)?.name}</h1><span className="muted mono">r{workspace.revision}</span></div>
          <div className={`z-content ${styles.content}`} key={`${workspace.profile.id}-${view}`}>
            {view === "situation" && <>
              <div className={styles.queueHeader}><div>{!openCount && <h2>{filtered.length ? "Current findings reviewed." : "No mapped conflicts."}</h2>}<p>{snapshot.name} · {snapshot.records.length} records · {dateLabel(snapshot.asOf)}</p></div><div className={styles.queueTabs} aria-label="Decision status"><button className={!reviewed ? "active" : ""} aria-pressed={!reviewed} onClick={() => setReviewed(false)}>Open <span>{openCount}</span></button><button className={reviewed ? "active" : ""} aria-pressed={reviewed} onClick={() => setReviewed(true)}>Reviewed <span>{filtered.filter(item => item.reviewed).length}</span></button></div></div>
              {queue.length > 0 ? <div className={styles.queue}>{[...new Set(queue.map(item => item.project))].map(name => <section key={name}><div className={styles.sectionHeading}><h3>{name}</h3><small>{queue.filter(item => item.project === name).length}</small></div>{queue.filter(item => item.project === name).map(item => {
                const Icon = findingIcons[item.kind];
                return <button className={styles.finding} key={item.id} onClick={event => openFinding(item, event.currentTarget)} aria-label={`Review ${item.title}`}><span className={`${styles.findingIcon} ${item.severity === "urgent" && !item.reviewed ? styles.urgent : ""}`}>{item.reviewed ? <Check size={18} /> : <Icon size={18} />}</span><span className={styles.findingCopy}><strong>{item.question}</strong><span>{item.summary}</span><small>{item.owners.length ? item.owners.join(" · ") : "Owner not recorded"} · {item.evidenceIds.length} source {item.evidenceIds.length === 1 ? "record" : "records"}</small></span><ArrowRight size={16} /></button>;
              })}</section>)}</div> : <div className={styles.empty}>{!reviewed && currentCoverage.length ? <FileText size={24} /> : <CircleCheck size={24} />}<p>{reviewed ? "No recorded decisions for these conditions." : filtered.length ? "Current conditions remain in Reviewed." : "No conflicts found in the mapped evidence."}</p>{currentCoverage.length > 0 && <small>{currentCoverage.length} coverage gaps are available in Sources.</small>}</div>}
              <div className={styles.reviewFootnote}><ShieldCheck size={13} /><span>Local review · deadlines, budgets, dependencies, decision requests</span></div>
            </>}
            {view === "sources" && <>
              <div className={styles.sourceHeader}><div><h2>{source.name}</h2><p>{dateLabel(source.asOf)} · {source.records.length} records</p></div><label className={styles.snapshotPicker}><span className="sr-only">Source version</span><select aria-label="Source version" value={sourceId === source.id ? source.id : "current"} onChange={event => setSourceId(event.target.value)}><option value="current">Current · {snapshot.asOf} · {snapshot.name}</option>{project.snapshots.slice(0, -1).reverse().map(item => <option value={item.id} key={item.id}>{item.asOf} · {item.name}</option>)}</select></label></div>
              {coverage.length > 0 && <details className={styles.coverage}><summary><TriangleAlert size={15} />Coverage <span>{coverage.length}</span></summary>{coverage.map(gap => <div key={gap.id}><strong>{gap.title}</strong><p>{gap.detail}</p></div>)}</details>}
              <div className={styles.sourceRecords}>{source.records.filter(record => !activeProject || record.project === activeProject).map(record => <SourceRecord key={record.id} record={record} snapshot={source} />)}</div>
            </>}
            {view === "record" && <>
              <div className={styles.queueHeader}><p>{project.responses.length} decisions recorded</p></div>
              {project.responses.length === 0 ? <div className={styles.empty}><BookOpen size={24} /><p>Your decisions will appear here.</p></div> : <div className={styles.history}>{project.responses.slice().reverse().map(response => {
                const cited = project.snapshots.find(item => item.id === response.snapshotId)!;
                const item = reviewProject({ version: 1, snapshots: [cited], responses: [] }, response.reviewDate).find(item => item.id === response.findingId)!;
                if (activeProject && item.project !== activeProject) return null;
                return <article key={response.id}><div className={styles.sectionHeading}><strong>{item.project}</strong><time dateTime={response.createdAt}>{dateLabel(response.createdAt.slice(0, 10))}</time></div><p>{response.decision}</p><button className="text-button" onClick={event => openFinding(item, event.currentTarget, response)}>{item.title}<ArrowRight size={13} /></button><small>{cited.name} · reported {dateLabel(cited.asOf)}</small></article>;
              })}</div>}
            </>}
          </div>
        </main>
      </div>
    </div>
    {finding && <FindingReview key={`${historicalResponse?.id ?? "live"}-${finding.snapshotId}-${finding.id}`} workspace={workspace} finding={finding} historicalResponse={historicalResponse} reviewDate={reviewDate} change={change} onClose={() => { setFinding(null); setHistoricalResponse(null); }} />}
    {reviewer && <Dialog title={reviewer.name} onClose={() => setReviewerId(null)}><div className={styles.reviewer}><span className="state-tag">Local · rule-based</span><h3>{reviewer.description}</h3><ul>{reviewer.rules.map(rule => <li key={rule}>{rule}</li>)}</ul><p>Reads the current source snapshot. Records no changes to your project systems.</p></div></Dialog>}
  </div>;
}
