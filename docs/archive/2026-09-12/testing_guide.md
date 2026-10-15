# Testing Guide

## Purpose

This guide is the quickest way to verify and experiment with the current Zenith planning foundation.

## 1. Install dependencies

From the repo root:

```bash
python3 -m venv .venv
make install-python
make install-web
```

## 2. Run the automated checks

Planner-only tests:

```bash
make test-planner
```

API tests:

```bash
make test-api
```

All tests:

```bash
make test-all
```

Web checks:

```bash
bun run --cwd apps/web lint
bun run --cwd apps/web typecheck
bun run --cwd apps/web build
```

## 3. Apply the first migration

### Option A: use SQLite for fast local experimentation

```bash
ZENITH_DATABASE_URL=sqlite:///./zenith_local.db make migrate
ZENITH_DATABASE_URL=sqlite:///./zenith_local.db make db-current
```

This is the easiest way to validate the migration flow without Docker.

### Option B: use PostgreSQL through Docker

If Docker is available on your machine:

```bash
cp .env.example .env
make infra-up
make migrate
make db-current
```

## 4. Seed a realistic demo dataset

```bash
make seed-demo-sqlite
```

This command applies SQLite migrations and creates two full demo organizations with
workers, skills, certifications, availability, shift templates, break rules, work
orders, dependencies, materials, equipment, planning horizons, dispatch queue templates,
and sample plan runs.

It prints generated `org_id` values and route shortcuts. Keep those IDs for the UI.

## 5. Run the API

```bash
make migrate-sqlite-local
make api-dev-sqlite
```

Then check:

- Health: `http://127.0.0.1:8000/api/v1/health`
- Docs UI: `http://127.0.0.1:8000/docs`

Example health request:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

You should see the configured database backend and the currently modeled foundation tables.

## 5.1 Run the web app

In a second terminal:

```bash
make web-dev
```

The web app proxies `/api/*` to `http://127.0.0.1:8000` by default. If your API is
running elsewhere:

```bash
ZENITH_API_ORIGIN=http://127.0.0.1:8000 make web-dev
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/orgs/<ORG_ID>/overview`
- `http://localhost:3000/orgs/<ORG_ID>/demand/work-orders`
- `http://localhost:3000/orgs/<ORG_ID>/demand/policies`
- `http://localhost:3000/orgs/<ORG_ID>/resources/materials`
- `http://localhost:3000/orgs/<ORG_ID>/resources/equipment`
- `http://localhost:3000/orgs/<ORG_ID>/planning/run`
- `http://localhost:3000/orgs/<ORG_ID>/planning/reports`
- `http://localhost:3000/orgs/<ORG_ID>/planning/results`
- `http://localhost:3000/orgs/<ORG_ID>/settings/organization`
- `http://localhost:3000/orgs/<ORG_ID>/workforce/workers`
- `http://localhost:3000/orgs/<ORG_ID>/workforce/catalog`

Suggested manual flow:

Quick seeded-data flow:

1. Use one seeded `org_id` from `make seed-demo-sqlite`.
2. Open `/orgs/<ORG_ID>/planning/results` and review assignments, unassigned reasons, and execution timelines.
3. Open `/orgs/<ORG_ID>/planning/run`, select the seeded planning horizon, and run a new draft.
4. Open `/orgs/<ORG_ID>/workforce/workers` and modify shift templates or break rules for one worker, then rerun.
5. Open `/orgs/<ORG_ID>/planning/reports` and export CSV to validate manager-facing outputs.

Full manual flow:

