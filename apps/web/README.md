# Zenith web

updated November 2, 2026. the active page mounts `CoordinationApp`: a browser-local workspace for real-source decision review and modeled strategic coordination. see the [root README](../../README.md), [project data contract](../../docs/project-data.md), [running contract](../../docs/mvp.md) and [architecture](../../docs/system_architecture.md).

From the repository root:

```sh
bun run dev:web
```

For a stable production preview:

```sh
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3000
```

the only application route is `/`. real-project workspaces use `#situation` (Attention), `#sources` and `#record`. modeled worlds use `#situation`, `#strategies`, `#mandates` and `#ledger`. unknown legacy hashes fall back to the workspace's entry view. top agent avatars open the applicable local rules or modeled authority details.

**Bring project data** accepts CSV or JSON without a provider key. `project-data.ts` parses records, suggests column mappings and retains normalized values with original source cells. Title and Project are required; the dialog previews the mapping and downloads a header-only template. `project-review.ts` groups deadline, funding, dependency and requested-decision findings by project. these agents run explicit local rules, not LLM inference, and recompute on import, refresh, opening and date changes while the app remains open. source gaps are separate from decision findings.

`ProjectWorkspace` presents Attention, Sources and Record. a human response appends to the reviewed evidence; it cannot update source systems or execute work. unchanged relevant facts retain their reviewed state; changed or recurring conditions reopen. `core.ts` validates that project records reproduce from their cells and mapping, responses match their cited snapshot and rule fingerprint, and no simulated effects or execution rights enter project mode. see [the data contract](../../docs/project-data.md) for limits and refresh semantics.

onboarding offers Begin for fresh setup, Explore for an active synthetic decision episode, custom creation or file import. stored worlds reopen without reseeding; older completed worked histories remain compatible. Harbor, Meridian and Open Atlas use the same contracts and kernel commands. `lib/coordination/insights.ts` derives the current phase, next action and compact attention list; it does not persist a second workflow.

`lib/coordination/review.ts` compares the frozen promise, the declared baseline plus recorded outcomes and reassessed remaining course, connecting changed evidence to affected commitments and stewards. Retain/Investigate/Stop record responses; they do not clear constraints or broaden authority. response alternatives preserve spent resources and observations, cost unfinished work as a full restart and require new authorization and a new planning window.

manual evidence entry records a title, author, publication date and excerpt with a claim revision; it is not live ingestion. the `source-window-v1` execution guard blocks affected work when revised lead claims invalidate its original in-horizon effects. old unmarked histories retain historical replay semantics; unsigned files are not authenticated proof of actual action.

**Compose** appends a strategy from the existing intervention catalogue, with unfinished prerequisites and a live preview. completed prerequisites remain linked to their earlier mandates; their spending and observed effects are not repeated. strategy additions carry an authored revision and replayable payload. prior decisions stay frozen, and saving a strategy grants no execution authority.

`use-strategy-draft.ts` retains selection, rationale and composer input in tab-local session storage, separately from the authoritative library. drafts survive navigation, reopening and same-tab reload; they are not included in portable committed history.

all computation and persistence stay in the browser. the local key is `zenith.coordination.v2`; export offers the current workspace or complete library, including project snapshots and judgments, in a checksummed envelope. a raw validated `Profile` backup import adds a fresh modeled world. Archive downloads valid version-two libraries as reopenable exports and preserves version-one or unreadable records verbatim. the Python API is disconnected; the older Alder interface is preserved in `docs/archive/2026-10-04/alder-interface`, with its calculator and tests retained separately.

run `bun run examples:coordination` from the repository root to regenerate the editable profiles and worked library in [`examples/coordination`](../../examples/coordination/README.md).

verification results and their dates are recorded in [current status](../../docs/implementation_status.md) and [design QA](../../design-qa.md). [the research interpretation](../../docs/strategic-reconsideration.md) supplies product direction, not evidence of empirical forecast validity.

no live model provider, external execution agent, authentication, remote connector, background source polling or server persistence is implemented. file ingestion and local rule-based review are implemented.
