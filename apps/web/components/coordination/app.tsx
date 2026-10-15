"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Download,
  GitBranch,
  Info,
  Layers3,
  Plus,
  Printer,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  authorize,
  createWorkspace,
  rejectProbe,
  updateClaim,
  validateProfile,
} from "@/lib/coordination/core";
import { workedExample } from "@/lib/coordination/examples";
import { PROFILES } from "@/lib/coordination/profiles";
import {
  exportLibrary,
  importLibrary,
  STORAGE_KEY,
  validateLibrary,
} from "@/lib/coordination/storage";
import type { Library, Profile, Workspace } from "@/lib/coordination/types";
import { NewWorld, Onboarding } from "./onboarding";
import {
  Dialog,
  download,
  IconButton,
  Mark,
  metric,
  WorldIcon,
} from "./primitives";
import {
  AgentDetail,
  ClaimDetail,
  DecisionDetail,
  Ledger,
  Mandates,
  scopeDepth,
  Situation,
  Strategies,
  type Inspect,
  type View,
} from "./views";
import { useLibrary } from "./use-library";

const views = [
  { id: "situation", name: "Situation", icon: Compass },
  { id: "strategies", name: "Strategies", icon: GitBranch },
  { id: "mandates", name: "Mandates", icon: ShieldCheck },
  { id: "ledger", name: "Ledger", icon: BookOpen },
] as const;
type Modal = "worlds" | "new" | "info" | "export" | "import" | null;
type ImportPreview =
  { kind: "library"; value: Library } | { kind: "profile"; value: Profile };
const guide = {
  situation: "Inspect a source. Its assumptions feed the comparison.",
  strategies:
    "Compare the tradeoffs. Authorize a strategy with your rationale.",
  mandates: "Accept the portfolio, then advance the simulated specialists.",
  ledger: "Compare observed outcomes with the decision’s frozen projection.",
};