1. Create an organization from the home page if you do not already have one.
2. Open the organization settings page and create at least one location and one planning unit.
3. Open the skills and certifications catalog and create a few capability records.
4. Open the workers page, create a worker, then assign skills, certifications, and availability windows.
5. Open work orders and policies, create backlog items, attach requirements, and add dependencies.
6. Open materials and equipment, create inventory and availability records.
7. Open the planner run page, save the current scope as a scenario if you want to reuse it, then run a persisted draft plan.
8. Create at least one work order with a skill requirement `quantity > 1` and confirm the draft plan returns a multi-worker crew instead of leaving the work order unassigned.
9. If you have multiple locations with coordinates, schedule back-to-back work at different sites and confirm the planner splits the work across workers when the travel gap is too tight.
10. Open the results page and confirm the run stays available after a refresh.
11. Use the recent-runs list and comparison controls to compare two saved runs and inspect assignment, shortage, and issue deltas.
12. On the run page, add scenario labels, status, and notes, then use the lineage panel to inspect parent and child branches.
13. Use `Save as scenario` on the results page if you want to branch the current draft into a reusable planning scope.
14. Use `Rerun draft` on the results page to create a fresh persisted run and land directly in a comparison against the previous draft.
15. Use the review links to jump directly back to the selected worker, work order, or equipment unit that needs adjustment.
16. Clone an existing scenario from the run page when you want to branch a saved planning scope before rerunning.
17. On the results page, select a persisted assignment row and apply a manual override to move the work order to another qualified worker, edit the crew composition, or adjust its schedule.
18. Still on the results page, use `Approve draft` to record the run as review-complete, then use `Publish assignments` to freeze the run and block further draft overrides.
19. After publication, confirm the related worker, equipment unit, and material stock are now committed by the published run.
20. Use published reassignment on the selected assignment to move dispatched work to another qualified worker or crew before it starts, then confirm the event timeline records the reassignment and crew delta.
21. Create at least one saved dispatch queue on the results page with execution/handoff filters and a canned handoff action, then confirm the queue preview shows matching assignments.
22. Apply the saved queue action and confirm matching assignments update handoff status plus `handoff_updated` events.
23. Create an organization-scoped dispatch queue template with allowed role codes and verify unauthorized queue apply returns `403`.
24. Apply the same template against a second published run and confirm the template-level action updates matching assignments across runs.
25. Use bulk handoff controls to select multiple published assignments and set their handoff status to `ready` or `sent`, then confirm assignment chips and event timelines update.
26. Use published cancellation on the selected assignment when the dispatched work should be withdrawn, then confirm worker, equipment, and material reservations are released immediately.
27. Create another overlapping draft run and confirm the planner now sees those published commitments automatically.
28. Use the execution controls on the selected assignment to record `started`, `blocked`, and `completed` events and confirm the execution timeline fills in.
29. Use the plan-vs-actual table on the results page to confirm start delay, finish delay, blocked-event count, cancellation count, and duration variance are reflected correctly for the published run.
30. Review the deeper analytics below the plan-vs-actual table and confirm blocked reasons plus worker/site/work-type rollups update after new field events are recorded.
31. After completion, confirm worker and equipment capacity are released while material stock is consumed.
32. On `/orgs/<ORG_ID>/planning/run`, create a planning horizon and apply it to the run form so window start and end prefill from the saved horizon.
33. On `/orgs/<ORG_ID>/workforce/workers`, add at least one shift template and break rule for the selected worker, then rerun the planner and confirm work overlapping a break becomes unassigned.
34. Open `/orgs/<ORG_ID>/planning/reports`, confirm the manager report shows both active reservations and completed work, inspect the bottleneck cards and assignment-date trend buckets, then export the CSV and inspect the assignment-level rows.

If you want to inspect run deltas directly at the API layer, call:

```bash
curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/compare?baseline_run_id=<RUN_ID>&candidate_run_id=<RUN_ID>"
```

Useful action endpoints:

```bash
curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-scenarios/<SCENARIO_ID>/clone"

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/rerun"

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/save-scenario"

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/planning-horizons" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Week 12",
    "timezone": "UTC",
    "start_at": "2026-03-16T00:00:00Z",
    "end_at": "2026-03-22T23:59:59Z",
    "status": "active"
  }'
```

Execution workflow endpoints:

