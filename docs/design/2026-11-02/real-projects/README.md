# Real-project acceptance

November 2, 2026. **149 coordination tests / 1,899 assertions** and **64 WebKit checks** pass; lint, standalone TypeScript, production build and whitespace checks pass. the earlier reconsideration and authoring counts are historical checkpoints, not added to these totals.

the workflow uses disposable QA data, never prefilled into the product or imported into the user's library. actual user data was not supplied. the implemented path accepts the user's own CSV/JSON records through the same importer and reviewers.

- [Import](import.png): file preview, explicit mapping, report date and source coverage.
- [Attention](attention.png): project-level decisions with actual commitment names, dates, amounts and owners from the QA source.
- [Decision](decision.png): both sides of a dependency, original source records and a source-preserving response.
- [Phone](phone.png): the same decision flow at 390px. all three views and review also passed at 320px, 760px and 1280px.

[qa-workflow.js](qa-workflow.js) contains 56 checks for onboarding, CSV/JSON/paste ingestion, invalid dates, preview isolation, preservation of an existing modeled case, deterministic review, precise citations, draft persistence, append-only judgment, unchanged/changed refresh, historical records, actual file download/reopen, cross-tab conflicts, omission warnings, responsive reachability, keyboard access and motion. [qa-entry.js](qa-entry.js) adds 8 checks for reopening saved real work, manual mapping, future-date rejection, 320px import layout and cancellation without mutation.

the in-app browser control initially failed, so mutations ran in a separate WebKit session at port 3107. resetting the control recovered in-app inspection. the latest build reopened the existing port-3000 library, and its Bring project data dialog was left ready. that library was not seeded or reset for acceptance.

to reproduce, first generate [the disposable fixtures](qa-fixtures.ts), then run a production preview on port 3107. the workflow resets only the coordination storage key at that origin, so use an isolated context rather than a browser with user work there. scripts use absolute paths for this checkout; adjust `out` and fixture paths if moved.

```sh
bun docs/design/2026-11-02/real-projects/qa-fixtures.ts
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3107
```

in another terminal:

```sh
export PLAYWRIGHT_CLI_SESSION=zenith-projects
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:3107 --browser=webkit
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh --raw run-code --filename=/Users/tomek/1/repos/project_zenith/docs/design/2026-11-02/real-projects/qa-workflow.js
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh --raw run-code --filename=/Users/tomek/1/repos/project_zenith/docs/design/2026-11-02/real-projects/qa-entry.js
/Users/tomek/.codex/skills/playwright/scripts/playwright_cli.sh close
```

these checks establish local file review and consistency. they do not establish source truth, authenticated authority, continuous background monitoring, LLM interpretation, live connectors or empirical decision usefulness. no external project system was contacted or changed. see [the data contract](../../../project-data.md).