export function CoordinationApp() {
  const { library, change, notice, setNotice } = useLibrary();
  const [view, setView] = useState<View>("situation");
  const [scopeId, setScopeId] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [inspection, setInspection] = useState<Inspect | null>(null);
  const [exportText, setExportText] = useState("");
  const [exportSnapshot, setExportSnapshot] = useState<Library | null>(null);
  const [exportMode, setExportMode] = useState<"world" | "library">("library");
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [archives, setArchives] = useState<{ key: string; text: string }[]>([]);
  const previousWorld = useRef<string | undefined>(undefined);
  const workspace = library?.workspaces.find(
    (item) => item.profile.id === library.activeId,
  );
  const activeScope = workspace?.profile.scopes.find(
    (scope) => scope.id === scopeId,
  );
  const activeScopeId = activeScope?.id ?? "*";
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (id === "main-content") return;
      setView(views.find((item) => item.id === id)?.id ?? "situation");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    document.title = workspace
      ? `${workspace.profile.name} · Zenith`
      : "Zenith";
    if (
      previousWorld.current &&
      previousWorld.current !== workspace?.profile.id
    ) {
      queueMicrotask(() => {
        setInspection(null);
        setScopeId("");
        setModal(null);
      });
    }
    previousWorld.current = workspace?.profile.id;
  }, [workspace]);
  const navigate = (next: View) => {
    setView(next);
    if (window.location.hash !== `#${next}`)
      window.history.pushState(null, "", `#${next}`);
  };
  const update = (transform: (previous: Workspace) => Workspace): boolean =>
    change((previous) => {
      const active = previous.workspaces.find(
        (item) => item.profile.id === previous.activeId,
      );
      if (!active) throw new Error("Choose a world first.");
      if (
        active.profile.id !== workspace?.profile.id ||
        active.revision !== workspace.revision
      )
        throw new Error(
          "The workspace changed. Review the current state before acting.",
        );
      const next = transform(active);
      return {
        ...previous,
        workspaces: previous.workspaces.map((item) =>
          item.profile.id === active.profile.id ? next : item,
        ),
      };
    });
  const start = (profile: Profile, guided: boolean) => {
    const existing = library?.workspaces.some(
      (item) => item.profile.id === profile.id,
    );
    const saved = change((previous) => ({
      ...previous,
      activeId: profile.id,
      onboardingDone: existing ? previous.onboardingDone : !guided,
      workspaces: previous.workspaces.some(
        (item) => item.profile.id === profile.id,
      )
        ? previous.workspaces
        : [
            ...previous.workspaces,
            guided ? createWorkspace(profile) : workedExample(profile),
          ],
    }));
    if (saved) {
      setScopeId("");
      setInspection(null);
      setModal(null);
      navigate(existing || guided ? "situation" : "ledger");
    }
  };
  const choose = (id: string) => {
    if (change((previous) => ({ ...previous, activeId: id }))) {
      setScopeId("");
      setInspection(null);
      setModal(null);
      navigate("situation");
    }
  };
  const close = () => {
    setModal(null);
    setInspection(null);
    setFileError("");
  };
  const openExport = async (mode: "world" | "library" = "library") => {
    if (!library || !workspace) return;
    const snapshot =
      mode === "library" ? library : { ...library, workspaces: [workspace] };
    setBusy(true);
    setModal("export");
    setFileError("");
    setExportText("");
    setExportSnapshot(null);
    setExportMode(mode);
    try {
      setExportText(await exportLibrary(snapshot));
      setExportSnapshot(snapshot);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  const checkImport = async (text: string) => {
    setBusy(true);
    setFileError("");
    setPreview(null);
    try {
      if (new TextEncoder().encode(text).length > 2_000_000)
        throw new Error("Files must be smaller than 2 MB.");
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setPreview(
        parsed?.format === "zenith-coordination"
          ? { kind: "library", value: await importLibrary(text) }
          : { kind: "profile", value: validateProfile(parsed) },
      );
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Invalid file.");
    } finally {
      setBusy(false);
    }
  };
  const applyImport = () => {
    if (!preview) return;
    const accepted =
      preview.kind === "library"
        ? change(() => preview.value, true)
        : change((previous) => {
            if (
              previous.workspaces.some(
                (item) => item.profile.id === preview.value.id,
              )
            )
              throw new Error(
                "This world already exists. Give the imported profile a new identity.",
              );
            return {
              ...previous,
              activeId: preview.value.id,
              onboardingDone: false,
              workspaces: [
                ...previous.workspaces,
                createWorkspace(preview.value),
              ],
            };
          });
    if (accepted) {
      setPreview(null);
      setImportText("");
      close();
      setScopeId("");
      navigate("situation");
      setNotice("Opened. The previous library is available in Archive.");
    }
  };
  const readFile = async (file?: File) => {
    try {
      if (!file) return;
      if (file.size > 2_000_000)
        throw new Error("Files must be smaller than 2 MB.");
      const text = await file.text();
      setImportText(text);
      await checkImport(text);
    } catch (error) {
      setPreview(null);
      setFileError(
        error instanceof Error ? error.message : "The file could not be read.",
      );
    }
  };
  const readArchives = () => {
    try {
      const keys = [
        "zenith.commons.v1",
        "zenith.commons.v1.alder",
        "zenith.commons.v1.alder.previous",
        `${STORAGE_KEY}.previous`,
        STORAGE_KEY,
      ];
      setArchives(
        keys.flatMap((key) => {
          const text = localStorage.getItem(key);
          return text ? [{ key, text }] : [];
        }),
      );
    } catch {
      setFileError("Browser storage is unavailable.");
    }
  };
  const downloadArchive = async (archive: { key: string; text: string }) => {
    let text = archive.text;
    if (archive.key.startsWith(STORAGE_KEY)) {
      try {
        text = await exportLibrary(validateLibrary(JSON.parse(text)));
      } catch {
        /* Preserve unreadable records verbatim. */
      }
    }
    download(text, `${archive.key}.json`);
  };
  const notices = notice && (
    <div className="z-notice" role="status">
      <span>{notice}</span>
      <IconButton
        icon={X}
        label="Dismiss notification"
        onClick={() => setNotice("")}
      />
    </div>
  );
  if (!library)
    return (
      <main className="z-loading" aria-busy="true">
        <Mark />
        <span className="sr-only">Opening Zenith</span>
      </main>
    );
  if (!workspace)
    return (
      <>
        <Onboarding
          onStart={start}
          profiles={[
            ...library.workspaces.map((item) => item.profile),
            ...PROFILES.filter(
              (profile) =>
                !library.workspaces.some(
                  (item) => item.profile.id === profile.id,
                ),
            ),
          ]}
          existingIds={library.workspaces.map((item) => item.profile.id)}
          onImport={() => {
            setModal("import");
            setPreview(null);
            setImportText("");
          }}
        />
        {notice && (
          <div className="onboarding-recovery">
            <button
              className="button"
              onClick={() => {
                setModal("import");
                readArchives();
              }}
            >
              Recover workspace <Upload size={15} />
            </button>
          </div>
        )}
        {notices}
        {modal === "import" && (
          <Dialog title={notice ? "Recover" : "Import"} onClose={close}>
            <label className="z-fields">
              File
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => readFile(event.target.files?.[0])}
              />
            </label>
            <label className="z-fields">
              Workspace JSON
              <textarea
                aria-label="Workspace JSON"
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <button className="button" onClick={() => checkImport(importText)}>
              Validate
            </button>
            {fileError && (
              <p role="alert" className="negative">
                {fileError}
              </p>
            )}
            {preview && (
              <>
                <p>
                  {preview.kind === "library"
                    ? `${preview.value.workspaces.length} validated worlds`
                    : preview.value.name}
                </p>
                <button
                  className="button primary"
                  onClick={applyImport}
                  disabled={busy}
                >
                  Open <ArrowRight size={15} />
                </button>
              </>
            )}
            <div className="archive-list">
              {archives.map((archive) => (
                <button
                  className="button"
                  key={archive.key}
                  onClick={() => downloadArchive(archive)}
                >
                  <Download size={15} />
                  {archive.key}
                </button>
              ))}
            </div>
          </Dialog>
        )}
      </>
    );
  const profile = workspace.profile;
  const inspectClaim =
    inspection?.kind === "claim"
      ? profile.claims.find((item) => item.id === inspection.id)
      : null;
  const inspectAgent =
    inspection?.kind === "agent"
      ? profile.agents.find((item) => item.id === inspection.id)
      : null;
  const inspectDecision =
    inspection?.kind === "decision"
      ? workspace.decisions.find((item) => item.id === inspection.id)
      : null;
  const inspectScope =
    inspection?.kind === "scope"
      ? profile.scopes.find((item) => item.id === inspection.id)
      : null;
  const title =
    inspectClaim?.label ??
    inspectAgent?.name ??
    (inspectDecision ? "Decision" : (inspectScope?.name ?? ""));
  const viewProps = {
    workspace,
    scopeId: activeScopeId,
    inspect: setInspection,
    change: update,
  };
  return (
    <div className="z-app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="z-rail" aria-label="Workspace navigation">
        <div className="z-brand" title="Zenith">
          <Mark />
        </div>
        <nav className="z-nav" aria-label="Views">
          {views.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={view === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={view === id ? "page" : undefined}
              title={name}
            >
              <Icon aria-hidden="true" />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <IconButton
          icon={Info}
          label="About this world"
          onClick={() => setModal("info")}
        />
      </aside>
      <div className="z-workspace">
        <header className="z-topbar">
          <button
            className="z-context"
            onClick={() => {
              setModal("worlds");
              setArchives([]);
            }}
            aria-haspopup="dialog"
          >
            <WorldIcon kind={profile.icon} />
            <span>{profile.name}</span>
            <ChevronDown size={14} />
          </button>
          <span className="z-crumb">
            {activeScope?.name ?? views.find((item) => item.id === view)?.name}
          </span>
          <div className="z-top-actions">
            <div className="z-team" role="group" aria-label="Specialists">
              {profile.agents.map((agent) => (
                <button
                  className="avatar"
                  key={agent.id}
                  title={agent.name}
                  aria-label={`Inspect ${agent.name}`}
                  onClick={() => setInspection({ kind: "agent", id: agent.id })}
                >
                  {agent.initials}
                </button>
              ))}
            </div>
            <span
              className="z-status"
              title="Saved locally"
              aria-label="Saved locally"
            />
            <IconButton
              icon={Upload}
              label="Import"
              onClick={() => {
                setModal("import");
                setPreview(null);
                setImportText("");
              }}
            />
            <IconButton
              icon={Download}
              label="Export"
              onClick={() => openExport()}
            />
          </div>
        </header>
        <div className="z-body">
          <aside className="z-scopebar">
            <div className="z-scope-heading">
              <span>Scopes</span>
              {activeScope && (
                <IconButton
                  icon={Layers3}
                  label="Inspect selected scope"
                  onClick={() =>
                    setInspection({ kind: "scope", id: activeScopeId })
                  }
                />
              )}
            </div>
            <nav className="z-scope-tree" aria-label="Scopes">
              <button
                className={activeScopeId === "*" ? "active" : ""}
                aria-pressed={activeScopeId === "*"}
                onClick={() => setScopeId("")}
              >
                <Compass size={15} />
                <span>Whole world</span>
              </button>
              {profile.scopes.map((scope) => (
                <button
                  key={scope.id}
                  className={activeScopeId === scope.id ? "active" : ""}
                  aria-pressed={activeScopeId === scope.id}
                  style={{
                    paddingLeft: `${10 + scopeDepth(profile, scope) * 12}px`,
                  }}
                  onClick={() => setScopeId(scope.id)}
                >
                  <GitBranch size={15} />
                  <span>{scope.name}</span>
                </button>
              ))}
            </nav>
            <div className="scope-meta">
              <span>{profile.horizonMonths} months</span>
              <small>{profile.authority}</small>
            </div>
          </aside>
          <main className="z-main" id="main-content" tabIndex={-1}>
            <div className="z-heading">
              <h1>{views.find((item) => item.id === view)?.name}</h1>
              <span className="muted mono">r{workspace.revision}</span>
            </div>
            {!library.onboardingDone && (
              <div className="z-guide">
                <span className="guide-count">
                  {views.findIndex((item) => item.id === view) + 1}/4
                </span>
                <p>{guide[view]}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    if (view === "ledger")
                      change((previous) => ({
                        ...previous,
                        onboardingDone: true,
                      }));
                    else
                      navigate(
                        views[views.findIndex((item) => item.id === view) + 1]
                          .id,
                      );
                  }}
                >
                  {view === "ledger" ? "Done" : "Next"}
                  <ArrowRight size={14} />
                </button>
                <IconButton
                  icon={X}
                  label="Skip guide"
                  onClick={() =>
                    change((previous) => ({
                      ...previous,
                      onboardingDone: true,
                    }))
                  }
                />
              </div>
            )}
            <div className="z-content" key={`${profile.id}-${view}`}>
              {view === "situation" && (
                <Situation
                  {...viewProps}
                  selectScope={setScopeId}
                  navigate={navigate}
                  shock={(id) => {
                    const shock = profile.shocks.find(
                      (item) => item.id === id,
                    )!;
                    if (
                      update((w) => updateClaim(w, shock.claimId, shock.value))
                    )
                      setNotice(shock.description);
                  }}
                />
              )}
              {view === "strategies" && (
                <Strategies
                  {...viewProps}
                  onAuthorize={(id, rationale) => {
                    if (update((w) => authorize(w, id, rationale)))
                      navigate("mandates");
                  }}
                />
              )}
              {view === "mandates" && (
                <Mandates {...viewProps} navigate={navigate} />
              )}
              {view === "ledger" && <Ledger {...viewProps} />}
            </div>
          </main>
        </div>
      </div>
      {notices}
      {inspection && (
        <Dialog
          title={title}
          onClose={close}
          footer={
            inspectDecision && (
              <IconButton
                icon={Printer}
                label="Print decision"
                onClick={() => window.print()}
              />
            )
          }
        >
          {inspectClaim && (
            <ClaimDetail
              key={`${profile.id}-${inspectClaim.id}`}
              workspace={workspace}
              claim={inspectClaim}
              onSave={(value, revision) => {
                if (
                  update((w) =>
                    updateClaim(w, inspectClaim.id, value, revision),
                  )
                )
                  close();
              }}
            />
          )}
          {inspectAgent && (
            <AgentDetail
              workspace={workspace}
              agent={inspectAgent}
              probe={(id) => {
                if (update((w) => rejectProbe(w, id)))
                  setNotice(
                    "Rejected. The resource ceiling and scope remain unchanged. Receipt added to Ledger.",
                  );
              }}
            />
          )}
          {inspectDecision && (
            <DecisionDetail workspace={workspace} decision={inspectDecision} />
          )}
          {inspectScope && (
            <div className="scope-detail">
              <p>{inspectScope.description}</p>
              <div className="source-meta">
                <span>{inspectScope.kind}</span>
                <span>{inspectScope.steward}</span>
              </div>
              <h3>Overlaps</h3>
              {inspectScope.relatedIds.length ? (
                <div className="claim-chips">
                  {inspectScope.relatedIds.map((id) => (
                    <button
                      className="button"
                      key={id}
                      onClick={() => {
                        setScopeId(id);
                        close();
                      }}
                    >
                      {profile.scopes.find((item) => item.id === id)?.name}
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No overlapping scopes recorded.</p>
              )}
              <h3>Protected conditions</h3>
              {profile.objectives
                .filter((item) => item.protection)
                .map((item) => (
                  <p key={item.id}>
                    <LockCondition label={item.label} />{" "}
                    {item.protection?.min !== undefined
                      ? `≥ ${metric(item.protection.min, item.unit)}`
                      : `≤ ${metric(item.protection!.max!, item.unit)}`}
                  </p>
                ))}
              <small className="muted">
                Containment describes context. Capability offers and delegated
                scope determine authority.
              </small>
            </div>
          )}
        </Dialog>
      )}
      {modal === "worlds" && (
        <Dialog
          title="Worlds"
          onClose={close}
          footer={
            <>
              <button className="text-button" onClick={readArchives}>
                Archive
              </button>
              <button
                className="button"
                onClick={() =>
                  start(
                    {
                      ...structuredClone(profile),
                      id: `instance-${crypto.randomUUID()}`,
                      name: `${profile.name} · new instance`,
                    },
                    true,
                  )
                }
              >
                <GitBranch size={15} />
                New instance
              </button>
              <button className="button" onClick={() => setModal("new")}>
                <Plus size={16} />
                New world
              </button>
            </>
          }
        >
          <div className="z-switcher">
            {[
              ...library.workspaces.map((item) => item.profile),
              ...PROFILES.filter(
                (item) =>
                  !library.workspaces.some((w) => w.profile.id === item.id),
              ),
            ].map((item) => (
              <button
                className="profile-option"
                key={item.id}
                onClick={() =>
                  library.workspaces.some((w) => w.profile.id === item.id)
                    ? choose(item.id)
                    : start(item, false)
                }
              >
                <WorldIcon kind={item.icon} />
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.subtitle}</small>
                </div>
                {item.id === profile.id ? (
                  <Check size={16} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            ))}
          </div>
          {archives.length > 0 && (
            <div className="archive-list">
              <h3>Preserved browser records</h3>
              {archives.map((archive) => (
                <button
                  className="text-button"
                  key={archive.key}
                  onClick={() => downloadArchive(archive)}
                >
                  <Download size={14} />
                  {archive.key}
                </button>
              ))}
            </div>
          )}
        </Dialog>
      )}
      {modal === "new" && (
        <Dialog title="New world" onClose={close}>
          <NewWorld onCreate={(item) => start(item, true)} />
        </Dialog>
      )}
      {modal === "info" && (
        <Dialog title={profile.name} onClose={close}>
          <div className="z-source">
            <div className="source-meta">
              <span className="state-tag assumed">Synthetic</span>
              <span>
                {profile.date} · {profile.horizonMonths} months
              </span>
            </div>
            <p>{profile.context}</p>
            <div className="z-principles">
              <ul>
                {profile.principles.map((principle) => (
                  <li key={principle}>{principle}</li>
                ))}
              </ul>
            </div>
            <details className="model-contract">
              <summary>Model</summary>
              <p>
                Effects are additive and scale with the linked claims.
                Dependencies determine completion time; effects from work
                finishing beyond the projection horizon are excluded. Capacity
                is shared by identity across scopes.
              </p>
              <p>
                Specialists advance in three simulated steps per intervention.
                Synthetic observed effects use a fixed completion factor.
                Imported records are validated and replayed; local authority is
                a contract, not production authentication.
              </p>
            </details>
          </div>
        </Dialog>
      )}
      {modal === "export" && (
        <Dialog
          title="Export"
          onClose={close}
          footer={
            <button
              className="button primary"
              onClick={() => download(exportText, "zenith-worlds.json")}
              disabled={busy || !exportText}
            >
              <Download size={16} />
              Download
            </button>
          }
        >
          <div className="z-tabs" role="group" aria-label="Export scope">
            <button
              className={exportMode === "world" ? "active" : ""}
              aria-pressed={exportMode === "world"}
              disabled={busy}
              onClick={() => openExport("world")}
            >
              Current world
            </button>
            <button
              className={exportMode === "library" ? "active" : ""}
              aria-pressed={exportMode === "library"}
              disabled={busy}
              onClick={() => openExport("library")}
            >
              All worlds
            </button>
          </div>
          {fileError && (
            <p className="negative" role="alert">
              {fileError}
            </p>
          )}
          {exportSnapshot && (
            <p>
              {exportSnapshot.workspaces.length} worlds ·{" "}
              {exportSnapshot.workspaces.reduce(
                (total, item) => total + item.decisions.length,
                0,
              )}{" "}
              decisions ·{" "}
              {exportSnapshot.workspaces.reduce(
                (total, item) => total + item.mandates.length,
                0,
              )}{" "}
              mandates
            </p>
          )}
          <details className="export-code">
            <summary>JSON</summary>
            <textarea
              aria-label="Export JSON"
              readOnly
              value={exportText}
              spellCheck={false}
            />
          </details>
        </Dialog>
      )}
      {modal === "import" && (
        <Dialog
          title="Import"
          onClose={close}
          footer={
            <button
              className="button primary"
              onClick={applyImport}
              disabled={!preview || busy}
            >
              Open <ArrowRight size={15} />
            </button>
          }
        >
          <div className="z-fields">
            <label>
              File
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => readFile(event.target.files?.[0])}
              />
            </label>
            <details>
              <summary>Paste JSON</summary>
              <label className="sr-only" htmlFor="import-json">
                Import JSON
              </label>
              <textarea
                id="import-json"
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setPreview(null);
                }}
                spellCheck={false}
              />
              <button
                className="button"
                onClick={() => checkImport(importText)}
                disabled={busy || !importText.trim()}
              >
                Validate
              </button>
            </details>
            {fileError && (
              <p className="negative" role="alert">
                {fileError}
              </p>
            )}
            {preview && (
              <div className="z-alert positive">
                <Check size={16} />
                <span>
                  {preview.kind === "library"
                    ? `${preview.value.workspaces.length} validated worlds. The current library will be backed up.`
                    : `${preview.value.name} · ${preview.value.scopes.length} scopes · ${preview.value.strategies.length} strategies`}
                </span>
              </div>
            )}
            <small className="muted">
              A Zenith export or a complete profile JSON. 2 MB maximum.
            </small>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function LockCondition({ label }: { label: string }) {
  return <strong>{label}</strong>;
}