```bash
curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments"

curl -X PATCH \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "<WORKER_ID>",
    "crew_worker_ids": ["<WORKER_ID>"],
    "scheduled_start_at": "2026-03-25T09:00:00Z",
    "scheduled_end_at": "2026-03-25T11:00:00Z",
    "override_reason": "Manual rebalance after dispatcher review.",
    "override_note": "Shifted to the secondary mechanic to balance workload.",
    "actor_name": "dispatcher-1"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/reassign" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "<WORKER_ID>",
    "crew_worker_ids": ["<WORKER_ID>"],
    "scheduled_start_at": "2026-03-25T09:00:00Z",
    "scheduled_end_at": "2026-03-25T11:00:00Z",
    "reason": "Original technician called out sick.",
    "note": "Reassigned before field start.",
    "actor_name": "dispatcher-1"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/handoff" \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_ids": ["<ASSIGNMENT_ID>"],
    "handoff_status": "ready",
    "actor_name": "dispatcher-1",
    "note": "Ready for downstream dispatch board."
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blocked pending handoff",
    "description": "Blocked published work that still has pending handoff.",
    "assignment_statuses": ["published"],
    "execution_statuses": ["blocked"],
    "handoff_statuses": ["pending"],
    "source_kinds": [],
    "canned_handoff_status": "ready",
    "status": "active"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues/<QUEUE_ID>/apply-action" \
  -H "Content-Type: application/json" \
  -d '{
    "actor_name": "dispatcher-1",
    "note": "Queue-driven handoff update."
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/dispatch-queue-templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Published pending handoff",
    "description": "Reusable governed queue for not-started published work.",
    "assignment_statuses": ["published"],
    "execution_statuses": ["not_started"],
    "handoff_statuses": ["pending"],
    "source_kinds": [],
    "canned_handoff_status": "ready",
    "allowed_role_codes": ["dispatch_manager"],
    "status": "active"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queues" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "<TEMPLATE_ID>"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/dispatch-queue-templates/<TEMPLATE_ID>/apply-action" \
  -H "Content-Type: application/json" \
  -d '{
    "actor_name": "dispatch-lead",
    "actor_user_id": "<USER_ID>",
    "note": "Template-driven governed queue apply."
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer deferred the stop.",
    "note": "Release all reservations and revisit next cycle.",
    "actor_name": "dispatcher-1"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "actor_name": "dispatcher-1",
    "note": "Ready for dispatch."
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/publish" \
  -H "Content-Type: application/json" \
  -d '{
    "actor_name": "dispatch-lead"
  }'

curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events"

curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/actuals-review"

curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/reports/operations?window_start=<ISO>&window_end=<ISO>"

curl \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/reports/operations/export.csv?window_start=<ISO>&window_end=<ISO>"

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "started",
    "occurred_at": "2026-03-25T09:05:00Z",
    "actor_name": "dispatch-lead"
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "blocked",
    "occurred_at": "2026-03-25T09:45:00Z",
    "actor_name": "dispatch-lead",
    "note": "Site access delayed by lockout."
  }'

curl -X POST \
  "http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plan-runs/<RUN_ID>/assignments/<ASSIGNMENT_ID>/events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "completed",
    "occurred_at": "2026-03-25T11:20:00Z",
    "actor_name": "dispatch-lead"
  }'
```

## 5. Exercise the handcrafted dry-run planner endpoint

This route is still useful because it isolates the planner from the database and lets you test solver behavior with a minimal payload.

The handcrafted planner now supports:

- skill levels
- certification requirements
- availability-window checks
- unavailable-window blocking
- dependency ordering and dependency timing checks
- worker reuse across non-overlapping scheduled work
- material inventory constraints
- equipment availability constraints

Example:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/plans/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_name": "manual-smoke",
    "workers": [
      {
        "worker_id": "w-1",
        "display_name": "Alex Rivera",
        "skill_codes": ["electrical", "safety"],
        "available": true
      },
      {
        "worker_id": "w-2",
        "display_name": "Casey Morgan",
        "skill_codes": ["plumbing"],
        "available": true
      }
    ],
    "work_orders": [
      {
        "work_order_id": "wo-1",
        "title": "Repair pump",
        "required_skill_codes": ["electrical"],
        "priority": 10
      },
      {
        "work_order_id": "wo-2",
        "title": "Inspect valve",
        "required_skill_codes": ["plumbing"],
        "priority": 5
      }
    ]
  }'
```

Ways to experiment:

- mark one worker `available: false`
- give two work orders the same critical skill and watch one go unassigned
- remove `required_skill_codes` from a work order and see how the optimizer treats a job with no labor-skill constraint
- increase or decrease priorities and compare assignment order
- add `requested_start_at` and `due_at` fields to two work orders and verify the same worker can be reused when the windows do not overlap
- add a dependency and verify the successor is blocked when its scheduled window violates the dependency rule

## 6. Exercise the org and identity CRUD endpoints

Create an organization:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zenith Cooperative",
    "slug": "zenith-coop",
    "organization_type": "cooperative",
    "status": "active"
  }'
```

