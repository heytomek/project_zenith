# System Architecture

## Architecture goal

Build Zenith as a planning platform, not a desktop utility.

The architecture should support:

- structured multi-tenant data
- long-running planning jobs
- versioned scenarios
- explainable outputs
- human review and overrides
- future expansion into network-level coordination

## Recommended implementation stack

Use a pragmatic split:

- backend API and planning services in Python
- frontend in web technologies
- relational storage in PostgreSQL
- background jobs through Redis-backed workers

Recommended concrete stack:

- `FastAPI` for the application API
- `SQLAlchemy` and `Alembic` for persistence and migrations
- `PostgreSQL` as the system of record
- `Redis` for queues, caching, and ephemeral coordination
- `Celery` or `RQ` for asynchronous planning jobs
- `OR-Tools` for initial constrained optimization
- `Next.js` with React and TypeScript for the operator UI
- `OpenAPI` generated client bindings between API and web app

This choice keeps the planning logic in Python, where optimization and scientific tooling are strongest, while giving the UI a serious operational surface.

## High-level system components

### 1. Web application

Used by planners, managers, and dispatchers for:

- data management
- scenario setup
- plan review
- issue inspection
- approval and overrides
- execution monitoring

### 2. API application

Primary responsibilities:

- authentication and authorization
- CRUD for core planning entities
- validation and normalization
- orchestration of plan runs
- exposure of read models and reports

### 3. Planning engine

Primary responsibilities:

- feasible candidate generation
- constraint model construction
- scoring and optimization
- production of explainable results and diagnostics

### 4. Background worker tier

Primary responsibilities:

- imports
- long-running plan generation
- scenario comparison jobs
- recalculation of derived metrics

### 5. Database

Primary responsibilities:

- canonical entity storage
- versioned scenarios and plan runs
- audit trail
- execution and actuals history

### 6. Integration layer

Primary responsibilities:

- importing worker master data
- importing work orders or demand feeds
- syncing inventory and equipment state
- emitting assignments to execution systems later

## Proposed service boundaries

The first build should stay compact. Do not over-microservice it.

Recommended initial services:

### `apps/api`

FastAPI app exposing:

- auth
- organizations, units, locations
- workers, skills, certifications, calendars
- work orders, requirements, dependencies
- facilities, equipment, inventory positions
- scenarios, plan runs, assignments, overrides

### `apps/web`

Next.js app exposing:

- planner dashboard
- work queue and backlog views
- capacity map
- scenario builder
- plan results and issue review
- override and publish workflows

### `services/planner`

Python package or service containing:

- candidate filtering
- constraint assembly
- objective weighting
- solver integration
- explanation generation

This can start as an internal module in the API repo and be split later if needed.

### `workers/jobs`

Background processes for:

- imports
- plan runs
- recalculations
- notifications

## Data model strategy

Use PostgreSQL as the source of truth.

Initial schema groups:

- `identity`: organizations, users, roles
- `org`: planning units, locations, regions
- `workforce`: workers, skills, certifications, calendars
- `operations`: work orders, requirements, dependencies
- `resources`: facilities, equipment, materials, inventory
- `planning`: horizons, rules, objectives, scenarios, plan runs, assignments
- `execution`: events, actuals, overrides

Principles:

- use UUID primary keys
- store all operational times in UTC
- keep local timezone metadata on locations and calendars
- make every plan run immutable after completion
- keep scenario inheritance explicit, not implicit

## Planning engine design

The planning engine should run in clear stages.

### Stage 1: normalization

Resolve raw operational inputs into canonical planning facts:

- duration
- headcount needed
- location
- skill and certification requirements
- equipment and material needs
- service-level deadlines

### Stage 2: eligibility filtering

Eliminate impossible candidates using hard constraints:

- worker unavailable
- missing certification
- equipment unavailable
- location mismatch without travel allowance
- missing material or facility access

### Stage 3: scoring and optimization

Build a constrained optimization model with weighted objectives such as:

- maximize completed demand
- minimize overtime
- minimize travel
- prioritize critical work
- smooth workload imbalance

### Stage 4: diagnostics

Produce explainable outputs:

- why an item was assigned
- why something remained unassigned
- which constraints were active
- where bottlenecks occurred

### Stage 5: publication

Persist outputs as immutable plan artifacts and expose them for approval.

## UI surface

The first web UI should include:

### Planner dashboard

- backlog by priority and due date
- current capacity by site
- plan-run status
- major bottlenecks and alerts

### Workforce management

- workers
- skills
- certifications
- calendars and leave

### Work intake

- work orders
- dependencies
- service classes

### Resource views

- facilities
- equipment availability
- inventory positions

### Scenario and plan review

- create scenario
- run plan
- inspect assignments
- inspect unassigned work
- compare scenarios
- approve, reject, override

### Execution monitoring

- dispatched work
- actual vs planned
- variance and failure reasons

## Security and authorization

At minimum, support role-based access:

- `admin`
- `planner`
- `dispatcher`
- `manager`
- `viewer`

Later, move toward policy-based access for cross-unit governance.

All plan changes should be auditable:

- who changed what
- when
- why
- what prior state existed

## Deployment approach

Initial deployment target:

- one PostgreSQL instance
- one Redis instance
- one API service
- one worker service
- one web app

This is enough for a serious early product and keeps operations manageable.

Containerization:

- Docker for local development
- Docker Compose for local integration
- managed Postgres and Redis in hosted environments

## Suggested repository layout for the rewrite

```text
project_zenith/
  apps/
    api/
    web/
  services/
    planner/
  packages/
    client/
    schemas/
  docs/
  infra/
    docker/
  tests/
    integration/
    planner/
```

## Architecture decisions for v1

Be explicit about the first build:

- single database, not sharded
- monorepo, not separate repos
- modular monolith for API, not distributed microservices
- optimization through OR-Tools first, not custom solver infrastructure
- manual review gate before publication

Those decisions optimize for speed, coherence, and maintainability.

## What can come later

As the system grows, architecture can expand into:

- event streaming for high-frequency state changes
- forecasting services
- simulation services
- federated cross-organization planning
- optimization clusters for larger solve workloads

Those are future scaling decisions, not day-one requirements.
