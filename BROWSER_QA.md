# Phase 1 completed — 30 October 2026

The laptop connection was restored. Final React + Python build/render/API checks (2) and Python stdlib GET/POST checks (5) passed in actual Docker through Studio. Their backend logs/Stop controls were verified and no test-account backend sessions remained after cleanup. A real selected-file RuntimeError displayed exit 1; the dedicated script was restored exactly and reran with exit 0. Earlier phase evidence covers React/Node, Flask, FastAPI, selected Python output, and real Docker expiry/recovery. See PHASE1_REPORT.md and PHASES.md for the authoritative completed scope and next-phase gate.

Final screenshots: outputs/phase1-react-python-checks.jpg, outputs/phase1-stdlib-checks.jpg and outputs/phase1-python-run-complete.jpg. No AI request was made in Phase 1. Automated totals: 118 available tests and 2 real lifecycle tests passed, 60 module syntax checks; three host socket tests remain explicitly excluded from the assistant environment's run.

# Editor and output update — 30 October 2026

Verified in the user's running AgentDock instance at `http://127.0.0.1:4173/` without changing project source or using Azure:

- Runtime reported Docker execution enabled and the trusted image available. The assistant command environment could not reach Docker; that diagnostic did not reflect the application's access.
- Default editor list displayed 7 of 12 files. Show all files restored all 12; searching for runtime found the hidden configuration.
- A real Docker Python syntax job passed for app.py, greeting.py, test_app.py and test_greeting.py.
- The new Workspace Python unittest control ran six real tests, all passing. Their output displayed in Run & output directly below the editor.
- Screenshot: outputs/workspace-run-output.jpg.
- Run Python file has controller and API adapter coverage; the already-running server needs restarting to load that new mode before its actual container run can be verified. The selected entry is staged only in the temporary job copy and does not satisfy full-project script verification.

Validation: 107 automated tests passed with the three local socket tests excluded. The unfiltered attempt had three failures in the broker/HTTP integration tests; the broker reported `connect EACCES 127.0.0.1` from this command environment. See outputs/automated-test-results.txt for that attempt and outputs/available-test-results.txt for the available suite. All 57 JavaScript modules passed syntax checks. Real Docker runs above were verified through the existing app, without launching another QA server.

# Live browser verification — 29 October 2026

Testing used the isolated `http://localhost:4199` instance, with a separate SQLite database and a dummy fixture account. Azure, GitHub, Netlify, and container execution were disabled for this browser run. The user's account at `http://127.0.0.1:4173` and its API key were not used.

## Verified in the actual browser

| Workflow | Observed result |
| --- | --- |
| Sign in with the QA fixture | Workspace loaded and a server-backed session persisted |
| Render starter preview | Actual HTML/CSS and JavaScript loaded in the isolated iframe |
| Click starter button | Button changed to “You’re ready to build” |
| Integrate a UI component | Source review shown; approval inserted metric cards and created a checkpoint |
| Create a blank project | Four source files appeared and the preview rendered |
| Edit HTML and JavaScript | Source changes appeared in the running preview |
| Deliberate invalid JavaScript | Server syntax checker caught `const = ;` |
| Runtime diagnostics | Preview displayed the actual syntax error and line number |
| Restart test server and reload | Edited project and session were recovered from SQLite |
| Correct source and run static checks | Seven static checks passed |
| Run interaction fixture | Element existence, button click, and changed-text assertions passed |
| Combined results | All ten checks were visible with explicit Passed labels |
| Save folder on laptop | Export dialog confirmed a new folder under the isolated QA data directory |

## Fixes made during browser testing

- Successful checks now display success text rather than failure guidance.
- Syntax diagnostics omit irrelevant Node internal stack frames.
- Preview script loading uses anonymous CORS; only capability-scoped snapshot GET requests accept the iframe's opaque origin. APIs and application code still reject cross-origin/opaque-origin requests.
- Browser runtime errors include their real message and line number.
- Starting a new preview clears stale console errors.
- Navigation buttons retain accessible names when their text is hidden on narrow screens.
- Test results expand with the page so all results can be captured without an inner scroll area.

## Evidence

The later Verification phase was browser-inspected on the isolated account: the new page loaded and saved/displayed seven static passes plus a valid fixture, with preview results pending. QA was subsequently terminated by automatic approval review over unknown Visual Studio telemetry. The complete new preview/report-save workflow was covered by controller/API tests but not completed in the live browser. A fresh full-page screenshot could not be captured. Older screenshots below show earlier workflows.

- `outputs/browser-workspace.jpg`: running workspace and integrated component.
- `outputs/browser-checks.jpg`: intentionally failing syntax test, with other checks passing.
- `outputs/browser-tests-passed.jpg`: final seven static plus three browser checks passing.
- `outputs/automated-test-results.txt`: final automated suite output.

The in-app browser connection dropped while waiting for a ZIP-download event. Browser ZIP completion remains unverified. ZIP creation and extraction are covered separately by API tests and an independent ZIP reader check.

Real Azure inference, GitHub writes, Netlify publication, and actual Docker compilation were not performed. No live Azure tokens were spent. The browser panel did not consistently appear in the user's chat client, so actual screenshots were supplied inline rather than claiming an interactive panel was visible.

## Temporary backend increment

The updated Runtime page was inspected in the isolated browser account: Live Node backends, its consent checkbox, Start current backend, static preview switch, and opt-in/expiry instructions rendered. The QA configuration keeps both builds and servers disabled. No live container was started. A later QA-server action was rejected by automatic approval review because it detected an outbound Visual Studio telemetry connection with an unknown payload/destination authorization. That connection was not approved or bypassed; further browser verification and a fresh screenshot remain blocked. Automated API/adapter checks and real local HTTP-broker subprocess tests are recorded separately in VERIFICATION.md.
