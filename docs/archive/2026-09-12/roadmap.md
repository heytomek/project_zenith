# Roadmap

## Roadmap objective

Turn Project Zenith from a single-file ranking prototype into a production-grade planning platform.

This roadmap assumes we are building toward the concrete `v1` defined in the other docs:

- multi-site labor and resource planning
- daily and weekly planning horizon
- structured constraints
- scenario generation
- review and override workflow
- plan vs actual feedback

## Delivery strategy

Do not try to jump directly to the final vision.

Build in layers:

1. foundation and canonical data model
2. operational planning kernel
3. review, execution, and feedback
4. tactical coordination and scenario analysis
5. broader network planning

## Phase 0: Product framing and repo reset

Target: 1 to 2 weeks

Goal:

- lock product scope for `v1`
- start a fresh implementation path without being constrained by the Tkinter prototype

Deliverables:

- finalized product vision
- finalized domain model
- finalized architecture choice
- rewrite repository structure
- engineering standards and contribution guide

Implementation tasks:

- create monorepo structure under `apps/`, `services/`, `packages/`, and `docs/`
- choose package manager and formatting tools
- set up linting, type checking, and test runners
- define coding standards and migration workflow
- create initial ERD and migration plan

Exit criteria:

- repo boots locally
- docs align on scope and vocabulary
- first migrations are ready to be written

## Phase 1: Platform foundation

Target: 2 to 4 weeks

Goal:

- establish the canonical backend and frontend skeleton

Deliverables:

- FastAPI application
- Next.js application
- PostgreSQL schema bootstrap
- auth and role model
- basic organization setup flow

Implementation tasks:

- scaffold `apps/api` and `apps/web`
- configure PostgreSQL, Redis, Alembic, and SQLAlchemy
- add auth with local development credentials first
- define base schemas for organizations, users, roles, planning units, and locations
- add health checks and environment configuration
- create seed data command

Exit criteria:

- a user can log in
- an organization can be created
- planning units and locations can be managed
- CI validates formatting, tests, and migrations

## Phase 2: Workforce and demand modeling

Target: 3 to 5 weeks

Goal:

- replace free-text matching with canonical workforce and work-order models

Deliverables:

- worker management
- skills and certifications
- availability calendars
- work-order intake
- requirements model

Implementation tasks:

- create schemas and CRUD for workers, skills, worker skills, certifications, and worker certifications
- add recurring and ad hoc availability windows
- create work-order schema with priority, due date, location, duration, and status
- create work requirements and dependencies
- implement CSV import for workers and work orders
- validate required fields and normalization rules

Exit criteria:

- planners can load a realistic workforce dataset
- planners can create and edit work orders with structured requirements
- the system can identify worker eligibility using hard rules

## Phase 3: Planning kernel MVP

Target: 4 to 6 weeks

Goal:

- deliver the first serious planning engine

Deliverables:

- planning horizon management
- constraint rules and objective functions
- scenario creation
- first plan-run engine
- explainable assignment results

Implementation tasks:

- model planning horizons, scenarios, and plan runs
- implement candidate filtering based on skills, certifications, availability, and location
- implement initial objective model:
  - maximize work completion
  - minimize overtime
  - minimize travel
  - prioritize urgent work
- integrate OR-Tools for constrained assignment
- store plan results, issues, and metrics
- expose APIs for plan creation and plan retrieval
- build plan review screens in the web app

Exit criteria:

- a planner can generate a plan for a daily or weekly horizon
- the system returns assignments and unassigned work with reasons
- results are persisted and inspectable

## Phase 4: Resource constraints and operational execution

Target: 4 to 6 weeks

Goal:

- move beyond labor-only planning and close the loop with actual operations

Deliverables:

- facilities and equipment models
- material and inventory positions
- reservations against planned work
- dispatch and actuals recording
- override workflow

Implementation tasks:

- add facilities, equipment types, equipment, and equipment availability calendars
- add materials and inventory positions by location
- extend work requirements to equipment and material dependencies
- implement resource reservation model
- add manual override and approval flow
- add assignment publication state
- add actual start, finish, and variance capture

