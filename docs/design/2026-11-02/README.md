# November product verification

`qa-workflow.js` records the 91-check passing WebKit run. it targets a production preview at `http://127.0.0.1:3107` in a disposable browser context. it changes synthetic state at that origin and saves temporary downloads under `/private/tmp/zenith-november-qa`; do not run it against a context holding real work.

run with the Playwright CLI configured for WebKit, using `run-code --filename=<absolute script path>`. create the temporary download directory first. repository paths are absolute to this checkout; adjust them when moving it. the script writes these captures after real interactions:

- `strategies-desktop.png` and `strategies-mobile.png`: compact alternatives and consequence comparison.
- `composer-desktop.png` and `composer-mobile.png`: intervention selection, dependency closure, live preview and reachable save controls.
- `situation-desktop.png`: current objectives, evidence attention and capacity.

the responsive captures use reduced motion for settled states. dialog entry/dismissal, complete keyboard focus cycles and return to the composition trigger were also exercised. all four views and the composer were checked across three domains at 1280, 720, 390 and 320px.

73 coordination unit tests / 1,221 assertions pass separately from the 91 browser checks. see [design QA](../../../design-qa.md) and [testing](../../testing_guide.md) for coverage and remaining boundaries.
