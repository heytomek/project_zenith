# Project Zenith

**Strategic coordination for humans and agents: understand a changing world, choose coherent strategies, delegate bounded action, and revise from evidence.**

The active web application implements a local coordination kernel around shared primitives: scopes, objectives, claims, capabilities, interventions, mandates and outcomes. Philosophy appears as explicit ends, protected limits, revisable knowledge and revocable authority. The [product vision](docs/product_vision.md) and the owner's [endstate](docs/endstate.md) define the larger direction.

## Use the platform

Choose **Begin** for a fresh guided decision or **Worked case** for a populated synthetic history. The examples span three settings:

| World | Strategic question | Projection |
| --- | --- | --- |
| Harbor | Regional energy, housing and workforce transition without involuntary displacement | 36 months |
| Meridian | Manufacturing resilience without exhausting people or operating cash | 12 months |
| Open Atlas | An independent knowledge federation that preserves consent and maintainability | 18 months |

Each uses the same engine, dated synthetic sources, overlapping institutions, bounded capabilities and alternative portfolios. Worked cases contain an accountable decision, completed simulated mandates, forecast error and a subsequent source revision. A custom world starts smaller; a validated raw `Profile` import can define a different domain.

**Situation · Strategies · Mandates · Ledger** organize the workspace. Top agent avatars open authority details. Compare objectives and dependencies, inspect a source, revise a claim, authorize a feasible strategy, accept bounded mandates, advance the simulated specialists and reconcile outcomes. **New instance** starts an independent comparison from the complete profile without erasing the original history.

Minimal glass belongs to navigation and controls; data uses solid surfaces. Familiar actions use accessible icons. The application is a local demonstration: no live agent execution, shared organizational authority or external data ingestion is implied.

## Run

```sh
bun install --frozen-lockfile
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. Development uses `bun run dev:web`. No API, database migration or seed command is required.

state is saved under `zenith.coordination.v2`. export offers the current world or complete library, including profiles, frozen decisions, mandates, outcomes and receipts with a SHA-256 checksum. imports preview before application; replacing a library retains its previous raw copy. **Archive** preserves stored records: valid version-two libraries download as reopenable checksummed exports; version-one and unreadable records download verbatim.

generate the [portable examples](examples/coordination/README.md) from the source profiles with `bun run examples:coordination`. `examples/coordination` contains three editable raw profiles and `worked-worlds.json`, a reproducible library of completed synthetic histories.

## Check

```sh
bun test tests/coordination
bun run lint:web
bun run build:web
bun run typecheck:web
```

- `apps/web/lib/coordination`: contracts, evaluation, bounded delegation, worked profiles and file integrity.
- `apps/web/components/coordination`: onboarding, four utility views and browser persistence.
- `tests/coordination`: feasibility, authority, frozen history, resource accounting, deterministic replay and file checks.

the coordination suite passes 47 tests / 981 assertions. lint, typechecking and the production build pass. see [the running contract](docs/mvp.md), [architecture](docs/system_architecture.md), [current status](docs/implementation_status.md), [testing](docs/testing_guide.md) and the latest coordination evidence in [design QA](design-qa.md).

## Retained history

the former Alder interface is preserved in `docs/archive/2026-10-04/alder-interface`; its calculator and regression tests remain in `apps/web/lib/commons` and `tests/commons`. the active page uses `CoordinationApp`. the Python operational prototype in `apps/api`, `packages/schemas` and `services/planner` is disconnected from the active app. existing database files and migrations were not modified.

The replaced implementation documents are preserved in [the October archive](docs/archive/2026-10-04/README.md). Earlier operator web source is recoverable at Git commit `541316ebd2f9ec78ab09e6c0e24d9c0f3d763034`; the [September archive](docs/archive/2026-09-12/README.md) retains its prior specifications. `project_zenith.py` and `input.txt` are historical Tkinter artifacts.
