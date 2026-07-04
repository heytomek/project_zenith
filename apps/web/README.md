# Zenith Web

This app will become the primary operator interface for planners, dispatchers, and managers.

Current implemented scope:

- organization selection from the home page
- organization-scoped app shell with a collapsible left sidebar
- overview page
- settings flow for organization, locations, and planning units
- workforce flow for workers, skills, certifications, and worker availability management
- demand flow for work orders, requirements, dependencies, and service-level policies
- resource flow for materials, inventory, equipment types, equipment units, and availability
- planner flow for constrained-plan execution and latest-result review
- planning-horizon management and horizon-linked run configuration
- manager-facing operations reports with bottleneck dashboards, trend buckets, and CSV export

Recent UX additions:

- icon-backed navigation and page headers across the operator shell
- planner run page quick-access cards for workforce, demand, and resources
- grouped planner-result review buckets for workforce, demand, resource, and planner issues
- deep links from planner results into selected workers, work orders, and equipment units
- saved scenario management on the planner run page
- persisted plan runs with recent-run review on the results page
- two-run planner comparison on the results page, with assignment, shortage, and issue deltas
- scenario cloning on the run page plus rerun/save-as-scenario actions on the results page
- scenario labels, notes, status management, and branch-history review on the run page
- execution workflow controls on the results page for manual assignment override, run approval, and assignment publication
- persistent worker, material, and equipment reservation creation when a run is published
- published-assignment execution capture on the results page, including started, blocked, and completed event logging
- published reassignment and assignment cancellation on the results page for both single-worker and crew assignments, with audit events and reservation release/recreate behavior
- bulk dispatch handoff controls on the results page to update `pending`/`ready`/`sent`/`acknowledged` state across selected published assignments
- saved dispatch queues on the results page with reusable exception filters and queue-level canned actions
- organization-scoped dispatch queue template management on the results page, including template CRUD, run-queue instantiation from templates, and role-gated queue/template apply controls with actor-user selection
- plan-vs-actual review on the results page, including delay and duration variance across published assignments
- deeper execution analytics on the results page, including blocked reasons and rollups by worker, site, and current work-type grouping
- operations reports page with worker, location, material, and equipment rollups, bottleneck cards, assignment-date trend buckets, and assignment-level CSV export
- worker page support for recurring shift templates and break rules used directly by planner scheduling

Implementation planning for the first real operator UI now lives in
[`docs/planner_ux_plan.md`](../../docs/planner_ux_plan.md).
