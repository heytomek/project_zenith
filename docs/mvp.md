# Strategic coordination: running contract

updated November 2, 2026. the active application implements real-source decision review and a modeled coordination loop defined by the [product vision](product_vision.md). its immediate job is keeping commitments coherent as conditions change. [strategic reconsideration](strategic-reconsideration.md) explains the research and our product interpretation.

## Entry and organization

**Bring project data** opens a CSV/JSON export or pasted records. the import preview maps Title and Project, offers optional fields and preserves original source cells. the [data contract](project-data.md) defines formats, the header-only template and refresh semantics. **Bring data** in the workspace picker appends another project without replacing existing workspaces. workspace backups remain a separate import path.

real projects use three views:

- **Attention:** grouped questions about explicit deadline, budget, dependency and requested-decision conditions, with Open and Reviewed states.
- **Sources:** immutable source snapshots, normalized facts, original cells and coverage gaps.
- **Record:** appended human judgments linked to the exact reviewed evidence and review date.

the three review agents run deterministic local rules. review is derived on import, refresh and opening, with date checks while the workspace stays open. no LLM reasoning, remote source polling or closed-browser monitoring is implied. each question exposes its rule and cited records. recording a judgment changes no source value and grants no execution rights. unchanged relevant facts stay reviewed; changed or recurring conditions reopen. missing source coverage is shown separately from decision findings.

refresh accepts a complete replacement snapshot of the current source record set, preserving earlier versions. it does not merge partial row changes or interpret absence as completion. each snapshot supports up to 500 records and 64 columns; a project retains up to 8 snapshots and 500 responses. input and portable files have a 2 MB UTF-8 limit, with exports including retained history.

## Modeled worlds

**Begin** opens fresh planning with guidance derived from its current state. **Explore** seeds an active synthetic decision interrupted by a consequential sourced change. existing stored worlds are reopened rather than reseeded. the earlier completed `workedExample` histories and portable libraries remain supported. custom creation collects a name and objective, with optional outcome units, baseline and target; a raw validated `Profile` can supply a different domain. first-run onboarding accepts file or pasted imports. the world picker preserves existing instances. **New instance** clones the complete profile with a new identity and fresh initial claims, leaving earlier history intact.

- **Situation:** the authorized promise, the declared baseline plus recorded outcomes, reassessed remaining course, consequential changes, affected stewards, objectives, protections and scoped resources.
- **Strategies:** compact alternatives and the current baseline, composed portfolios, resource demand, dependent timing, projected outcomes and explicit infeasibility.
- **Mandates:** frozen agent work packages, acceptance, dependencies, progress, stopping and resource consumption.
- **Ledger:** accountable decisions, receipts and expected-versus-observed outcomes.

a compact decision context derives the next action from actual state: consequential capacity or authority conflicts take priority, then proposed mandates, active work, completed outcomes and relevant disputed or changed evidence. normal dependency waits continue through execution; resolved capacity exceptions do not remain merely because a historical blocked event exists. scope selection includes descendants; the whole-world context also includes independent institutions. shared capability accounting keeps the complete pool visible across its consumers.

Top avatars open each agent's permitted scopes and actions. On-demand details carry provenance and philosophical protections. Familiar actions use accessible icons; minimal glass is reserved for navigation and controls.

## Worked profiles

| Profile | Scope | Feasible alternatives | Protected limits |
| --- | --- | --- | --- |
| Harbor | Energy, housing and workforce; 36 months | Winter relief or deeper housing transition | No involuntary moves; no emissions increase; bounded housing stock |
| Meridian | Two manufacturing plants and external suppliers; 12 months | Supplier qualification or internal capacity | Fatigue, operating cash, emissions and physically valid delivery rates |
| Open Atlas | Independent library, labs, archive and contributors; 18 months | Rights/evidence or portable reuse | Privacy, maintenance burden and valid percentage bounds |

Each has five objectives, eight dated synthetic claims, five capabilities, seven interventions, three strategies, four scoped agents and two shocks. Two initial portfolios are feasible; a third illustrates explicit capacity or protection violations. The smaller custom seed uses the same primitives and evaluator.

active episodes authorize a domain-specific course, accept its mandates, advance twice, record a sourced synthetic change and advance again. Harbor loses shared crews; Meridian loses a laboratory window; Open Atlas's delayed verification invalidates a dependent fork-kit window. unaffected work can finish while affected work remains bounded.

the earlier completed worked histories authorize the first feasible strategy, accept mandates, complete bounded simulated work and then revise a relevant source. They retain the frozen decision, consumed resources, forecast error and source history. They do not represent live agents, external institutions or actual field outcomes.

## Evidence and reconsideration

in modeled worlds, manual evidence entry records a numeric claim value together with source title, author, publication date and excerpt. it preserves the starting source and prior receipts. file ingestion for real projects is a separate source-backed review path; neither path is a live connector or verification of source truth. original modeled claim status and dissent remain explicit.

