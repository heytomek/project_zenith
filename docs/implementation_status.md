# Implementation status

updated November 2, 2026. The owner-directed [product vision](product_vision.md) defines strategic coordination for humans and agents. the product job is keeping authorized promises coherent as conditions change, with local judgment, selective attention and separate values. this document describes the active implementation, not a production-readiness claim. [the research and interpretation](strategic-reconsideration.md) distinguishes published evidence from our product hypothesis.

## Implemented

- real-project CSV/JSON ingestion, with file/paste preview, explicit column mapping, a header-only template and preserved source cells; Title and Project are required.
- immutable project snapshots with declared report dates, normalized values and full-source refresh. missing source fields remain coverage gaps rather than invented facts.
- local rule-based review agents for declared deadline, budget, dependency and decision-request conditions, grouped by project in Attention. these agents do not use an LLM or call remote services.
- automatic derived review on import, refresh and opening, with date checks while the browser stays open. unchanged relevant facts retain Reviewed state; changed or recurring conditions reopen.
- appended human judgments with cited source snapshots, finding fingerprints and review dates. Record preserves earlier reasoning without editing source values or authorizing execution.
- separate real-project mode with Attention, Sources and Record, preserved historical source versions, and kernel guards excluding simulated effects, resource reservations, mandates and outcomes.
- A generic TypeScript coordination kernel around scope, objective, claim, capability, intervention, mandate and outcome.
- Multi-objective portfolio comparison with explicit capacity, protected conditions, causal dependencies and delegated scope. No combined normative score is assigned.
- Frozen human decisions, proposed mandates, atomic acceptance, bounded resource consumption, dependency blocking, stop acknowledgement and expiry.
- Deterministic simulated specialists that emit completion results and retain expected-versus-observed differences.
- Strict profile/workspace validation and event-trace replay; current source values do not overwrite prior decision inputs.
- four modeled-world views: Situation, Strategies, Mandates and Ledger; agent avatars open scoped authority.
- User-authored strategies appended from an existing intervention catalogue, with automatic prerequisite selection, live preview and an auditable strategy event. Saving a portfolio grants no execution authority.
- Continuation after completed work: new mandates can depend on existing completed prerequisites while preserving their original costs, outcomes and identity.
- Derived guidance and compact attention based on current evidence, proposed envelopes, committed capacity, live mandate state and direction-aware outcome differences.
- Compact strategy comparison against the current baseline, progressive mechanism detail and tab-local rationale drafts retained through navigation and reload.
- Fresh guided onboarding, active Explore decision episodes, custom worlds, raw profile imports and independent new instances. earlier completed worked histories remain compatible.
- Manual structured evidence snapshots retaining source title, author, publication date and excerpt separately from the starting source.
- Reconsideration of a frozen promise against observed conditions and reassessed remaining work, with changed claims traced to declared causal paths, affected outcomes and responsible stewards.
- Retain/investigate/stop responses with attributable rationale; responses do not clear active constraints or grant broader authority.
- Catalogue response counterfactuals after acknowledged stopping, retaining spent resources and observations while charging full restart cost for unfinished work and requiring a new planning window and authorization.
- `source-window-v1` guards that stop affected execution when changed lead-time evidence invalidates its original in-horizon effects, with replay support for historical unsigned version-two records.
- Harbor, Meridian and Open Atlas: three distinct synthetic domains using one engine, with portable profiles and worked histories in `examples/coordination`.
- Browser-local library persistence, stale-write protection, checksummed export/import, replacement recovery copies and preserved version-one archives.

Explore episodes execute the same commands as the UI: authorize, accept, advance, record evidence and reassess. they contain spent resources, completed observations where earned, active commitments and a consequential capacity or timing change. the unchanged `workedExample` generator retains completed histories for portable examples and compatibility. **Begin** and **New instance** start untouched planning.

## Real-project verification

