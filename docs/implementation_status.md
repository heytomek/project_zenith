# Implementation Status

Last updated: March 5, 2026

This document records where the current codebase sits relative to the roadmap.

## High-level status

Zenith is no longer a planning concept only. It is now a working operational
planning foundation with:

- a FastAPI backend
- a Next.js operator UI
- persisted organizations, workforce, demand, resources, scenarios, and plan runs
- a first constrained optimization engine that reasons about:
  - worker skills
  - certifications
  - availability windows
  - planning horizons
  - shift templates and break rules
  - dependency ordering
  - material stock
  - equipment availability
  - multi-worker crews
  - site-to-site travel
  - overtime pressure
  - workload balance
- a planner review flow with persisted run comparison
- scenario cloning, rerun, save-as-scenario, labels, notes, status, and branch lineage
- persistent worker, material, and equipment reservations attached to published assignments
- published assignment execution tracking, plan-vs-actual review, and execution analytics
- published-work reassignment and cancellation with audited event history, including crew-aware dispatch updates
- bulk dispatch handoff state controls (`pending`, `ready`, `sent`, `acknowledged`) with audit events
- saved run-scoped dispatch queues with reusable exception filters and canned queue actions
- organization-scoped dispatch queue templates shared across runs, with role-gated queue apply controls
- manager-facing operational reporting with CSV export, bottleneck dashboards, and trend reporting

It is still not a full operational optimization system, execution platform, or
cross-unit coordination platform.

## Roadmap check-in

### Phase 0: Product framing and repo reset

Status: complete

What is done:

- product vision
- domain model
- system architecture
- roadmap
- monorepo structure
- engineering standards
- migration strategy

### Phase 1: Platform foundation

Status: functionally complete for the current MVP scope

What is done:

- FastAPI scaffold
- Next.js scaffold
- SQLAlchemy and Alembic foundation
- organizations, users, roles, planning units, locations
- health checks and local development workflow
- local demo seed command for full-stack planner UX testing

What is still missing:

- authentication
- local dev login flow
- verified Postgres/Redis Docker path in this environment

### Phase 2: Workforce and demand modeling

Status: substantially complete

What is done:

- workers, skills, certifications, worker capabilities
- availability calendars and windows
- work orders, requirements, dependencies
- service-level policies
- materials, inventory, equipment, equipment availability

What is still missing:

- CSV import
- richer normalization/import tooling

### Phase 3: Planning kernel MVP

Status: functionally complete for the current MVP scope

What is done:

- scenarios and plan runs
- organization-backed planning request projection
- persisted planner results
- result review and comparison UI
- explainable assignments, unassigned work, and issue reporting
- OR-Tools-backed constrained assignment solver
- optimization across worker eligibility, schedule overlap, dependencies, material stock, equipment reuse, multi-worker crews, travel, overtime, and workload balance
- first-class planning horizons for reusable run windows
- worker shift templates and break rules projected into planner availability and regular-capacity calculations

What is still missing:

- richer solver dimensions such as inter-run crew editing and stronger shift-pattern exception handling

### Phase 4: Resource constraints and operational execution

Status: substantially complete

What is done:

- material and equipment constraints in the planner
- persistent worker, material, and equipment reservations
- persisted plan assignments attached to plan runs
- manual assignment override workflow
- run approval workflow
- published assignment state and publication workflow
- future plan runs automatically consume published worker, equipment, and material commitments
- execution-event capture for published assignments
- actual start, finish, and blocked-state recording on assignments
- draft and published dispatch edits across both single-worker and multi-worker crew assignments
- bulk dispatch handoff state updates for published assignments, with assignment-level audit events
- shared dispatch queue templates and role-gated queue-action governance
- published-work cancellation with worker, equipment, and material reservation release
- completion-driven release of worker and equipment reservations plus material consumption
- plan-vs-actual review summary and per-assignment variance reporting
- deeper execution analytics for blocked reasons and rollups by worker, site, and work type

What is still missing:

- tighter operator workflows around exception handling and downstream execution handoff

### Phase 5: Scenario comparison and management reporting

Status: functionally complete for the current MVP scope, earlier than originally scheduled

What is done:

- scenario cloning and branching
- persisted run comparison
- scenario lineage metadata
- scenario labels, notes, and branch-aware UX
- manager-facing operations report page
- worker, location, material, and equipment rollups
- bottleneck dashboards across labor, sites, materials, and equipment
- longer-horizon trend buckets across assignment throughput, execution state, and reservation pressure
- exportable assignment-level CSV reports

What is still missing:

- richer reporting presentation such as saved report views and scheduled delivery

### Phase 6 and beyond

Status: not started

- cross-unit capacity sharing
- transfer logic
- policy-aware network coordination
- forecasting and adaptive planning

## Assessment

We have not veered off course.

The main deviation from the original roadmap is sequencing, not direction:

- scenario comparison and branching work from Phase 5 was pulled forward
- that was a good trade because the current planner UX needed a tighter
  iteration loop before deeper execution features

The current system is strongest as:

- an operational planning workbench with a first constrained optimization core

The biggest remaining gaps are:

1. auth and user access control
2. richer reporting presentation such as saved report views and scheduled delivery
3. tighter operator workflows around exception handling and downstream execution handoff
4. cross-unit coordination capabilities from later roadmap phases

## Recommended next steps

1. add auth and user access control around planning, publication, execution, and reporting flows
2. add saved views and scheduled delivery on top of manager reporting
3. tighten operator exception workflows and downstream execution handoff tooling