Exit criteria:

- generated plans respect equipment and material constraints
- planners can override assignments and record why
- actual execution can be compared against the published plan

## Phase 5: Scenario comparison and management reporting

Target: 3 to 5 weeks

Goal:

- support real planning decisions instead of one-shot schedule generation

Deliverables:

- scenario cloning and branching
- comparison metrics
- bottleneck reporting
- utilization and backlog analytics

Implementation tasks:

- implement scenario inheritance
- create scenario comparison view
- calculate workload, SLA risk, backlog age, and shortage metrics
- add summary dashboards for planners and managers
- add exportable plan reports

Exit criteria:

- planners can compare at least two scenarios side by side
- managers can see why one scenario is preferable
- bottlenecks are explicit rather than implicit

## Phase 6: Network coordination

Target: 6 to 10 weeks

Goal:

- expand Zenith from one operating unit to a coordinated system

Deliverables:

- cross-unit capacity sharing
- inter-site transfer logic
- federated shortage visibility
- policy-aware routing of work

Implementation tasks:

- model transfer costs and travel policies
- support worker borrowing across units
- support shared equipment pools
- add regional planning views
- add policy constraints at region and organization levels

Exit criteria:

- planners can rebalance work across units
- the system can show the tradeoffs of local vs network-wide optimization

## Phase 7: Forecasting and adaptive planning

Target: 6 to 8 weeks

Goal:

- let Zenith anticipate future problems instead of only reacting

Deliverables:

- demand forecasting inputs
- shortage prediction
- what-if simulation
- hiring and training signal generation

Implementation tasks:

- ingest historical work-order and actuals data
- build forecastable demand classes
- estimate expected load and capacity gaps
- add simulation runs against alternative demand assumptions
- generate recommended hiring, training, or procurement actions

Exit criteria:

- planners can run future-looking scenarios
- management can identify likely shortages before the planning window begins

## Cross-cutting workstreams

These should run throughout the roadmap.

### Data quality

- normalization
- deduplication
- import validation
- audit fields

### Testing

- unit tests for domain rules
- integration tests for API flows
- planner tests with fixture scenarios
- regression tests for solver outputs

### Explainability

- reason codes for assignment choices
- reason codes for unassigned work
- surfaced binding constraints

### Governance

- approval workflows
- override logging
- role-based permissions
- immutable plan history

## First implementation milestone

The most important near-term milestone is not "finish the system." It is:

"Generate and review a valid weekly labor plan for one organization across multiple sites using structured worker, skill, availability, and work-order data."

If we reach that milestone, Zenith becomes a real planning product.

## Detailed first-build backlog

This is the concrete order I would implement next.

### Sprint A: bootstrap

- create `apps/api`, `apps/web`, `services/planner`, and `packages/schemas`
- set up formatting, linting, tests, and Docker-based local services
- create base environment management

### Sprint B: core schema

- organizations
- planning units
- locations
- users and roles
- workers
- skills
- worker skills

### Sprint C: scheduling inputs

- certifications
- worker certifications
- calendars
- availability windows
- work orders
- work requirements

### Sprint D: planning engine v0

- candidate filtering
- eligibility checks
- simple scoring model
- first persisted plan run

### Sprint E: planner review UI

- backlog view
- workforce view
- scenario creation
- plan results
- unassigned work diagnostics

### Sprint F: optimization upgrade

- OR-Tools solver integration
- hard and soft constraints
- workload and overtime controls
- explanation generation

## What not to do

Avoid these failure modes:

- rebuilding the old prototype in a prettier UI
- overcommitting to national-scale planning language before the operational layer works
- modeling everything before a single plan can run
- splitting too early into many services
- hiding planning assumptions inside ad hoc code

## Definition of success for v1

`v1` is successful when:

- planners trust the system enough to generate weekly plans with it
- managers can inspect why plans look the way they do
- assignments respect real-world capacity and eligibility constraints
- unassigned work is explainable
- actual outcomes can be compared against planned ones

At that point, Zenith has crossed the line from interesting prototype to serious platform.
