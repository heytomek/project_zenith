# Project Zenith

**Strategic coordination for humans and agents: keep authorized promises coherent as conditions change.**

the active web application accepts real project exports and surfaces source-backed questions for human judgment. a separate modeled coordination loop uses shared primitives: scopes, objectives, claims, capabilities, interventions, mandates and outcomes. philosophy appears as explicit ends, protected limits, revisable knowledge and revocable authority. the [product vision](docs/product_vision.md) and the owner's [endstate](docs/endstate.md) define the larger direction. [strategic reconsideration](docs/strategic-reconsideration.md) connects published organizational practice, Cybersyn and Hegel to this product hypothesis.

## Use the platform

choose **Bring project data** on first entry, or **Bring data** in the workspace picker. open a CSV or JSON export, confirm its report date, map Title and Project, and inspect the preview. the [data contract and header-only template](docs/project-data.md#csv-template) cover supported columns; the import dialog also downloads the template. files stay in the browser.

real projects use **Attention · Sources · Record**. three local, rule-based review agents check declared deadlines, budget forecasts, dependencies and explicit decision requests, grouping findings by project. each question opens its cited source records and rule. record your judgment without changing the source or granting execution authority. refresh with a complete new snapshot to reconsider the latest evidence; unchanged review facts remain reviewed, while changed or recurring conditions reopen. source gaps stay in Sources rather than being presented as invented risks.

review runs on import, refresh and opening the workspace, with date checks while it remains open. there is no LLM provider, live connector, closed-browser monitor or external project-system write. older snapshots, recorded decisions and synthetic worlds remain available in the same portable library.

for modeled exploration, choose **Explore** for an active synthetic decision interrupted by changed evidence, or **Begin** for a fresh guided decision. the examples span three settings:

| World | Strategic question | Projection |
| --- | --- | --- |
| Harbor | Regional energy, housing and workforce transition without involuntary displacement | 36 months |
| Meridian | Manufacturing resilience without exhausting people or operating cash | 12 months |
| Open Atlas | An independent knowledge federation that preserves consent and maintainability | 18 months |

Each uses the same engine, dated synthetic sources, overlapping institutions, bounded capabilities and alternative portfolios. active episodes contain an accountable decision, real kernel reservations and partial consumption, a sourced synthetic change and affected commitments requiring judgment. earlier completed worked histories remain available through portable files and the unchanged `workedExample` generator. A custom world starts smaller; a validated raw `Profile` import can define a different domain.

**Situation · Strategies · Mandates · Ledger** organize one decision-to-outcome loop. review connects a changed claim to its declared dependency path, affected outcomes and responsible stewards. it separates the authorized projection, the declared baseline plus recorded outcomes and the reassessed remaining course; completed results are counted once. the next action follows the actual world: inspect consequential evidence, choose a course, accept delegated work, continue execution or review outcomes. compact attention items expose current capacity conflicts, changed sources and observed differences. top agent avatars open authority details.

**Compose** builds a strategy from the world's intervention catalogue. selecting work brings its unfinished prerequisites into the live preview; completed prerequisites remain linked to their earlier mandates. compare the new portfolio against existing alternatives and the current baseline, save it without granting authority, then authorize a feasible course with a rationale. saved strategies append to history; earlier decisions and resource ceilings remain frozen. rationale drafts survive navigation and reload in the same browser tab.

**Retain**, **Investigate** and **Stop** record an attributable response. a response cannot hide a live condition, enlarge authority or amend a frozen projection. stopping keeps unspent reservations until acknowledgment. candidate responses compare existing catalogue alternatives after an acknowledged stop, retaining spent resources and observations while costing unfinished work as a full restart. these are counterfactuals requiring new authorization and a new planning window, not promises to meet the original deadline.

manual evidence entry records a structured source snapshot with its title, author, publication date and excerpt. it is not an automatic connector or ETL pipeline.

**New instance** starts an independent comparison from the complete profile without erasing the original history. arbitrary interventions and causal models currently enter through a validated raw `Profile`; the composer does not invent new domain actions.

minimal glass belongs to navigation and controls; data uses solid surfaces. familiar actions use accessible icons. real-source review stays separate from synthetic execution: importing records creates no causal effects, resource reservations, mandates or simulated outcomes.

## Run

```sh
bun install --frozen-lockfile
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. Development uses `bun run dev:web`. No API, database migration or seed command is required.

state is saved under `zenith.coordination.v2`. export offers the current workspace or complete library, including imported source snapshots and judgments or modeled decisions, mandates, outcomes and receipts, with a SHA-256 checksum. workspace backups preview before application; replacing a library retains its previous raw copy. **Archive** preserves stored records: valid version-two libraries download as reopenable checksummed exports; version-one and unreadable records download verbatim.

generate the [portable examples](examples/coordination/README.md) from the source profiles with `bun run examples:coordination`. `examples/coordination` contains three editable raw profiles and `worked-worlds.json`, a reproducible library of completed synthetic histories.

## Check

```sh
bun test tests/coordination
bun run lint:web
bun run build:web
bun run typecheck:web
```

- `apps/web/lib/coordination`: project parsing and review, contracts, evaluation, bounded delegation and file integrity.
- `apps/web/components/coordination`: source import, decision attention, modeled views and browser persistence.
- `tests/coordination`: source provenance, review continuity, authority, frozen history, accounting and portable files.

verification results and their dates live in [current status](docs/implementation_status.md), [testing](docs/testing_guide.md) and [design QA](design-qa.md). see also [the running contract](docs/mvp.md) and [architecture](docs/system_architecture.md).

## Retained history

the former Alder interface is preserved in `docs/archive/2026-10-04/alder-interface`; its calculator and regression tests remain in `apps/web/lib/commons` and `tests/commons`. the active page uses `CoordinationApp`. the Python operational prototype in `apps/api`, `packages/schemas` and `services/planner` is disconnected from the active app. existing database files and migrations were not modified.

The replaced implementation documents are preserved in [the October archive](docs/archive/2026-10-04/README.md). Earlier operator web source is recoverable at Git commit `541316ebd2f9ec78ab09e6c0e24d9c0f3d763034`; the [September archive](docs/archive/2026-09-12/README.md) retains its prior specifications. `project_zenith.py` and `input.txt` are historical Tkinter artifacts.
