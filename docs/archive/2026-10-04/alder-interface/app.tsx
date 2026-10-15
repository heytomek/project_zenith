"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  FolderOpen,
  Download,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Users,
  Library,
  Info,
  RotateCcw,
  X,
} from "lucide-react";
import {
  MODEL_VERSION,
  PATHWAYS,
  canonical,
  evaluate,
  validateAssumptions,
  type Assumptions,
  type Pathway,
} from "@/lib/commons/model";
import { type EvidenceKey } from "@/lib/commons/evidence";
import {
  EMPTY_WORKSPACE,
  STORAGE_KEY,
  download,
  exportWorkspace,
  importWorkspace,
  parseWorkspace,
  workspaceSchema,
  type Decision,
  type DecisionFields,
  type Workspace,
} from "@/lib/commons/workspace";
import { Overview } from "./overview";
import { Pathways, type AssumptionInputs } from "./pathways";
import { RecordView, type EditingDecision } from "./record";
import { CaseEvidence, CaseTeam } from "./case-views";
import {
  ACTIVE_CASE_PATHWAY,
  CASE_WORKSPACE,
  TEAM,
} from "@/lib/commons/case-study";
const CASE_STORAGE_KEY = `${STORAGE_KEY}.alder`;
const VIEWS = [
  { id: "overview", label: "Case", icon: LayoutDashboard },
  { id: "pathways", label: "Compare", icon: FlaskConical },
  { id: "record", label: "Decisions", icon: FileText },
  { id: "evidence", label: "Evidence", icon: Library },
  { id: "team", label: "Team", icon: Users },
] as const;
const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("zenith-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("zenith-change", cb);
  };
};
const getStorage = () => {
  try {
    return localStorage.getItem(CASE_STORAGE_KEY) ?? "";
  } catch {
    return "unavailable";
  }
};
const subscribeView = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const getView = () =>
  ["#pathways", "#record", "#evidence", "#team"].includes(window.location.hash)
    ? window.location.hash.slice(1)
    : "overview";