Create a role:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "code": "planner",
    "name": "Planner",
    "description": "Planning operator"
  }'
```

After you have an organization id and role id, create a user:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "planner@zenith.local",
    "display_name": "Morgan Lee",
    "role_ids": ["<ROLE_ID>"]
  }'
```

List the current org slice:

```bash
curl http://127.0.0.1:8000/api/v1/organizations
curl http://127.0.0.1:8000/api/v1/roles
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/users
```

Good experiments here:

- create two organizations and verify slugs must be unique
- create a planning unit in one org and try to reuse it as the parent of a unit in another org
- assign a role to a user and verify deleting that role returns a conflict
- delete the user, then delete the role, then delete the organization

## 7. Exercise the workforce endpoints

Create a skill:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/skills \
  -H "Content-Type: application/json" \
  -d '{
    "code": "electrical",
    "name": "Electrical",
    "category": "trade",
    "status": "active"
  }'
```

Create a certification:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/certifications \
  -H "Content-Type: application/json" \
  -d '{
    "code": "osha-10",
    "name": "OSHA 10",
    "description": "Basic safety",
    "expires": true,
    "status": "active"
  }'
```

Create a worker:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers \
  -H "Content-Type: application/json" \
  -d '{
    "worker_code": "W-001",
    "display_name": "Avery Stone",
    "employment_type": "full_time",
    "status": "active",
    "home_location_id": "<LOCATION_ID>",
    "home_planning_unit_id": "<PLANNING_UNIT_ID>"
  }'
```

Assign a skill to the worker:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/skills \
  -H "Content-Type: application/json" \
  -d '{
    "skill_id": "<SKILL_ID>",
    "proficiency_level": 4,
    "verified": true
  }'
```

Assign a certification to the worker:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/certifications \
  -H "Content-Type: application/json" \
  -d '{
    "certification_id": "<CERT_ID>",
    "status": "active",
    "issued_at": "2026-01-01T00:00:00Z",
    "expires_at": "2027-01-01T00:00:00Z"
  }'
```

Create an availability calendar and window:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/availability-calendars \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Default Calendar",
    "timezone": "America/New_York",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": "2026-12-31T23:59:59Z",
    "status": "active"
  }'
```

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/availability-calendars/<CALENDAR_ID>/windows \
  -H "Content-Type: application/json" \
  -d '{
    "start_at": "2026-03-10T13:00:00Z",
    "end_at": "2026-03-10T21:00:00Z",
    "availability_type": "available"
  }'
```

Useful checks:

```bash
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/skills
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/certifications
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/skills
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/certifications
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/workers/<WORKER_ID>/availability-calendars
```

Good experiments here:

- try assigning the same skill twice to the same worker and verify it returns `409`
- try assigning a skill from another organization and verify it returns `422`
- try creating an availability window with `end_at` earlier than `start_at` and verify it returns `422`
- try deleting a skill or certification while still assigned to a worker and verify it returns `409`
- try deleting a location or planning unit that is still set as a worker's home base and verify it returns `409`

## 8. Exercise the materials and equipment endpoints

Create a material:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/materials \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "copper-wire",
    "name": "Copper Wire",
    "unit_of_measure": "roll",
    "material_type": "electrical",
    "status": "active"
  }'
```

Create an inventory position:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/inventory-positions \
  -H "Content-Type: application/json" \
  -d '{
    "material_id": "<MATERIAL_ID>",
    "location_id": "<LOCATION_ID>",
    "on_hand_quantity": 10,
    "reserved_quantity": 2
  }'
```

Create an equipment type:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment-types \
  -H "Content-Type: application/json" \
  -d '{
    "code": "bucket-truck",
    "name": "Bucket Truck",
    "category": "vehicle",
    "status": "active"
  }'
```

Create an equipment unit:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_type_id": "<EQUIPMENT_TYPE_ID>",
    "location_id": "<LOCATION_ID>",
    "equipment_code": "EQ-001",
    "serial_number": "SN-001",
    "status": "active"
  }'
