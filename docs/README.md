# Zenith Planning Platform Docs

This directory defines the future version of Project Zenith as a real planning platform rather than a single-purpose worker-ranking script.

Current implementation status:

- org and identity foundation is implemented
- workforce foundation is implemented
- demand and work-definition foundation is implemented
- materials, inventory, and equipment foundation is implemented
- planner logic now includes a first constrained optimization core
- first-class planning horizons are implemented
- worker shift templates and break rules are implemented
- published-assignment reservation persistence is implemented
- published-work reassignment and cancellation are implemented
- manager-facing reporting, bottleneck dashboards, trend reporting, and CSV export are implemented
- frontend now includes the first operational shell and the initial settings, workforce, demand, resources, and planner-run workflows
- first real planner UX is now specified in detail

Recommended reading order:

1. [`product_vision.md`](./product_vision.md): what Zenith is for, who it serves, and what the first serious version should be.
2. [`domain_model.md`](./domain_model.md): the concrete entities, relationships, workflows, and planning concepts the system must represent.
3. [`system_architecture.md`](./system_architecture.md): the proposed technical architecture and service boundaries for implementation.
4. [`roadmap.md`](./roadmap.md): the phased execution plan from prototype rewrite to a larger coordination platform.
5. [`planner_ux_plan.md`](./planner_ux_plan.md): the detailed information architecture, layout, and page plan for the first usable operator UI.
6. [`engineering_standards.md`](./engineering_standards.md): development rules for keeping the rewrite coherent.
7. [`erd.md`](./erd.md): the first-cut entity relationship diagram for `v1`.
8. [`migration_strategy.md`](./migration_strategy.md): the database rollout order for the initial build.
9. [`implementation_status.md`](./implementation_status.md): current build status against the roadmap, including what is complete and what is still missing.
10. [`local_development.md`](./local_development.md): how to boot and verify the current planning foundation.
11. [`testing_guide.md`](./testing_guide.md): concrete commands for exercising the API, migrations, tests, and web app.

Working assumption for the new product:

- `v1` is a multi-site labor-and-resource planning platform.
- `v2` expands into cross-unit coordination and scenario planning.
- `v3` can become a broader economic coordination layer for networks of organizations, cooperatives, or public-service systems.

The old desktop app remains useful as the historical seed of the idea. These docs define what comes next.