const strings = (a: Assumptions): AssumptionInputs => ({
  voluntaryHours: String(a.voluntaryHours),
  leadMonths: String(a.leadMonths),
  reductionPercent: String(a.reductionPercent),
});
const uid = () => crypto.randomUUID();
export function CommonsApp() {
  const raw = useSyncExternalStore(subscribeStorage, getStorage, () => "");
  const view = useSyncExternalStore(subscribeView, getView, () => "overview");
  const saved = useMemo(() => {
    try {
      return {
        workspace: raw ? parseWorkspace(raw) : structuredClone(CASE_WORKSPACE),
        error: "",
      };
    } catch {
      return {
        workspace: structuredClone(EMPTY_WORKSPACE),
        error:
          raw === "unavailable"
            ? "Local storage is unavailable. Enable browser storage to save a workspace."
            : "The saved workspace could not be read. It has been preserved; download a copy before starting again.",
      };
    }
  }, [raw]);
  const workspace = saved.workspace;
  const [selected, setSelected] = useState<Pathway>(
    structuredClone(ACTIVE_CASE_PATHWAY),
  );
  const [inputs, setInputs] = useState<AssumptionInputs>(
    strings(selected.assumptions),
  );
  const [evidence, setEvidence] = useState<EvidenceKey | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<EvidenceKey | null>(
    null,
  );
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [editing, setEditing] = useState<EditingDecision | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => {
    const a: Assumptions = {
      voluntaryHours:
        inputs.voluntaryHours === "" ? NaN : Number(inputs.voluntaryHours),
      leadMonths: inputs.leadMonths === "" ? NaN : Number(inputs.leadMonths),
      reductionPercent:
        inputs.reductionPercent === "" ? NaN : Number(inputs.reductionPercent),
    };
    try {
      validateAssumptions(a);
      return { pathway: { ...selected, assumptions: a }, error: null };
    } catch (e) {
      return {
        pathway: selected,
        error: e instanceof Error ? e.message : "Enter valid assumptions.",
      };
    }
  }, [inputs, selected]);
  const pathway = parsed.pathway;
  const dirty =
    canonical(pathway.assumptions) !== canonical(selected.assumptions) ||
    !!parsed.error;
  const runs = useMemo(
    () => PATHWAYS.map((p) => evaluate(p.kind === pathway.kind ? pathway : p)),
    [pathway],
  );
  function navigate(next: string) {
    if (window.location.hash !== `#${next}`) {
      window.history.pushState(null, "", `#${next}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }
  function announce(text: string, error = false) {
    setNotice({ text, error });
  }
  function commit(next: Workspace, allowRecovery = false): boolean {
    try {
      if (saved.error && !allowRecovery) throw new Error(saved.error);
      const checked = workspaceSchema.parse(next);
      if (getStorage() !== raw)
        throw new Error(
          "This workspace changed in another tab. Review the latest state before saving again.",
        );
      const serialized = JSON.stringify(checked);
      if (serialized.length > 2_000_000)
        throw new Error(
          "The local workspace has reached its size limit. Your previous saved state is unchanged.",
        );
      localStorage.setItem(CASE_STORAGE_KEY, serialized);
      window.dispatchEvent(new Event("zenith-change"));
      return true;
    } catch (e) {
      announce(
        e instanceof Error && !e.message.startsWith("[")
          ? e.message
          : "The record could not be saved. Check its fields or export your existing workspace.",
        true,
      );
      return false;
    }
  }
  function choose(p: Pathway) {
    setSelected(structuredClone(p));
    setInputs(strings(p.assumptions));
  }
  function inspect(key: EvidenceKey | null) {
    setEvidence(key);
    if (key) navigate("pathways");
  }
  function openSource(id: string | null = null) {
    setSourceId(id);
    navigate("evidence");
  }
  function saveBranch(title: string) {
    if (parsed.error) return false;
    const branch = {
      ...structuredClone(pathway),
      id: uid(),
      title: title.trim(),
    };
    if (!commit({ ...workspace, branches: [...workspace.branches, branch] }))
      return false;
    choose(branch);
    announce(`Saved “${branch.title}”.`);
    return true;
  }
  function start(parent: Decision | null) {
    if (editing) {
      navigate("record");
      return;
    }
    if (!parent && parsed.error) {
      announce(parsed.error, true);
      return;
    }
    setEditing({
      pathway: structuredClone(parent?.pathway ?? pathway),
      parent,
    });
    navigate("record");
  }
  function recordTimestamp() {
    const times = [
      ...workspace.decisions,
      ...workspace.challenges,
      ...workspace.observations,
    ].map((record) => new Date(record.createdAt).getTime());
    return new Date(Math.max(Date.now(), ...times) + 1).toISOString();
  }
  function saveDecision(fields: DecisionFields, draft: EditingDecision) {
    const challenges = [
      ...new Map(
        [
          ...(draft.parent?.challenges ?? []),
          ...workspace.challenges.filter(
            (c) => c.pathway.kind === draft.pathway.kind,
          ),
        ].map((c) => [c.id, c]),
      ).values(),
    ];
    const d: Decision = {
      ...fields,
      id: uid(),
      parentId: draft.parent?.id ?? null,
      createdAt: recordTimestamp(),
      pathway: structuredClone(draft.pathway),
      challenges: structuredClone(challenges),
    };
    if (!commit({ ...workspace, decisions: [...workspace.decisions, d] }))
      return false;
    setDecisionId(d.id);
    setEditing(null);
    announce("Saved.");
    window.scrollTo({ top: 0 });
    return true;
  }
  async function exportFile() {
    if (saved.error) {
      download(raw, "zenith-workspace-recovery.txt", "text/plain");
      return;
    }
    setBusy(true);
    try {
      const copy = structuredClone(workspace);
      if (dirty && !parsed.error)
        copy.branches.push({
          ...structuredClone(pathway),
          id: uid(),
          title: `${pathway.title.slice(0, 58)} — exploration`,
        });
      const data = await exportWorkspace(copy);
      setExportData(data);
      download(data, "alder-workspace.json");
    } catch {
      announce(
        "The export could not be created. Your saved workspace is unchanged.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  async function readFile(file: File) {
    setBusy(true);
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a Zenith export smaller than 2 MB.");
      setPendingImport(await importWorkspace(await file.text()));
      announce("Verified.");
    } catch (e) {
      announce(
        e instanceof Error && !e.message.startsWith("[")
          ? e.message
          : "This is not a supported Zenith export. Your workspace is unchanged.",
        true,
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function openImport() {
    if (!pendingImport) return;
    try {
      localStorage.setItem(
        `${CASE_STORAGE_KEY}.previous`,
        raw || JSON.stringify(workspace),
      );
    } catch {
      announce(
        "Could not preserve the current workspace. Export it before replacing it.",
        true,
      );
      return;
    }
    if (commit(pendingImport, true)) {
      setDecisionId(pendingImport.decisions.at(-1)?.id ?? null);
      setEditing(null);
      choose(
        pendingImport.decisions.at(-1)?.pathway ??
          pendingImport.branches.at(-1) ??
          ACTIVE_CASE_PATHWAY,
      );
      setPendingImport(null);
      announce("Opened.");
      navigate(pendingImport.decisions.length ? "record" : "pathways");
    }
  }
  return (
    <div className="commons-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <a
          className="wordmark"
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
          aria-label="Zenith overview"
        >
          <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path
              d="M4 21 14 5l10 16M8 21h12M10.5 15h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Zenith
        </a>
        <div className="sidebar-project">
          <strong>Alder</strong>
          <span>Winter repairs</span>
        </div>
        <nav className="project-nav" aria-label="Project views">
          {VIEWS.filter(({ id }) => id !== "team").map(
            ({ id, label, icon: Icon }) => (
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (id === "evidence") setSourceId(null);
                  navigate(id);
                }}
                key={id}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
              </a>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <button
            className="text-button"
            onClick={() => setShowInfo(!showInfo)}
            aria-expanded={showInfo}
          >
            <Info size={15} /> Synthetic
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-location">
            <span>Alder</span>
            <span aria-hidden="true">/</span>
            <strong>{VIEWS.find((v) => v.id === view)?.label ?? "Case"}</strong>
          </div>
          <div className="workspace-actions">
            <button
              className="avatar-stack"
              aria-label="View the six case-study team members"
              aria-current={view === "team" ? "page" : undefined}
              title="Team"
              onClick={() => navigate("team")}
            >
              {TEAM.slice(0, 4).map((person) => (
                <span className="avatar" key={person.id} aria-hidden="true">
                  {person.initials}
                </span>
              ))}
              <span className="team-count">6</span>
            </button>
            <span
              className={`local-label ${editing || dirty ? "is-unsaved" : ""}`}
              role="status"
              aria-label={
                editing
                  ? "Draft in progress"
                  : dirty
                    ? "Unsaved assumptions"
                    : "Saved"
              }
              title={
                editing
                  ? "Draft in progress"
                  : dirty
                    ? "Unsaved assumptions"
                    : "Saved"
              }
            >
              <span className="status-dot" />
            </span>
            <button
              className="icon-button open-action"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              aria-label="Open workspace"
              title="Open workspace"
            >
              <FolderOpen size={18} />
            </button>
            <button
              className="icon-button export-action"
              disabled={busy || !!parsed.error}
              onClick={exportFile}
              aria-label={busy ? "Preparing export" : "Export workspace"}
              title="Export workspace"
            >
              <Download size={18} />
            </button>
            <input
              className="sr-only"
              type="file"
              ref={fileInput}
              accept=".json,application/json"
              aria-label="Open a Zenith workspace file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </div>
        </header>
        <div className="workspace-content">
          <div className="announcement" aria-live="polite" aria-atomic="true">
            {notice && (
              <div
                className={notice.error ? "error-banner" : "notice-banner"}
                role={notice.error ? "alert" : undefined}
              >
                <span>{notice.text}</span>
                <button
                  className="icon-button"
                  onClick={() => setNotice(null)}
                  aria-label="Dismiss message"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {saved.error && (
            <div className="error-banner">
              <p>{saved.error}</p>
              <button
                className="button secondary"
                onClick={() =>
                  download(raw, "zenith-workspace-recovery.txt", "text/plain")
                }
              >
                Download preserved data
              </button>
              {raw !== "unavailable" && (
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      localStorage.setItem(`${CASE_STORAGE_KEY}.previous`, raw);
                      if (commit(structuredClone(EMPTY_WORKSPACE), true))
                        announce(
                          "Empty workspace. Original retained in recovery.",
                        );
                    } catch {
                      announce(
                        "Backup failed; original data has been left intact.",
                        true,
                      );
                    }
                  }}
                >
                  Start empty with recovery backup
                </button>
              )}
            </div>
          )}
          {exportData && (
            <section className="export-preview" aria-label="Prepared export">
              <div className="section-heading">
                <div>
                  <h2>alder-workspace.json</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close export"
                  onClick={() => setExportData(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <button
                className="icon-button"
                onClick={() => download(exportData, "alder-workspace.json")}
                aria-label="Download JSON"
                title="Download JSON"
              >
                <Download size={18} />
              </button>
              <details>
                <summary>JSON</summary>
                <label className="sr-only" htmlFor="portable-json">
                  Portable workspace JSON
                </label>
                <textarea
                  id="portable-json"
                  readOnly
                  value={exportData}
                  rows={5}
                  spellCheck={false}
                  onFocus={(e) => e.target.select()}
                />
              </details>
            </section>
          )}
          {pendingImport && (
            <section className="import-preview" aria-labelledby="import-title">
              <h2 id="import-title">Open workspace</h2>
              <p>
                {pendingImport.branches.length} branches ·{" "}
                {pendingImport.decisions.length} revisions ·{" "}
                {pendingImport.challenges.length} challenges ·{" "}
                {pendingImport.observations.length} observations.
              </p>
              <p>Current workspace retained in recovery.</p>
              <div className="form-actions">
                <button className="button primary" onClick={openImport}>
                  Open
                </button>
                <button
                  className="icon-button"
                  onClick={exportFile}
                  aria-label="Export current workspace"
                  title="Export current workspace"
                >
                  <Download size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setPendingImport(null);
                    setNotice(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          {showInfo && (
            <section className="case-info" aria-label="About this case">
              <div className="section-heading">
                <h2>Alder · synthetic case</h2>
                <button
                  className="icon-button"
                  aria-label="Close case information"
                  onClick={() => setShowInfo(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <p>
                Six fictional collaborators, 120 homes, September 2026–March
                2027. Documents, people and observations are generated; the
                model calculates every forecast. Changes are stored locally.
              </p>
              <p className="fine-print">
                {MODEL_VERSION} · expected repair units, not health outcomes.
                Prior workspaces remain in their original storage.
              </p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      const prior = localStorage.getItem(STORAGE_KEY);
                      if (!prior) {
                        announce("No earlier workspace found.");
                        return;
                      }
                      setPendingImport(parseWorkspace(prior));
                    } catch {
                      announce("Earlier workspace could not be read.", true);
                    }
                  }}
                >
                  Earlier workspace
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        `${CASE_STORAGE_KEY}.previous`,
                        raw || JSON.stringify(workspace),
                      );
                      if (commit(structuredClone(CASE_WORKSPACE), true)) {
                        choose(ACTIVE_CASE_PATHWAY);
                        setEditing(null);
                        setDecisionId(null);
                        setShowInfo(false);
                        navigate("overview");
                        announce("Case restored. Previous copy retained.");
                      }
                    } catch {
                      announce("Recovery backup could not be saved.", true);
                    }
                  }}
                >
                  Restore case
                </button>
              </div>
            </section>
          )}
          <main id="main-content" className="workspace-main" tabIndex={-1}>
            {view === "overview" && (
              <Overview
                workspace={workspace}
                explore={(p) => {
                  choose(p);
                  navigate("pathways");
                }}
                record={(id) => {
                  if (!editing) setDecisionId(id);
                  navigate("record");
                }}
                inspect={inspect}
                sources={() => openSource()}
              />
            )}
            {view === "evidence" && (
              <CaseEvidence
                key={sourceId ?? "all"}
                sourceId={sourceId}
                inspect={inspect}
              />
            )}
            {view === "team" && (
              <CaseTeam workspace={workspace} sources={openSource} />
            )}
            <div hidden={view !== "pathways"}>
              <Pathways
                active={view === "pathways"}
                selected={pathway}
                inputs={inputs}
                dirty={dirty}
                error={parsed.error}
                runs={runs}
                branches={workspace.branches}
                challenges={workspace.challenges}
                evidence={evidence}
                choose={choose}
                change={(key, value) =>
                  setInputs((previous) => ({ ...previous, [key]: value }))
                }
                apply={(assumptions) => setInputs(strings(assumptions))}
                reset={() => setInputs(strings(selected.assumptions))}
                saveBranch={saveBranch}
                record={() => start(null)}
                inspect={inspect}
                sources={openSource}
                challengeTarget={challengeTarget}
                setChallengeTarget={setChallengeTarget}
                addChallenge={(target, text) => {
                  if (parsed.error) return false;
                  const next = {
                    id: uid(),
                    pathway: structuredClone(pathway),
                    target,
                    text: text.trim(),
                    createdAt: recordTimestamp(),
                  };
                  if (
                    !commit({
                      ...workspace,
                      challenges: [...workspace.challenges, next],
                    })
                  )
                    return false;
                  announce("Challenge saved.");
                  return true;
                }}
              />
            </div>
            <div hidden={view !== "record"}>
              <RecordView
                workspace={workspace}
                selectedId={decisionId}
                selectedPathway={pathway}
                editing={editing}
                select={(id) => {
                  setDecisionId(id);
                  setEditing(null);
                  const d = workspace.decisions.find((d) => d.id === id);
                  if (d) choose(d.pathway);
                }}
                start={start}
                cancel={() => setEditing(null)}
                save={saveDecision}
                observe={(id, month, remaining, note) => {
                  const observation = {
                    id: uid(),
                    decisionId: id,
                    createdAt: recordTimestamp(),
                    month,
                    remaining,
                    note: note.trim(),
                  };
                  if (
                    !commit({
                      ...workspace,
                      observations: [...workspace.observations, observation],
                    })
                  )
                    return false;
                  announce("Observation saved.");
                  return true;
                }}
              />
            </div>
          </main>
          <footer className="workspace-footer">
            <button
              className="icon-button recovery-button"
              aria-label="Recover previous workspace"
              title="Recover previous workspace"
              onClick={() => {
                try {
                  const previous = localStorage.getItem(
                    `${CASE_STORAGE_KEY}.previous`,
                  );
                  if (!previous) {
                    announce("No recovery copy yet.");
                    return;
                  }
                  setPendingImport(parseWorkspace(previous));
                  window.scrollTo({ top: 0 });
                } catch {
                  announce(
                    "The previous copy could not be opened. It remains in browser storage for recovery.",
                    true,
                  );
                }
              }}
            >
              <RotateCcw size={15} />
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