**149 coordination tests / 1,899 assertions pass**, including real-source parsing, normalization, provenance, evidence continuity, response replay, source chronology and project-mode isolation. lint, standalone TypeScript, the production build and whitespace checks pass. **64 isolated WebKit checks pass**: 56 complete-workflow checks and 8 final entry/mapping checks, with no application errors. coverage includes actual CSV template and JSON downloads, file/paste mapping, real-project review, preserved source history, unchanged/changed evidence, historical read-only decisions, stale cross-tab responses, replacement warnings, keyboard behavior, reduced motion and layouts down to 320px. the in-app browser connection was recovered and the current build reopened its saved library successfully; the import dialog is ready there without adding test data. see [captures and runnable checks](design/2026-11-02/real-projects/README.md), [the data contract](project-data.md), [testing](testing_guide.md) and [design QA](../design-qa.md). previous counts below describe earlier increments, not additional fresh checks.

## Earlier reconsideration verification

111 coordination tests / 1,664 assertions passed, together with lint, TypeScript and the production build. 66 isolated WebKit checks (62 workflow + 4 existing-user Explore) passed with no application errors. coverage includes sourced evidence → review → investigate with the constraint retained → corrected evidence → bounded resumption; atomic stopping and acknowledgment without refunding consumption; downloaded history round-trip; frozen-record print layout; stale concurrent responses; all three active case Situation, Review and response surfaces at 1280, 720, 390 and 320px; keyboard focus, reduced motion and preserved legacy bytes. prior results below describe the earlier strategy-authoring baseline, not additional fresh checks.

## Earlier November 2 authoring verification

the coordination suite passed **73 tests / 1,221 assertions**. lint, standalone TypeScript and the production build passed.

**91 isolated WebKit checks passed with no application errors.** coverage includes all four views and Compose across Harbor, Meridian and Open Atlas at 1280, 720, 390 and 320 CSS pixels; the complete compose → authorize → accept → complete → native download → reopen cycle; staged continuation without repeated history or effects; preserved legacy bytes and rejected checksum tampering; rationale drafts across navigation and reload; composer dismissal; keyboard focus containment and return; the selected comparison column with pinned objective labels on phones; navigation scroll position and reduced motion. see the current [design QA](../design-qa.md) and [testing guide](testing_guide.md).

the figures below describe the earlier October baseline, separately from this increment. these checks establish implementation behavior, not scientific forecasts, user-study results or production authorization.

## Historical baseline verification

the coordination suite passed **47 tests / 981 assertions** on October 4, 2026. it covers feasibility, authority, lifecycle, consumption, source revisions, replay, fixture coherence and file integrity. the retained commons suite passed **22 tests / 10,634 assertions**. web lint, standalone TypeScript and the production build passed.

the coordination UI passed **157 isolated WebKit checks**, separate from the kernel unit tests, across its workflows, all three profiles and desktop, tablet and phone widths down to 320 CSS pixels. verification includes first-run import, native export/reopen, concurrent edits, recovery, complete scope-map overlaps, keyboard navigation, reduced motion and print layout; passing runs reported no application errors. see [testing](testing_guide.md) and the latest coordination section in [design QA](../design-qa.md). older Alder screenshots and counts are historical.

## Limits and next boundaries

the active kernel evaluates declared portfolios, including user-authored combinations of existing interventions. it does not generate arbitrary interventions, causal models or an optimized winner. Effects are additive planning proxies, with optional claim-based scaling; the examples do not establish empirical validity.

real-source review accepts user-provided file snapshots and applies explicit local rules. it does not extract free-form documents, fetch source systems or use an LLM. modeled agent execution remains a bounded local simulation. there are no remote execution agents, ingestion connectors, authentication, server persistence, multi-user approval or signed institutional authority. separate library workspaces are independent; resources are not globally coordinated across them.

further work must validate the decision queue against real user projects, add authorized live adapters and configured agent providers where useful, and extend contextual strategic model authoring, empirically grounded causal models and agreed review/escalation policy. durable shared identity, bounded external clients and federation follow those contracts. current sources enter through manual file refresh or modeled claim entry; there is no timed Cybersyn-style recovery or escalation service or implemented participant-consent workflow. these extensions must preserve source history, resource identity and explicit authority. the [roadmap](roadmap.md) governs that sequence.

The previous status document is retained [unchanged in the archive](archive/2026-10-04/implementation_status.md).
