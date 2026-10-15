# Planner UX Plan

## Purpose

This document defines the first real operator UX for Zenith.

It is not a generic admin dashboard. It is a planner workspace for turning
workforce, demand, materials, and equipment data into an inspectable draft
plan.

The plan in this document is intentionally tied to the API and domain that
already exist in the repository:

- organization and identity CRUD
- workforce CRUD
- demand and work-definition CRUD
- materials, inventory, and equipment CRUD
- organization-backed planner dry run

## Product stance

The first UX should optimize for planners and dispatchers doing real operational
work, not executives browsing charts.

That means the interface should:

- prioritize dense, editable operational data over decorative dashboards
- make constraints and missing data obvious
- let a planner move quickly between list, detail, and plan review
- keep organization context stable across the app
- surface issues without burying them in separate reports

## Primary users for the first UX

### Operations planner

Needs to prepare workforce, work-order, material, and equipment data and run a
draft plan for a time window.

### Dispatcher or team lead

Needs to inspect assignments, understand unassigned work, and correct bad input
data quickly.

### Operations manager

Needs a quick read on work readiness, shortage pressure, and draft-plan quality.

## UX principles

### Left collapsible sidebar is the primary navigation model

The app should use a persistent vertical navigation rail on desktop.

- expanded width: `280px`
- collapsed width: `84px`
- mobile behavior: slide-over drawer

This is the main organizing structure for the app, not a temporary treatment.

### List-detail beats modal-heavy CRUD

Most operational objects should be managed in split views:

- table or list on the left or center
- detail panel or full detail view on selection
- forms in side panels or inline sections where possible

Avoid stacking nested modals for core work.

### Planning is a workflow, not a single page

The planner UX should support a sequence:

1. verify readiness
2. run a draft plan
3. review assignments
4. inspect issues and shortages
5. adjust inputs
6. rerun

### Explanations stay visible

The system should always show:

- why work is unassigned
- which skills or certifications were matched
- which materials were reserved
- which equipment was reserved
- which filters or planning window were used

### Preserve the current visual direction

The existing web shell already has a warm operational look:

- parchment-like backgrounds
- dark green ink
- rust and amber accents
- serif display paired with a clean sans body

The first planner UI should preserve that direction, but make it denser and
more structured. Do not replace it with a generic blue/white SaaS dashboard.

## App shell

### Desktop shell

The main layout should be:

```text
+-----------------------------------------------------------------------------------+
| Sidebar | Top bar: org context, planning window, search, quick actions           |
|         +-------------------------------------------------------------------------+
|         | Page header: title, status chips, primary action                        |
|         +-------------------------------------------------------------------------+
|         | Main workspace                                                           |
|         |                                                                         |
|         | list/table | detail form or review pane                                 |
|         | or         | timeline / issues / inspector                              |
|         | dashboard  |                                                             |
+-----------------------------------------------------------------------------------+
```

### Shell regions

#### Sidebar

Contains:

- app mark and current environment
- org switcher
- primary nav groups
- collapse toggle
- quick links for planner run and latest result

#### Top bar

Contains:

- current organization name
- active planning window chip
- global quick search placeholder
- primary action button for the current section

#### Page header

Contains:

- page title
- short page description
- scope chips such as location, status, or planning window
- contextual actions

#### Main workspace

Uses one of three layout patterns:

- `dashboard`: cards and summary panels
- `list-detail`: table plus inspector or detail section
- `review`: assignments/issues/timeline split

### Mobile shell

On small screens:

- sidebar becomes a drawer
- page header actions collapse into a kebab menu and one primary button
- list-detail screens collapse to stacked sections
- planner review defaults to tabs instead of side-by-side panes

Mobile support matters for viewing and quick edits, but desktop is the primary
mode for the first release.

## Navigation architecture

The UX should be organization-scoped from the first serious interface.

Because the current API is keyed by organization `id`, the initial route shape
should also use `id` rather than slug.

### Primary route map

| Route | Sidebar label | Purpose | Primary layout |
| --- | --- | --- | --- |
| `/` | Home | org selection and environment landing | center panel |
| `/orgs/[organizationId]/overview` | Overview | operational readiness and shortcuts | dashboard |
| `/orgs/[organizationId]/workforce/workers` | Workforce | workers, skills, certifications, availability | list-detail |
| `/orgs/[organizationId]/workforce/catalog` | Skills & Certs | reference libraries for capability modeling | dual tables |
| `/orgs/[organizationId]/demand/work-orders` | Demand | work orders, requirements, dependencies | list-detail |
| `/orgs/[organizationId]/demand/policies` | Policies | service-level policies | list-detail |
| `/orgs/[organizationId]/resources/materials` | Materials | materials and inventory positions | list-detail |
| `/orgs/[organizationId]/resources/equipment` | Equipment | equipment types, units, and availability | list-detail |
| `/orgs/[organizationId]/planning/run` | Planner | run configuration and draft-plan generation | control + result |
| `/orgs/[organizationId]/planning/results` | Results | latest in-session result review | review |
| `/orgs/[organizationId]/settings/organization` | Settings | organization, locations, planning units, users, roles | list-detail |

