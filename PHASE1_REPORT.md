# Phase 1 — runtime verification

Status: **complete for the local runtime acceptance scope**. The laptop connection was restored and the final React + Python and standard-library web checks passed. All QA backends were stopped. Phase 2 is ready but must wait for the user's **continue**. This is local acceptance testing, not a production security certification.

## Verified in real Docker

| Check | Result |
| --- | --- |
| Original Python project syntax and unittest | Four Python files parsed; six tests passed |
| Python script/CSV starter | Expected JSON: count=4, min=1, max=4, mean=2.5 |
| Selected Python file | main.py completed with exit 0 and expected JSON after restart |
| Python script pytest | Two tests passed |
| React/Node starter Node test | One health test passed |
| React build | Compiled successfully with the immutable dependency directory retained |
| React static browser fixture | Three checks passed after changing the counter assertion to wait-text |
| React + Node live preview | Three browser checks passed, including the real health API; stopped afterward |
| Flask unit tests | Three tests passed with the real Flask import |
| Flask live GET/POST | Manual GET and POST plus all five saved browser checks passed |
| Flask logs and Stop | Real request logs displayed; Stop removed the session; old preview returned expired/interrupted/stopped |
| FastAPI live GET/POST | All five saved browser checks passed; stopped afterward |
| React + Python Flask | Real React build/rendering and both live API browser checks passed; logs inspected; backend stopped |
| Python standard-library web | All five GET/POST browser checks passed; backend stopped |
| Selected Python exception | Intentional RuntimeError displayed its traceback and exit 1; fixture restored exactly; rerun succeeded with exit 0 |
| Real container expiry | Dedicated acceptance test passed after 60 seconds; container and journal removed, old capability rejected |
| Real abrupt-process recovery | Dedicated acceptance test passed after its Node subprocess exited without cleanup; recovered capability changed, interrupted preview stayed blocked, cleanup succeeded |

The dedicated lifecycle tests ran via `npm run test:runtime-live` in the user's terminal. Results were saved in outputs/phase1-live-runtime-results.txt and also supplied by the user. They used a separate .agentdock/runtime-acceptance directory and did not terminate the main Studio server or read its credentials.

Browser checks used projects named Phase 1 QA. The original project's source was not edited. The React QA fixture was edited to wait for asynchronous rendering. No model request was made during Phase 1.

Docker was reachable from the user's running app. The assistant command environment could not reach it; that did not mean the user's engine was stopped.

## Implemented fixes

- Fixed both React build paths with Vite's native config loader, preventing writes to the read-only dependency directory. Source: https://vite.dev/config/ .
- Explicitly disabled log compression for the bounded single-file Docker local log driver. Source: https://docs.docker.com/engine/logging/drivers/local/ .
- Required runtime image protocol 3 before live project execution, with a clear rebuild error for older images.
- Made startup errors persistent and escaped; a 45-second readiness timeout is no longer recorded as a successful start.
- Bound startup to an immutable source snapshot and avoided opening an older snapshot after edits.
- Explained the required restart when Run Python file encounters an older server.
- Changed React starter counter checks to wait-text so deferred React state updates are tested reliably.
- Made runtime refresh render an unavailable state when Studio disconnects, instead of leaving misleading old runtime status or throwing an unhandled navigation error.
- Improved Docker diagnostics to distinguish process access failures from a stopped engine, without exposing raw diagnostic payloads.

Network isolation, non-root execution, dropped capabilities, read-only mounts and resource limits remain enabled.

## Automated validation

- 118 available automated tests passed; see outputs/phase1-automated-test-results.txt.
- 2 opt-in real Docker lifecycle tests passed; see outputs/phase1-live-runtime-results.txt.
- 60 JavaScript modules passed syntax checks.
- The three pre-existing host socket tests were excluded from the available suite because this assistant command environment returned EACCES. They were not marked passed or silently disabled in the default npm test command.

## Acceptance closure

- React + Python rendering, API checks, logs and Stop passed after reconnecting Studio.
- The standard-library Python web starter GET/POST/browser checks and Stop passed.
- The selected-file failure check ran only in the dedicated QA script project. Its original main.py was restored byte-for-byte in the editor and saved before the successful rerun.
- Runtime showed no remaining backend sessions for the tested account after cleanup. No other accounts or unrelated containers were changed.
- Original user project source was not edited. Dedicated QA projects and saved reports remain available for inspection.
- 118 available automated tests and 2 real Docker lifecycle tests passed; 60 JavaScript modules passed syntax checks. The three host socket checks remain explicitly excluded from the assistant-environment run; no claim is made that those three passed.
- No paid model request was made in Phase 1. Small capped paid Azure/OpenAI calls remain authorized for Phase 2 under existing per-request consent and token controls.

Next: ask the user to say continue before starting Phase 2 (live model compatibility, proposed changes, failure handling and token accounting). Do not repeat completed runtime checks without a source change or new failure that warrants it.

## Evidence

- outputs/workspace-run-output.jpg — earlier real six-test success in the editor.
- outputs/phase1-react-build-failure.jpg — original Vite failure before the source fix.
- outputs/phase1-flask-tests.jpg — real Flask unittest success.
- outputs/phase1-fastapi-checks.jpg — real FastAPI browser-check success.

- outputs/phase1-react-python-checks.jpg — final React + Python checks.
- outputs/phase1-stdlib-checks.jpg — final Python standard-library web checks.
- outputs/phase1-python-run-complete.jpg — restored script completing with exit 0.
