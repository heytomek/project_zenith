# Coordination browser evidence

the three `qa-*.js` files preserve the isolated WebKit acceptance runs: 30 workflow, 116 extended and 11 final checks. they target a production build at `http://127.0.0.1:3107`, in a disposable browser context. they overwrite synthetic state at that origin; do not run them in a browser holding real work.

run them sequentially with a Playwright CLI `run-code --filename=<file>` command, configured for WebKit. the scripts use this checkout's absolute paths for example files, screenshots and temporary downloads. adjust those paths when moving the repository. create `/private/tmp/zenith-coordination-qa` for downloads before running.

the captured screens show settled states at 1280px and 390px. the extended run also checks 720px and 320px. native downloads, recovery, stale writes and reduced motion were exercised. print media was checked; the native print dialog and screen-reader user testing remain unverified.

see [the complete QA record](../../../../design-qa.md) for engineering checks, coverage and limits.
