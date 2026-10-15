# Implementation status

Updated October 4, 2026. The owner-directed [product vision](product_vision.md) defines strategic coordination for humans and agents. This document describes the active implementation, not a production-readiness claim.

## Implemented

- A generic TypeScript coordination kernel around scope, objective, claim, capability, intervention, mandate and outcome.
- Multi-objective portfolio comparison with explicit capacity, protected conditions, causal dependencies and delegated scope. No combined normative score is assigned.
- Frozen human decisions, proposed mandates, atomic acceptance, bounded resource consumption, dependency blocking, stop acknowledgement and expiry.
- Deterministic simulated specialists that emit completion results and retain expected-versus-observed differences.
- Strict profile/workspace validation and event-trace replay; current source values do not overwrite prior decision inputs.
- Four utility views: Situation, Strategies, Mandates and Ledger; agent avatars open scoped authority.
- Fresh guided onboarding, populated worked cases, custom worlds, raw profile imports and independent new instances.
- Harbor, Meridian and Open Atlas: three distinct synthetic domains using one engine, with portable profiles and worked histories in `examples/coordination`.
- Browser-local library persistence, stale-write protection, checksummed export/import, replacement recovery copies and preserved version-one archives.

The worked cases execute the same kernel commands as the UI. Each contains a prior accountable decision, completed agent mandates, outcomes and a subsequent source revision. **Begin** and **New instance** retain an untouched planning state instead.

## Verification

the coordination suite passed **47 tests / 981 assertions** on October 4, 2026. it covers feasibility, authority, lifecycle, consumption, source revisions, replay, fixture coherence and file integrity. the retained commons suite passed **22 tests / 10,634 assertions**. web lint, standalone TypeScript and the production build passed.

the coordination UI passed **157 isolated WebKit checks**, separate from the kernel unit tests, across its workflows, all three profiles and desktop, tablet and phone widths down to 320 CSS pixels. verification includes first-run import, native export/reopen, concurrent edits, recovery, complete scope-map overlaps, keyboard navigation, reduced motion and print layout; passing runs reported no application errors. see [testing](testing_guide.md) and the latest coordination section in [design QA](../design-qa.md). older Alder screenshots and counts are historical.

## Limits and next boundaries

The active kernel evaluates declared intervention portfolios. It does not optimize or generate them. Effects are additive planning proxies, with optional claim-based scaling; the examples do not establish empirical validity.

Agent execution is a bounded local simulation. There are no live agent/model integrations, external ingestion connectors, authentication, server persistence, multi-user approval or signed institutional authority. Separate library worlds are independent examples; resources are not globally coordinated across worlds.

Further work must add measured models and provenance adapters, real delegated runtimes, durable shared identity and authorization, and network-level coordination without duplicating resources or silently extending authority. The [roadmap](roadmap.md) governs that sequence.

The previous status document is retained [unchanged in the archive](archive/2026-10-04/implementation_status.md).
