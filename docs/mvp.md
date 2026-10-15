# Strategic coordination: running contract

Updated October 4, 2026. The active application implements the first local coordination loop defined by the [product vision](product_vision.md). It is a strategic workspace, with bounded synthetic specialist execution.

## Entry and organization

**Begin** opens a fresh world with a short guided path. **Worked case** opens a prior decision-to-outcome history followed by a source change. custom creation collects a name and objective, with optional outcome units, baseline and target; a raw validated `Profile` can supply a different domain. first-run onboarding accepts file or pasted imports. the world picker preserves existing instances. **New instance** clones the complete profile with a new identity and fresh initial claims, leaving earlier history intact.

- **Situation:** objectives, protections, scoped resources, overlapping institutions, source claims, shocks and current activity.
- **Strategies:** alternative portfolios, resource demand, dependent timing, projected outcomes and explicit infeasibility.
- **Mandates:** frozen agent work packages, acceptance, dependencies, progress, stopping and resource consumption.
- **Ledger:** accountable decisions, receipts and expected-versus-observed outcomes.

Top avatars open each agent's permitted scopes and actions. On-demand details carry provenance and philosophical protections. Familiar actions use accessible icons; minimal glass is reserved for navigation and controls.

## Worked profiles

| Profile | Scope | Feasible alternatives | Protected limits |
| --- | --- | --- | --- |
| Harbor | Energy, housing and workforce; 36 months | Winter relief or deeper housing transition | No involuntary moves; no emissions increase; bounded housing stock |
| Meridian | Two manufacturing plants and external suppliers; 12 months | Supplier qualification or internal capacity | Fatigue, operating cash, emissions and physically valid delivery rates |
| Open Atlas | Independent library, labs, archive and contributors; 18 months | Rights/evidence or portable reuse | Privacy, maintenance burden and valid percentage bounds |

Each has five objectives, eight dated synthetic claims, five capabilities, seven interventions, three strategies, four scoped agents and two shocks. Two initial portfolios are feasible; a third illustrates explicit capacity or protection violations. The smaller custom seed uses the same primitives and evaluator.

Worked histories authorize the first feasible strategy, accept mandates, complete bounded simulated work and then revise a relevant source. They retain the frozen decision, consumed resources, forecast error and source history. They do not represent live agents, external institutions or actual field outcomes.

## Evaluation and delegation

Resources and effects are additive, optionally scaled by a claim ratio. Capability offers and agent permissions list their authorized scopes explicitly. Dependencies determine completion timing. Only effects completed within the projection count; the horizon is not a universal prohibition on later work.

A strategy is feasible when it has its prerequisites and authority, stays within available capabilities and preserves all protected conditions. Missing an objective target is shown separately. No optimization or portfolio generator selects a winner.

Authorization freezes the current evaluation and source values. Acceptance atomically reserves resource ceilings. Simulated specialists wait for predecessors, advance through three progress steps and report observed effects using the frozen synthetic factor. Source changes do not rewrite those expectations.

A source shock may block accepted work. Revocation requests retain unconsumed reservations until acknowledgement; consumed resources remain. Expiry stops further work. Already mandated interventions cannot be reissued as if unused. Simulation ticks are a logical command clock, distinct from the projection's months.

## State and files

The browser stores a version-two library at `zenith.coordination.v2`. A library supports up to 24 independent worlds. Local stale writes are rejected; corrupt raw storage is preserved for recovery.

portable exports offer the current world or complete library, containing full profiles, claim values, decisions, mandates, outcomes and events in a SHA-256 envelope. import validates structure, bounded numbers, references, frozen arithmetic and deterministic event replay. files are limited to 2 MB of UTF-8 data. checksums establish consistency, not authorship or scientific validity.

a library import previews before replacing state and preserves `zenith.coordination.v2.previous`. a raw `Profile` import adds a fresh world. Archive leaves stored records unchanged: valid version-two libraries download as reopenable checksummed exports; version-one and unreadable records download verbatim.

`bun run examples:coordination` regenerates three editable profile files and the checksummed worked library in [`examples/coordination`](../examples/coordination/README.md), using the same profile definitions as the application.

## Limits

There is no live agent integration, external ingestion, optimizer, authentication, multi-user approval, server persistence or shared resource pool across independent worlds. Synthetic proxies are not validated regional, industrial or scientific forecasts.

the coordination tests establish software accounting and replay behavior. current browser acceptance covers the decision-to-outcome loop, all three profiles, responsive views, file round-trips, concurrent edits and recovery. earlier Alder pass counts are historical. see [testing](testing_guide.md) and [current status](implementation_status.md).

The prior Alder implementation contract is retained [unchanged in the archive](archive/2026-10-04/mvp.md).
