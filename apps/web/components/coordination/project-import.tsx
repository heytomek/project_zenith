"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, FileSpreadsheet, LockKeyhole, Upload } from "lucide-react";
import {
  buildProjectSnapshot,
  parseProjectInput,
  PROJECT_FIELDS,
  suggestProjectMapping,
  type ParsedProjectInput,
  type ProjectField,
  type ProjectMapping,
  type ProjectSnapshot,
} from "@/lib/coordination/project-data";
import { Dialog } from "./primitives";
import styles from "./project-import.module.css";

const fieldNames: Record<ProjectField, string> = {
  id: "ID",
  title: "Title",
  project: "Project",
  owner: "Owner",
  status: "Status",
  due_date: "Due date",
  forecast_date: "Forecast date",
  budget: "Budget",
  forecast_cost: "Forecast cost",
  currency: "Currency",
  depends_on: "Dependencies",
  decision: "Decision requested",
  updated_at: "Updated",
  source_url: "Source URL",
};

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`${PROJECT_FIELDS.join(",")}\n`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "zenith-project.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectImport({ onSave, onClose, onRestore, initialName, previousSnapshot }: {
  onSave: (snapshot: ProjectSnapshot, workspaceName: string) => boolean;
  onClose: () => void;
  onRestore: () => void;
  initialName?: string;
  previousSnapshot?: ProjectSnapshot;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceName, setSourceName] = useState("");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedProjectInput | null>(null);
  const [mapping, setMapping] = useState<ProjectMapping>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readAt, setReadAt] = useState(() => new Date().toISOString());
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadText = (value: string, filename: string) => {
    try {
      const next = parseProjectInput(value);
      const suggested = suggestProjectMapping(next.columns);
      const prior = previousSnapshot?.mapping;
      const inherited = prior && Object.values(prior).every(column => !column || next.columns.includes(column)) ? prior : {};
      setParsed(next);
      setMapping({ ...suggested, ...inherited });
      setSourceName(filename);
      setReadAt(new Date().toISOString());
      if (!initialName && !name.trim()) setName(filename.replace(/\.(csv|json)$/i, "").slice(0, 160));
      setError("");
    } catch (cause) {
      setParsed(null);
      setError(cause instanceof Error ? cause.message : "This file could not be read.");
    }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    const current = ++selection.current;
    setBusy(true);
    setParsed(null);
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("Files must be smaller than 2 MB.");
      const value = await file.text();
      if (selection.current !== current) return;
      setText(value);
      loadText(value, file.name);
    } catch (cause) {
      if (selection.current === current) setError(cause instanceof Error ? cause.message : "This file could not be read.");
    } finally {
      if (selection.current === current) setBusy(false);
    }
  };

  const preview = useMemo(() => {
    if (!parsed) return { snapshot: null, error: "" };
    try {
      if (asOf > new Date().toISOString().slice(0, 10)) throw new Error("The report date cannot be in the future.");
      return { snapshot: buildProjectSnapshot(parsed, mapping, { name: sourceName, asOf, id: "preview", importedAt: readAt }), error: "" };
    } catch (cause) {
      return { snapshot: null, error: cause instanceof Error ? cause.message : "Check the mapped columns." };
    }
  }, [parsed, mapping, sourceName, asOf, readAt]);

  const save = () => {
    if (!parsed || !preview.snapshot || busy || saving || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const snapshot = buildProjectSnapshot(parsed, mapping, { name: sourceName, asOf });
      if (!onSave(snapshot, name.trim())) setSaving(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The source could not be opened.");
      setSaving(false);
    }
  };

  const field = (key: ProjectField) => <label key={key} className={styles.mapField}>
    <span>{fieldNames[key]}{(key === "title" || key === "project") && <span className={styles.required} aria-label="required"> ·</span>}</span>
    <select aria-label={`${fieldNames[key]} column`} value={mapping[key] ?? ""} onChange={event => {
      const value = event.target.value;
      setMapping(current => { const next = { ...current }; if (value) next[key] = value; else delete next[key]; return next; });
    }}>
      <option value="">{key === "title" || key === "project" ? "Choose column" : "—"}</option>
      {parsed?.columns.map(column => <option key={column} value={column}>{column}</option>)}
    </select>
  </label>;

  const displayedError = error || preview.error;
  const snapshot = preview.snapshot;
  const omitted = previousSnapshot && snapshot ? previousSnapshot.records.filter(record => !snapshot.records.some(next => next.id === record.id)).length : 0;
  return <Dialog title={initialName ? "Refresh source" : "Bring project data"} className={styles.dialog} onClose={onClose}
    footer={<div className={styles.footer}>
      <button className="text-button" type="button" onClick={onRestore}>Workspace backup</button>
      <button className="button primary" type="button" disabled={!snapshot || !name.trim() || busy || saving} onClick={save}>
        {initialName ? "Refresh" : "Open"}<ArrowRight size={15} />
      </button>
    </div>}>
    <div className={styles.body}>
      <div className={styles.sourcePicker}>
        <input ref={fileInput} type="file" accept=".csv,.json,text/csv,application/json" aria-label="Project data file" className={styles.fileInput} onChange={event => { const file = event.target.files?.[0]; void readFile(file); event.target.value = ""; }} />
        <button className="button" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload size={15} />{busy ? "Reading…" : "Choose file"}
        </button>
        <span className={styles.filename}>{sourceName || "CSV or JSON"}</span>
        <button className={`text-button ${styles.template}`} type="button" onClick={downloadTemplate}><Download size={14} />Template</button>
      </div>
      <small className={styles.local}><LockKeyhole size={11} />Files stay in this browser.</small>
      <details className={styles.paste}>
        <summary>Paste data</summary>
        <label className="sr-only" htmlFor="project-paste">Project CSV or JSON</label>
        <textarea id="project-paste" rows={6} spellCheck={false} value={text} placeholder="Paste a project export" onChange={event => { selection.current++; setBusy(false); setText(event.target.value); setParsed(null); setError(""); }} />
        <button className="button" type="button" disabled={!text.trim() || busy} onClick={() => { selection.current++; loadText(text, text.trimStart().startsWith("[") || text.trimStart().startsWith("{") ? "Pasted data.json" : "Pasted data.csv"); }}>Preview<ArrowRight size={14} /></button>
      </details>

      {parsed && <div className={styles.review}>
        <div className={styles.metadata}>
          <label><span>Workspace</span><input value={name} maxLength={160} readOnly={Boolean(initialName)} placeholder="Project portfolio" onChange={event => setName(event.target.value)} /></label>
          <label><span>Report date</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
        </div>
        <div className={styles.requiredMapping}>{field("title")}{field("project")}</div>
        <details className={styles.mapping}>
          <summary>Columns <small>{Object.values(mapping).filter(Boolean).length} mapped</small></summary>
          <div className={styles.mappingGrid}>{PROJECT_FIELDS.filter(key => key !== "title" && key !== "project").map(field)}</div>
        </details>
        {snapshot && <section className={styles.preview} aria-label="Source preview">
          <div className={styles.previewHeading}><span><FileSpreadsheet size={15} /><strong>{snapshot.records.length} records</strong><span>· {new Set(snapshot.records.map(record => record.project)).size} projects</span></span><Check size={15} aria-label="Valid source" /></div>
          <div className={styles.coverage} aria-label="Source coverage"><span>Due dates <strong>{snapshot.records.filter(record => record.dueDate).length}/{snapshot.records.length}</strong></span><span>Cost pairs <strong>{snapshot.records.filter(record => record.budget !== null && record.forecastCost !== null).length}/{snapshot.records.length}</strong></span></div>
          {omitted > 0 && <p className={styles.refreshNote}>{omitted} prior {omitted === 1 ? "record is" : "records are"} absent. Refresh replaces the current snapshot; absence does not establish completion.</p>}
          <div className={styles.table} role="region" aria-label="Mapped project records" tabIndex={0}><table>
            <thead><tr><th scope="col">Title</th><th scope="col">Project</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>
            <tbody>{snapshot.records.slice(0, 5).map(record => <tr key={record.id}><td>{record.title}</td><td>{record.project}</td><td>{record.owner || "—"}</td><td>{record.dueDate || "—"}</td><td>{snapshot.mapping.status && record.cells[snapshot.mapping.status]?.trim() ? record.status : "Unstated"}</td></tr>)}</tbody>
          </table></div>
          {snapshot.records.length > 5 && <small>First 5 of {snapshot.records.length} records</small>}
        </section>}
      </div>}
      {displayedError && <p role="alert" className={styles.error}>{displayedError}</p>}
    </div>
  </Dialog>;
}