`reviewDecision` compares the decision's authorized projection with current conditions and the reassessed effects of unfinished work. **Current** is the declared baseline plus recorded outcomes, each counted once; it is not a claim of pure measurement. an unfinished progress step records consumption; it does not invent an observed partial benefit. changed claims trace through declared resource, effect and timing links to affected mandates, objectives and stewards. scope filtering changes context, never authority.

**Retain**, **Investigate** and **Stop** record an attributable rationale at the reviewed revision. retain/investigate neither resume blocked execution nor clear its condition. stop requests withdraw outstanding authority; unconsumed reservations remain until acknowledgment, and already consumed resources and completed outcomes remain.

response options compare existing catalogue alternatives as counterfactuals after acknowledged stopping. sunk consumption and recorded observations remain; unfinished work is costed as a full restart rather than assuming transferable partial progress. completed prerequisites can be reused. a modeled feasible option still needs new authorization, and its new planning window does not preserve the earlier deadline. these alternatives are neither an optimizer's universal winner nor an automatic resolution of participant disagreement.

## Strategy authoring

**Compose** selects interventions from the active world's catalogue. unfinished dependencies are included automatically; completed prerequisites retain their existing mandate references. the live preview recomputes projected consequences, protections, timing and resource demand without committing state. a name and intent create an appended strategy and replayable event. an infeasible proposal may be kept for comparison; authorization still requires feasibility and a decision rationale.

saved strategy identities and their authored revision are retained. a new strategy does not overwrite an earlier decision or create a mandate. the composer rejects stale saves after the world changes. arbitrary scopes, interventions and causal models currently require a validated raw `Profile`; they are not authored by this composer.

strategy selection and uncommitted rationale are tab-local session drafts, separate from the authoritative library. they survive view navigation and reload in the same tab. successful authorization clears the submitted rationale; separate tabs keep separate drafts. closing the browser session may discard them, and portable exports contain committed history rather than these drafts.

## Evaluation and delegation

Resources and effects are additive, optionally scaled by a claim ratio. Capability offers and agent permissions list their authorized scopes explicitly. Dependencies determine completion timing. Only effects completed within the projection count; the horizon is not a universal prohibition on later work.

a strategy is feasible when its prerequisites are selected or already completed, its authority is explicit, its new work fits within available capabilities, and all protected conditions remain intact. Missing an objective target is shown separately. No optimization or portfolio generator selects a winner.

Authorization freezes the current evaluation and source values. Acceptance atomically reserves resource ceilings. Simulated specialists wait for predecessors, advance through three progress steps and report observed effects using the frozen synthetic factor. Source changes do not rewrite those expectations.

a capacity source change may block accepted work. under `source-window-v1`, a changed lead-time claim that moves previously in-horizon expected effects outside the original horizon blocks acceptance or further progress of the affected mandate. downstream dependencies use the same timing model; unaffected actors can continue. this check preserves frozen expectations instead of rewriting them to match new evidence. Revocation requests retain unconsumed reservations until acknowledgement; consumed resources remain. Expiry stops further work. already mandated interventions cannot be reissued as if unused. a later decision can use a completed prerequisite without issuing or consuming it again: its original mandate remains the dependency, its consumed capacity remains committed, and its observed effect enters the current baseline. the new authorization freezes which prerequisites were already complete. Simulation ticks are a logical command clock, distinct from the projection's months.

## State and files

the browser stores a version-two library at `zenith.coordination.v2`. a library supports up to 24 independent workspaces, including imported projects and modeled worlds. local stale writes are rejected; corrupt raw storage is preserved for recovery.

portable exports offer the current workspace or complete library. real projects include snapshots, mappings, normalized records and human responses; modeled worlds include profiles, claim values, decisions, mandates, outcomes and events. project validation reproduces normalized records from source cells and mappings, verifies response fingerprints at the reviewed date, and excludes simulated execution. modeled validation reproduces frozen arithmetic and deterministic event replay. files are limited to 2 MB of UTF-8 data. checksums establish consistency, not authorship or scientific validity. new modeled command receipts and decision snapshots carry `source-window-v1`; older histories retain their historical execution semantics.

a library import previews before replacing state and preserves `zenith.coordination.v2.previous`. a raw `Profile` import adds a fresh world. Archive leaves stored records unchanged: valid version-two libraries download as reopenable checksummed exports; version-one and unreadable records download verbatim.

`bun run examples:coordination` regenerates three editable profile files and the checksummed worked library in [`examples/coordination`](../examples/coordination/README.md), using the same profile definitions as the application.

## Limits

file ingestion and local rule-based review are implemented. there is no remote connector, live LLM or external execution agent, optimizer, authentication, multi-user approval, server persistence or shared resource pool across independent workspaces. imported owner names do not authenticate authority. synthetic proxies are not validated regional, industrial or scientific forecasts.

verification results and their dates are recorded in [testing](testing_guide.md) and [current status](implementation_status.md). no external participant result, empirical forecast validity or production deployment is implied.

The prior Alder implementation contract is retained [unchanged in the archive](archive/2026-10-04/mvp.md).
