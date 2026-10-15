# Testing Zenith

From the repository root:

```sh
bun test tests/coordination
bun run lint:web
bun run build:web
bun run typecheck:web
```

The coordination tests cover resource accounting, objective protections, dependency timing, explicit agent and capability scopes, immutable decision inputs, atomic acceptance, source shocks, revocation acknowledgement, expiry and deterministic outcomes. Imports must reproduce both frozen evaluation and the command/event history; a recomputed checksum cannot legitimize fabricated consumption or overaccepted capacity.

Profile tests exercise the same kernel across Harbor, Meridian, Open Atlas and a smaller custom scope. Worked-history tests execute the complete synthetic decision-to-outcome cycle, revise a relevant source afterward and verify portable replay. Storage tests cover running/completed/stopping libraries, key ordering, checksum tampering, strict shape, duplicate identities, active-world references and the 2 MB UTF-8 limit.

on October 4, 2026, the coordination suite passed **47 tests / 981 assertions**. web lint, standalone TypeScript and the production build passed. these checks establish software behavior, not the scientific accuracy of the example forecasts.

## Browser acceptance

the rebuilt UI passed **157 isolated WebKit checks**: 30 workflow, 116 extended and 11 final targeted checks. these browser checks are separate from the kernel unit tests above. all four views across all three profiles were checked at 1280, 720, 390 and 320 CSS pixels, alongside onboarding, keyboard focus, reduced motion, print layout, native export/reopen, stale edits, cross-tab refresh and corrupt-storage recovery. final checks verified first-run file import, reopening an existing custom world without an active selection, recovery preservation and complete overlap edges in all three scope maps. passing runs reported no application errors. see the latest coordination section in [design QA](../design-qa.md); older Alder results remain historical.

the acceptance coverage is:

1. Start from fresh storage. Inspect all three world profiles. **Begin** opens an untouched guided setup; **Worked case** opens completed synthetic history with a later source change.
2. Navigate Situation, Strategies, Mandates and Ledger. Inspect an overlapping scope, a protected condition and an agent's explicit rights.
3. Compare two feasible portfolios and one rejected portfolio. Inspect resource demand, dependency order, objective changes and unresolved targets without a hidden combined score.
4. Revise a bounded source claim and apply a predefined shock. Verify changed resource availability or delayed benefits. Late effects must not appear inside the projection.
5. On a fresh world, authorize a feasible strategy with a rationale. Confirm frozen inputs and ceilings, accept proposals atomically, advance simulated agents and inspect dependency waits, consumption and forecast error.
6. Reduce a committed capacity. Execution must block without rewriting the decision. Request a stop; retain reservations until acknowledgement and retain consumed resources afterward.
7. Use the agent's unauthorized-expansion probe. Confirm a rejected receipt and unchanged authority/resource ceilings.
8. Open **New instance**. Confirm complete profile data and fresh claims while the previous world's decisions, outcomes and ledger remain intact.
9. Create a small custom world and import a valid raw `Profile`. Preview a full library import, cancel it, then reopen an actual downloaded export. Confirm preservation of the previous library and older version-one keys.
10. Check all four views, onboarding and dialogs at desktop, tablet and phone widths. Exercise keyboard focus, named icon controls, reduced motion, responsive scrolling and browser console errors.
11. Open another tab on the same origin. Refresh changed storage and reject stale writes rather than overwriting unseen state. Preserve corrupt raw storage for Archive recovery.

## Historical regressions

```sh
bun test tests/commons
.venv/bin/python -m pytest tests -q
.venv/bin/python -m ruff check apps/api services/planner packages/schemas tests
```

the retained commons suite passed **22 tests / 10,634 assertions**. the disconnected Python prototype was unchanged and its suites were not rerun for this rebuild. these historical checks do not verify the new coordination UI. the [usefulness study](usefulness-test.md) remains human validation work; no participant result or production deployment is claimed.