```

Create an equipment availability calendar and window:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment/<EQUIPMENT_ID>/availability-calendars \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Primary",
    "timezone": "UTC",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": "2026-12-31T23:59:59Z",
    "status": "active"
  }'
```

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment/<EQUIPMENT_ID>/availability-calendars/<CALENDAR_ID>/windows \
  -H "Content-Type: application/json" \
  -d '{
    "start_at": "2026-03-10T08:00:00Z",
    "end_at": "2026-03-10T17:00:00Z",
    "availability_type": "available"
  }'
```

Useful checks:

```bash
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/materials
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/inventory-positions
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment-types
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/equipment
```

Good experiments here:

- try creating an inventory position where `reserved_quantity > on_hand_quantity` and verify it returns `422`
- try assigning inventory or equipment to a location from another organization and verify it returns `422`
- try deleting a material or equipment type that is still referenced by work requirements and verify it returns `409`
- try deleting a location that still has inventory or equipment and verify it returns `409`

## 9. Exercise the demand and work-definition endpoints

This slice is where Zenith starts to look like a planning system instead of just an admin CRUD API.

Create a service-level policy:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/service-level-policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Urgent Maintenance",
    "scope": "work_order",
    "target_minutes": 240,
    "description": "Critical repairs should begin within four hours.",
    "status": "active"
  }'
```

Create a work order:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Repair main line",
    "description": "Critical repair on the north branch.",
    "status": "open",
    "priority": 90,
    "requested_start_at": "2026-03-10T08:00:00Z",
    "due_at": "2026-03-10T12:00:00Z",
    "location_id": "<LOCATION_ID>",
    "planning_unit_id": "<PLANNING_UNIT_ID>",
    "service_level_policy_id": "<POLICY_ID>"
  }'
```

Add a skill requirement:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders/<WORK_ORDER_ID>/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_type": "skill",
    "reference_id": "<SKILL_ID>",
    "min_level": 3,
    "quantity": 1,
    "notes": "Crew lead should be at least level 3."
  }'
```

Add a certification requirement:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders/<WORK_ORDER_ID>/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_type": "certification",
    "reference_id": "<CERT_ID>",
    "quantity": 1
  }'
```

Add a pure headcount requirement:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders/<WORK_ORDER_ID>/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_type": "headcount",
    "quantity": 2
  }'
```

Create a second work order, then add a dependency:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-order-dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "predecessor_work_order_id": "<PREDECESSOR_WORK_ORDER_ID>",
    "successor_work_order_id": "<SUCCESSOR_WORK_ORDER_ID>",
    "dependency_type": "finish_to_start"
  }'
```

Useful checks:

```bash
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/service-level-policies
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-orders/<WORK_ORDER_ID>/requirements
curl http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/work-order-dependencies
```

Good experiments here:

- try creating a work order with `due_at` earlier than `requested_start_at` and verify it returns `422`
- try creating a `headcount` requirement with a `reference_id` and verify it returns `422`
- try pointing a `skill` requirement at a certification id and verify it returns `422`
- create two dependencies that would form a cycle and verify the second one returns `422`
- try deleting a service-level policy, location, planning unit, skill, or certification while a work order still depends on it and verify it returns `409`

## 10. Exercise the organization-backed dry-run planner endpoint

This route projects real organization, workforce, availability, and demand data into the planner.

Example:

```bash
curl \
  -X POST http://127.0.0.1:8000/api/v1/organizations/<ORG_ID>/plans/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_name": "org-smoke",
    "window_start": "2026-03-10T08:00:00Z",
    "window_end": "2026-03-10T12:00:00Z",
    "worker_statuses": ["active"],
    "work_order_statuses": ["open", "in_progress"]
  }'
```

What this route currently reads from the database:

- worker skills and skill proficiency
- worker certifications
- worker availability calendars and windows
- material inventory by location
- equipment units and equipment availability windows
- work-order skill and certification requirements
- work-order material and equipment requirements
- work-order schedule fields
- work-order dependencies

What it currently does not enforce beyond issue reporting:

- headcount requirements above one worker
- labor cost, travel cost, and utilization objectives

Good experiments here:

- create one worker with the right skill but no certification and verify the work order stays unassigned
- create one worker with the right certification but a non-overlapping availability window and verify they are skipped
- add a material requirement that exceeds local stock and verify the work order stays unassigned
- add an equipment requirement that overlaps another equipment-constrained work order and verify one of them stays unassigned
- add a `headcount` requirement and verify the response still includes an issue explaining the draft-planner limitation
- add a dependency chain and verify the successor work order is blocked if its schedule window violates the dependency rule
- narrow the request with `location_ids`, `planning_unit_ids`, `worker_ids`, or `work_order_ids` and verify the assignment set changes

## 11. Run the web app

```bash
make web-dev
```

Then open:

- `http://localhost:3000`

