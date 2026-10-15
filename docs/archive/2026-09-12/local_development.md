# Local Development

## Goal

Bring up the current Zenith planning foundation locally with a predictable set of commands.

## Prerequisites

- Python `3.12+`
- Node.js `25+`
- Bun `1.3.x`
- Docker, if you want local PostgreSQL and Redis through Compose

## First-time setup

From the repository root:

```bash
python3 -m venv .venv
make install-python
make install-web
```

## Useful commands

### Run the API

```bash
make migrate-sqlite-local
make api-dev-sqlite
```

The API will start with:

- app entrypoint at `apps/api/app/main.py`
- route namespace under `/api/v1`
- interactive docs at `/docs`
- local SQLite database at `./zenith_local.db`

### Seed demo organizations and planning data

For a ready-to-use dataset (organizations, workers, demand, materials, equipment,
planning horizons, shift templates, dispatch templates, and sample runs):

```bash
make seed-demo-sqlite
```

The command prints generated `org_id` values and direct UI paths for overview,
planner run, results, and reports pages.

### Run the web app

```bash
make web-dev
```

The web app proxies `/api/*` to `http://127.0.0.1:8000` by default. If your API is
running somewhere else, set:

```bash
ZENITH_API_ORIGIN=http://127.0.0.1:8000 make web-dev
```

The first implemented UI routes are:

- `/`
- `/orgs/<ORG_ID>/overview`
- `/orgs/<ORG_ID>/demand/work-orders`
- `/orgs/<ORG_ID>/demand/policies`
- `/orgs/<ORG_ID>/resources/materials`
- `/orgs/<ORG_ID>/resources/equipment`
- `/orgs/<ORG_ID>/planning/run`
- `/orgs/<ORG_ID>/planning/reports`
- `/orgs/<ORG_ID>/planning/results`
- `/orgs/<ORG_ID>/settings/organization`
- `/orgs/<ORG_ID>/workforce/workers`
- `/orgs/<ORG_ID>/workforce/catalog`

The planner UX is now best used as a loop:

1. fill workforce, demand, and resource data
2. optionally save the current run scope as a scenario on `/orgs/<ORG_ID>/planning/run`
3. run a persisted draft plan from `/orgs/<ORG_ID>/planning/run`
4. review grouped issues, compare saved runs, and inspect deltas on `/orgs/<ORG_ID>/planning/results`
5. use labels, notes, status, and lineage on `/orgs/<ORG_ID>/planning/run` to manage scenario branches explicitly
6. clone a saved scenario or save a run as a new scenario when you want to branch the planning scope
7. follow the direct links back into workers, work orders, or equipment to fix gaps
8. rerun the planner directly from the results page and compare the new draft against the previous run
9. select a persisted assignment on `/orgs/<ORG_ID>/planning/results` and apply a manual override when you need to change the lead worker, crew composition, or timing
10. approve a run once the draft is ready for dispatch, then publish it to freeze assignment edits
11. publication now creates persistent worker, material, and equipment reservations that future runs automatically consume
12. after publication, record `started`, `blocked`, and `completed` events against the selected assignment on `/orgs/<ORG_ID>/planning/results`
13. use the plan-vs-actual section on `/orgs/<ORG_ID>/planning/results` to review delay, completion, and duration variance across published assignments
14. use the deeper execution analytics on the same page to inspect blocked reasons plus variance breakdowns by worker, site, and current work-type grouping
15. use published reassignment on `/orgs/<ORG_ID>/planning/results` when dispatched work needs to move to another qualified worker or crew before work starts
16. save dispatch queues on `/orgs/<ORG_ID>/planning/results` to capture reusable exception filters and canned queue actions
17. define organization-level dispatch queue templates for cross-run reuse, and set allowed queue-apply role codes for governed dispatch actions
18. instantiate run-specific queues from templates or apply templates directly against published runs
19. use bulk handoff controls on `/orgs/<ORG_ID>/planning/results` to mark selected published assignments as `ready`, `sent`, or `acknowledged`
20. use published cancellation on the same page when the dispatched work should be withdrawn and all active reservations should be released back into capacity
21. open `/orgs/<ORG_ID>/planning/reports` for manager-facing rollups, review the bottleneck cards and assignment-date trend buckets, then export the assignment-level CSV when you need a portable operational report
22. define reusable planning horizons on `/orgs/<ORG_ID>/planning/run`, then use them to prefill run windows and keep scenario scope consistent
23. define worker shift templates and break rules on `/orgs/<ORG_ID>/workforce/workers` to enforce recurring schedule windows and break-time constraints during planning