### Sidebar grouping

The sidebar should group routes like this:

- `Overview`
- `Workforce`
- `Demand`
- `Resources`
- `Planner`
- `Settings`

Expanded sidebar example:

```text
Zenith
Acme Public Works

Overview

Workforce
Workers
Skills & Certs

Demand
Work Orders
Policies

Resources
Materials
Equipment

Planner
Run Planner
Latest Result

Settings
Organization
```

Collapsed mode should keep icons and tooltips, but not invent iconography before
the visual system is defined.

## Detailed page plans

## 1. Home and organization selection

### Route

`/`

### Purpose

Let the user choose an organization and enter the planner workspace.

### Layout

- centered stack with title, short explanation, and organization cards
- health badge showing API reachability
- direct link to API docs for local development

### Required data

- `GET /api/v1/organizations`
- `GET /api/v1/health`

### Notes

There is no auth yet, so this page acts as the entry context selector.

## 2. Overview

### Route

`/orgs/[organizationId]/overview`

### Purpose

Provide a planner-oriented command center, not an executive BI homepage.

### Layout

Two-row dashboard:

- row 1: readiness cards
- row 2: actionable panels

### Row 1 cards

- open work orders
- active workers
- material positions with low available stock
- active equipment units
- latest draft-plan unassigned count

### Row 2 panels

- `Planning Readiness`
  - missing worker skills
  - workers without availability calendars
  - work orders without requirements
  - work orders without requested window or due date
- `Urgent Work`
  - highest-priority open work orders
- `Resource Pressure`
  - low-stock inventory positions
  - equipment units out of service
- `Recent Planner Output`
  - latest in-session result summary

### Current API fit

This page can be built from existing list endpoints and client-side aggregation.
It does not require a new summary endpoint for the first iteration.

### Likely follow-up endpoint

Add an organization summary endpoint later for performance.

## 3. Workforce

## 3.1 Workers directory

### Route

`/orgs/[organizationId]/workforce/workers`

### Purpose

Manage workers and inspect whether they are ready for planning.

### Layout

Three-region list-detail workspace:

- top filter bar
- main worker table
- right inspector panel

### Table columns

- display name
- worker code
- status
- employment type
- home location
- home planning unit
- skills count
- certifications count
- availability calendar count

### Filters

- status
- location
- planning unit
- employment type
- free-text search by name or worker code

### Inspector tabs

- `Profile`
  - core worker fields
- `Skills`
  - current skill assignments and proficiency
- `Certifications`
  - current certification assignments and expiry
- `Availability`
  - calendars and windows

### Primary actions

- create worker
- edit selected worker
- assign skill
- assign certification
- add availability calendar
- add availability window

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/workers`
- `GET/POST/PATCH/DELETE /organizations/{id}/workers/{workerId}/skills`
- `GET/POST/PATCH/DELETE /organizations/{id}/workers/{workerId}/certifications`
- `GET/POST/PATCH/DELETE /organizations/{id}/workers/{workerId}/availability-calendars`
- `GET/POST/PATCH/DELETE /organizations/{id}/workers/{workerId}/availability-calendars/{calendarId}/windows`

## 3.2 Skills and certifications catalog

### Route

`/orgs/[organizationId]/workforce/catalog`

### Purpose

Manage the reference libraries used by worker capability and work requirements.

### Layout

Two-column split:

- left: skills
- right: certifications

Each side should support:

- searchable table
- create/edit/delete controls
- quick usage count later

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/skills`
- `GET/POST/PATCH/DELETE /organizations/{id}/certifications`

## 4. Demand

## 4.1 Work orders

### Route

`/orgs/[organizationId]/demand/work-orders`

### Purpose

Create and maintain the work backlog the planner operates on.

### Layout

List-detail workspace with a heavier detail pane than the workforce screens.

- center: work-order table
- right: detail pane with tabs

### Table columns

- title
- status
- priority
- location
- planning unit
- requested start
- due date
- duration minutes
- requirements count
- dependency count

### Filters

- status
- priority band
- location
- planning unit
- has dependencies
- due soon

### Detail tabs

- `Summary`
  - core work-order fields
- `Requirements`
  - structured requirements editor
