# Project Zenith

Zenith is an operational planning workbench for matching demand, labor, time,
materials, equipment, and execution feedback into reviewable plans.

The original repository was a small Python/Tkinter prototype for ranking workers
against open roles. The current revamp keeps that origin, but the active codebase
is now a multi-package planning platform with:

- a FastAPI backend
- SQLAlchemy models and Alembic migrations
- shared Pydantic schemas
- an OR-Tools-backed planning engine
- a Next.js operator console
- planner, API, migration, and web build checks

## Current Architecture

| Path | Purpose |
| --- | --- |
| `apps/api` | FastAPI application, SQLAlchemy models, Alembic migrations, and service-layer workflows. |
| `apps/web` | Next.js operator UI for organizations, workforce, demand, resources, planner runs, results, dispatch, and reports. |
| `packages/schemas` | Shared Pydantic contracts used by the API and planner. |
| `services/planner` | Constrained planning engine using OR-Tools CP-SAT. |
| `tests` | Planner and API regression tests. |
| `docs` | Product, domain, architecture, roadmap, local development, and testing notes. |
| `project_zenith.py` | Legacy desktop prototype retained as project history. |
| `input.txt` | Sample roster data for the legacy prototype. |

## What It Does Now

The current system models an organization as structured planning data:

- organizations, locations, planning units, users, and roles
- workers, skills, certifications, availability windows, shift templates, and breaks
- work orders, requirements, dependencies, and service-level policies
- materials, inventory positions, equipment, and equipment availability
- planning horizons, scenarios, plan runs, assignments, overrides, publication, reservations, dispatch queues, and execution events

The planner produces persisted plan runs with assignment candidates, selected
work, unassigned reasons, reservation effects, and review/reporting surfaces.
Published assignments can be reassigned, cancelled, handed off, and updated with
field execution events.

## Local Development

From the repository root:

```bash
python3 -m venv .venv
make install-python
make install-web
```

Run the API with local SQLite:

```bash
make migrate-sqlite-local
make api-dev-sqlite
```

Run the web app:

```bash
make web-dev
```

Seed demo data:

```bash
make seed-demo-sqlite
```

The seed command prints organization ids and useful UI routes.

## Verification

Planner tests:

```bash
make test-planner
```

API tests:

```bash
make test-api
```

All Python tests:

```bash
make test-all
```

Web checks:

```bash
bun run typecheck:web
bun run lint:web
bun run build:web
```

Python lint:

```bash
.venv/bin/python -m ruff check apps/api services/planner packages/schemas tests
```

## Legacy Origin

Zenith began in late 2021 as a single-file Python/Tkinter application inspired
by Project Cybersyn. That prototype presented itself as an "intelligent economic
decision-making tool" and did one narrow job:

1. load a plain-text roster of workers
2. let the user enter open jobs and desired skills
3. rank every worker against every job
4. export the rankings to text files

The old scoring model was intentionally simple:

- `+1` for each desired skill the worker had
- `+1.5` if the worker's past-job text contained the job name

That prototype is still in `project_zenith.py`. It is useful as an origin story
and a compact statement of the original idea: make labor allocation legible and
explainable. The current platform generalizes that idea into a structured
planning system with persistence, constraints, review, dispatch, and actuals.

The legacy script still has its original constraints: synchronous Tkinter
callbacks, plain-text parsing, case-sensitive matching, substring experience
checks, no database, no package structure, and no tests. Treat it as historical
source material, not the active application.

## Documentation

Start with:

- `docs/local_development.md`
- `docs/testing_guide.md`
- `docs/implementation_status.md`
- `docs/domain_model.md`
- `docs/system_architecture.md`
- `docs/roadmap.md`