Right now the web app is a scaffolded landing shell, not the operational planner UI yet. The point of this step is to verify the frontend boundary and workspace tooling.

## 12. Suggested manual test flow

If you want to sanity-check the platform in the order the planner will eventually use it, this sequence is the fastest path:

1. Create one organization.
2. Create one planning unit and one location inside it.
3. Create one role and one user.
4. Create one skill and one certification.
5. Create one worker and assign the skill, certification, and at least one availability window.
6. Create one material, one inventory position, one equipment type, and one equipment unit with an availability window.
7. Create one service-level policy and two work orders.
8. Add labor, material, and equipment requirements to those work orders and connect them with a dependency.
9. Run the organization-backed dry-run planner endpoint against that data.
10. Use the handcrafted dry-run planner endpoint only if you want to isolate solver behavior from the database projection layer.

That gives you a complete manual walk through identity, workforce, resources, and demand without needing any seed script.

## 13. Inspect the current foundation

Useful files to read while testing:

- API entrypoint: [`apps/api/app/main.py`](./../apps/api/app/main.py)
- settings: [`apps/api/app/config.py`](./../apps/api/app/config.py)
- database base/session: [`apps/api/app/db/base.py`](./../apps/api/app/db/base.py), [`apps/api/app/db/session.py`](./../apps/api/app/db/session.py)
- first models: [`apps/api/app/db/models/organization.py`](./../apps/api/app/db/models/organization.py), [`apps/api/app/db/models/identity.py`](./../apps/api/app/db/models/identity.py)
- workforce models: [`apps/api/app/db/models/workforce.py`](./../apps/api/app/db/models/workforce.py)
- resource models: [`apps/api/app/db/models/resources.py`](./../apps/api/app/db/models/resources.py)
- demand models: [`apps/api/app/db/models/demand.py`](./../apps/api/app/db/models/demand.py)
- resource service: [`apps/api/app/services/resource_service.py`](./../apps/api/app/services/resource_service.py)
- planning service: [`apps/api/app/services/planning_service.py`](./../apps/api/app/services/planning_service.py)
- planner engine: [`services/planner/src/zenith_planner/planner.py`](./../services/planner/src/zenith_planner/planner.py)
- migrations: [`apps/api/alembic/versions/20260304_0001_initial_org_identity.py`](./../apps/api/alembic/versions/20260304_0001_initial_org_identity.py), [`apps/api/alembic/versions/20260304_0002_workforce_foundation.py`](./../apps/api/alembic/versions/20260304_0002_workforce_foundation.py), [`apps/api/alembic/versions/20260304_0003_demand_foundation.py`](./../apps/api/alembic/versions/20260304_0003_demand_foundation.py), [`apps/api/alembic/versions/20260304_0004_resources_foundation.py`](./../apps/api/alembic/versions/20260304_0004_resources_foundation.py)

## 14. What “working” means right now

At this stage, the system is healthy if:

- migrations apply
- API tests pass
- planner tests pass
- the health endpoint returns modeled tables
- the handcrafted dry-run planner endpoint returns assignments
- the organization-backed dry-run planner endpoint returns assignments from persisted org/workforce/demand data
- the optimization engine can reuse workers and equipment across non-overlapping work while honoring dependency order, schedule windows, material stock, and unavailable reservation windows
- the org/identity CRUD endpoints create, list, update, and delete records correctly
- the workforce endpoints create, list, update, and delete workers, skills, certifications, calendars, and windows correctly
- the resource endpoints create, list, update, and delete materials, inventory positions, equipment types, equipment, and equipment availability correctly
- the demand endpoints create, list, update, and delete service-level policies, work orders, requirements, and dependencies correctly
- the web app lints, typechecks, and builds

That means the rewrite foundation is in place and ready for the next schema and feature wave.