- `Dependencies`
  - predecessor and successor links

### Requirement editor behavior

The requirement editor must support all current requirement types:

- skill
- certification
- material
- equipment type
- headcount

For `skill`, show min level input.
For other types, hide min level.

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/work-orders`
- `GET/POST/PATCH/DELETE /organizations/{id}/work-orders/{workOrderId}/requirements`
- `GET/POST/PATCH/DELETE /organizations/{id}/work-order-dependencies`

### Important note

The planner now supports multi-worker crews through required skill and
certification quantities. A standalone `headcount` requirement is still only
partially honored, so the UX should keep that limitation explicit in helper copy.

## 4.2 Service-level policies

### Route

`/orgs/[organizationId]/demand/policies`

### Purpose

Manage SLA-style operating targets used later for prioritization and reporting.

### Layout

Simple table + side form.

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/service-level-policies`

## 5. Resources

## 5.1 Materials and inventory

### Route

`/orgs/[organizationId]/resources/materials`

### Purpose

Manage material definitions and on-hand quantities by location.

### Layout

Tabbed resource workspace:

- tab 1: `Materials`
- tab 2: `Inventory`

### Materials table columns

- name
- SKU
- unit of measure
- material type
- status

### Inventory table columns

- material
- location
- on hand
- reserved
- available
- status flag for low stock later

### Filters

- location
- material type
- active/inactive

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/materials`
- `GET/POST/PATCH/DELETE /organizations/{id}/inventory-positions`

## 5.2 Equipment

### Route

`/orgs/[organizationId]/resources/equipment`

### Purpose

Manage equipment classes, units, and scheduling availability.

### Layout

Tabbed workspace:

- tab 1: `Equipment Types`
- tab 2: `Equipment Units`
- tab 3: `Availability`

### Equipment types columns

- name
- code
- category
- status

### Equipment units columns

- equipment code
- equipment type
- location
- status
- serial number
- calendar count

### Availability view

The first version can be table-based:

- equipment unit
- calendar
- effective range
- windows count

Selecting a unit opens its calendar and windows in an inspector.

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations/{id}/equipment-types`
- `GET/POST/PATCH/DELETE /organizations/{id}/equipment`
- `GET/POST/PATCH/DELETE /organizations/{id}/equipment/{equipmentId}/availability-calendars`
- `GET/POST/PATCH/DELETE /organizations/{id}/equipment/{equipmentId}/availability-calendars/{calendarId}/windows`

## 6. Planner

## 6.1 Run planner

### Route

`/orgs/[organizationId]/planning/run`

### Purpose

Define the planning scope, run a draft plan, and review immediate results.

### Layout

Two-column control-and-results layout:

- left column: run configuration and scope
- right column: result summary and issues

When a run completes, the lower half expands into a review area.

### Left column sections

- `Scenario`
  - scenario name
- `Planning Window`
  - start datetime
  - end datetime
- `Scope`
  - locations multi-select
  - planning units multi-select
  - worker statuses
  - work-order statuses
  - optional worker/work-order explicit selection later

### Right column summary

- run status
- assignments count
- unassigned count
- issues count
- rerun button

### Review area tabs

- `Assignments`
- `Unassigned`
- `Issues`

### Assignment table columns

- work order
- worker
- scheduled start
- scheduled end
- score
- matched skills
- matched certifications
- reserved materials
- reserved equipment

### Unassigned table columns

- work order
- reason

### Issues list

Show projection and planning issues in separate visual groups:

- `Data Projection Issues`
- `Planner Issues`

### Current API mapping

- `POST /api/v1/organizations/{id}/plans/dry-run`

### Current payload fit

The current planner request already supports:

- `scenario_name`
- `window_start`
- `window_end`
- `location_ids`
- `planning_unit_ids`
- `worker_statuses`
- `work_order_statuses`

So the first planner-run screen can be real, not mocked.

## 6.2 Latest result review

### Route

`/orgs/[organizationId]/planning/results`

### Purpose

Hold the last in-session draft plan in a stable review screen after the user
leaves the run form.

### State model

Because plan runs are not yet persisted, this screen should use session state
or URL-safe client state, with clear copy that the result is ephemeral.

### Layout

Review-focused split:

- left: assignment list
- right: work-order or worker inspector
- bottom or secondary tab: issues and unassigned work

### Deferred until plan persistence exists

- historical run list
- saved scenarios
- comparison between runs
- approval workflow

## 7. Settings

### Route

`/orgs/[organizationId]/settings/organization`

### Purpose

Expose the org and reference data needed to support the planner.

### Sections

- organization profile
- locations
- planning units
- users
- roles

### Layout

