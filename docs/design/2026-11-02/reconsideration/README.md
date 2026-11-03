# Reconsideration verification

November 2, 2026. the in-app browser was used first to inspect the running product, then an isolated WebKit session on `http://127.0.0.1:3107` exercised state-changing workflows. existing browser work at port 3000 was preserved. a separate Meridian case was appended there for the final preview.

engineering: **111 coordination tests / 1,664 assertions**, lint, standalone TypeScript, production build and `git diff --check` passed. browser: **66 checks passed**, comprising 62 workflow checks and 4 existing-user Explore checks, with no application errors.

- [Situation](meridian-situation.png): one course review action and a live qualification exception.
- [Review](meridian-review.png): the original commitment, current state and reassessed course; changed evidence and responsible participants.
- [Phone](review-mobile.png): the same review at 390px. all three domains also passed at 320px, 720px and 1280px.
- [Print media](decision-print.png): the original frozen decision, excluding the live reassessment.

the [workflow script](qa-workflow.js) tests source provenance, invalidated horizons, bounded resumption, review writing across evidence inspection, immutable authorizations, completed-effect accounting, atomic stop, native JSON download/reopen, concurrent edits, responsive reachability, keyboard containment, reduced motion and preservation of the earlier storage key. the [entry script](qa-entry.js) tests the 320px world picker and independent Explore case creation while preserving every existing workspace.

run only on a disposable QA origin: the workflow script resets the coordination key on port 3107. it expects the app at that port and writes captures to this directory; adjust its `out` path if the repository is moved. the entry script runs after the workflow script and appends another example. use the existing WebKit CLI wrapper from the Playwright skill, with a separate session:

```sh
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3107
```

in another terminal:

```sh
export PLAYWRIGHT_CLI_SESSION=zenith-review
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:3107 --browser=webkit
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh --raw run-code --filename=/Users/tomek/1/repos/project_zenith/docs/design/2026-11-02/reconsideration/qa-workflow.js
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh --raw run-code --filename=/Users/tomek/1/repos/project_zenith/docs/design/2026-11-02/reconsideration/qa-entry.js
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh close
```

these checks verify an inspectable local simulation, not production integrations or organizational usefulness. native print-dialog behavior, external data ingestion, empirically calibrated forecasts, authenticated participants and agreed calendar recovery/escalation remain unverified. logical command ticks do not establish elapsed business time.