There are also backend action endpoints for tighter planner loops:

- `POST /api/v1/organizations/<ORG_ID>/plan-scenarios/<SCENARIO_ID>/clone`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/rerun`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/save-scenario`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments`
- `PATCH /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/reassign`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/cancel`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/handoff`
- `GET /api/v1/organizations/<ORG_ID>/dispatch-queue-templates`
- `POST /api/v1/organizations/<ORG_ID>/dispatch-queue-templates`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues/<QUEUE_ID>/assignments`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues/<QUEUE_ID>/apply-action`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queue-templates/<TEMPLATE_ID>/assignments`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queue-templates/<TEMPLATE_ID>/apply-action`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events`
- `GET /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/actuals-review`
- `GET /api/v1/organizations/<ORG_ID>/reports/operations`
- `GET /api/v1/organizations/<ORG_ID>/reports/operations/export.csv`
- `GET /api/v1/organizations/<ORG_ID>/planning-horizons`
- `POST /api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/shift-templates`
- `POST /api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/shift-templates/<SHIFT_TEMPLATE_ID>/break-rules`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/approve`
- `POST /api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/publish`

And the comparison endpoint:

- `GET /api/v1/organizations/<ORG_ID>/plan-runs/compare?baseline_run_id=<RUN_ID>&candidate_run_id=<RUN_ID>`

### Run planner tests

```bash
make test-planner
```

### Run API tests

```bash
make test-api
```

### Run all tests

```bash
make test-all
```

### Apply database migrations

If you are using local PostgreSQL through Docker:

```bash
make infra-up
make migrate
```

If you want a zero-infrastructure local database for experimenting:

```bash
make migrate-sqlite-local
```

## Verified checks

The current foundation has been checked for:

- Python syntax compilation
- Alembic migration execution against SQLite
- planner test execution
- API health endpoint, handcrafted dry-run planner endpoint, and organization-backed dry-run planner endpoint
- org/identity CRUD endpoint tests
- workforce CRUD endpoint tests
- demand and work-definition CRUD endpoint tests
- materials, inventory, and equipment CRUD endpoint tests
- the first operational Next.js UI routes for org selection, settings, workforce, demand, resources, and planner review
- persisted assignment override, approval, and publication workflow
- persistent worker, material, and equipment reservations created at publication time
- published-assignment execution event capture
- completion-driven worker and equipment release plus material consumption
- plan-vs-actual review summary and variance table for published runs
- deeper execution analytics for blocked reasons and rollups by worker, site, and work type
- manager-facing operations reporting, bottleneck dashboards, trend buckets, and CSV export
- published-work reassignment and cancellation with reservation release/recreate behavior across both single-worker and crew assignments
- planning horizon CRUD and horizon-linked run windows
- worker shift-template and break-rule CRUD with planner projection
- Next.js production build
- TypeScript typecheck
- ESLint execution

## Current limitations

- PostgreSQL and Redis were scaffolded in Compose but not started here because Docker was unavailable in the environment.
- The planner now uses a constrained optimization engine rather than a greedy matcher.
- The current planner handles schedule windows, dependency ordering, material inventory, equipment availability, published reservations, multi-worker crews, travel, overtime pressure, and workload balance.
- Crew and single-worker dispatch edits now share the same override/reassignment flow, but operators still need stronger exception-routing and downstream handoff tooling.

For hands-on testing and sample commands, see [`testing_guide.md`](./testing_guide.md).