Section tabs with table + side form per entity.

### Current API mapping

- `GET/POST/PATCH/DELETE /organizations`
- `GET/POST/PATCH/DELETE /organizations/{id}/planning-units`
- `GET/POST/PATCH/DELETE /organizations/{id}/locations`
- `GET/POST/PATCH/DELETE /organizations/{id}/users`
- `GET/POST/PATCH/DELETE /roles`

## Shared UI patterns

### Filter bar

Every data-heavy page should share a standard filter bar:

- free-text search
- structured select filters
- active filter chips
- clear-all action

### Inspector drawer

The inspector should be reusable across list-detail screens.

Expected behavior:

- opens on row click
- preserves selection in the URL query string where reasonable
- supports edit mode
- closes without losing list filters

### Empty states

Every page needs action-oriented empty states.

Examples:

- no workers yet -> `Create worker`
- no work orders -> `Create work order`
- no planner result -> `Run draft plan`

### Error states

Validation and conflict errors from the API should be rendered near the action
that caused them, not buried in a generic toast alone.

### Status language

Status chips should use the domain vocabulary already in the API:

- `active`
- `inactive`
- `open`
- `in_progress`
- `completed`
- `draft`

Avoid inventing frontend-only synonyms.

## Frontend technical plan

## Route and file organization

Recommended Next.js structure:

```text
apps/web/app/
  (marketing)/
    page.tsx
  (app)/
    orgs/
      [organizationId]/
        layout.tsx
        overview/page.tsx
        workforce/
          workers/page.tsx
          catalog/page.tsx
        demand/
          work-orders/page.tsx
          policies/page.tsx
        resources/
          materials/page.tsx
          equipment/page.tsx
        planning/
          run/page.tsx
          results/page.tsx
        settings/
          organization/page.tsx
components/
  shell/
  data-table/
  forms/
  planner/
  workforce/
  demand/
  resources/
  settings/
lib/
  api/
  format/
  validation/
  state/
```

## Data access strategy

For the first implementation:

- use server components for initial page data where practical
- use client components for forms, drawers, and interactive planner review
- add a thin typed API client in `apps/web/lib/api`
- centralize request and response typing instead of scattering fetch calls

Recommended additions during implementation:

- `zod` for frontend form validation
- `@tanstack/react-query` for mutation and cache coordination

Those packages are not required for the planning document itself, but they are
the right default once the UI becomes interactive.

## State strategy

Separate state into three categories:

- `URL state`
  - organization id
  - current page
  - filters
  - selected row
- `server state`
  - API-backed lists and detail records
- `ephemeral client state`
  - unsaved form state
  - latest draft-plan result
  - sidebar collapsed state

## Component inventory

The first implementation should establish these reusable components early:

- `AppShell`
- `SidebarNav`
- `OrgSwitcher`
- `PageHeader`
- `FilterBar`
- `DataTable`
- `InspectorDrawer`
- `EntityFormPanel`
- `StatusChip`
- `PlannerRunForm`
- `PlannerResultSummary`
- `AssignmentTable`
- `IssueList`

## Backend gaps the UX should acknowledge

The first UX can be real on the current API, but it should not hide current
backend limitations.

### Already supported

- org-scoped CRUD for the core entities
- planner scoping by location, planning unit, worker status, work-order status,
  and planning window
- material inventory constraints
- equipment availability constraints

### Not yet supported

- auth
- persisted plan runs
- scenario history
- crew assignment
- actual dispatch and execution workflow
- aggregate reporting endpoints
- bulk import flows
- server-side pagination and search

The UX should use clear helper text where these gaps matter.

## Delivery order for the frontend

The UI should be implemented in this order:

1. `App shell`
   - sidebar
   - org selection
   - top bar
   - page header primitives
2. `Settings foundation`
   - organization
   - locations
   - planning units
3. `Workforce`
   - workers directory
   - skills and certifications catalog
4. `Demand`
   - work orders
   - requirements
   - dependencies
5. `Resources`
   - materials and inventory
   - equipment and availability
6. `Planner`
   - run form
   - result review
7. `Overview`
   - readiness and operational summary

This order intentionally delays the overview dashboard until the underlying
operator workflows exist.

## Exit criteria for the first usable planner UX

The first UX milestone is complete when a user can:

1. choose an organization
2. create or edit workers, work orders, materials, and equipment through the UI
3. define skills, certifications, requirements, dependencies, and availability
4. run a draft plan for a chosen window and scope
5. inspect assignments, unassigned work, and planner issues
6. return to the relevant data screen, fix an input problem, and rerun

That is the threshold where Zenith starts becoming an actual usable planning
tool rather than an API with a landing page.
