# Verification — 29 October 2026

## Source verification phase - 30 October 2026

**90 tests passed, 0 failed; 49 JavaScript modules passed syntax checks.** New tests cover report/account isolation, source hashing and stale-source rejection, fixture-result matching, SQLite persistence, history limits, matching/latest container evidence, concurrency, UI escaping and five frontend scenarios: matching preview, stale preview, edits during report creation, edits during checks, and timeout. A subprocess test confirms the QA-only JavaScript guard rejects outbound sockets and fetch before sending anything.

Actual browser QA on localhost:4199 loaded Verification, created a report, and displayed seven passing static checks, a valid fixture, and preview checks pending. Before preview checking completed, automatic approval review terminated QA over an outbound Visual Studio telemetry connection with an unknown payload. The QA process had an outbound socket/fetch guard, debugger-related environment options removed, and no real provider credentials; these measures do not establish the source/payload of the separately observed telemetry. The rejection was not bypassed. Complete browser result persistence and actual Docker execution remain unverified. A full-page screenshot attempt was unavailable. No paid model request was made.

## Recovery and diagnostics update - 30 October 2026

**74 tests passed, 0 failed.** The 13 added cases cover durable recovery records, invalid/missing records, process ownership, container label verification, cleanup failure/retry, expiry, diagnostics and authentication. One case starts a real Node subprocess, leaves its runtime record by exiting without cleanup, then confirms the next manager recovers owner controls while both old and interrupted preview capabilities remain unusable. Docker operations in this case are injected fixtures, not real containers. Existing real HTTP-broker subprocess tests also pass.

The actual `node scripts/doctor.mjs` command passed Node and Docker CLI checks, then reported the Docker engine unavailable (exit 1 intentionally signals an infrastructure issue). It performed no image download, project execution, or paid provider request. Diagnostic stderr and local secret configuration are not returned in API reports. New recovery and diagnostic controls have not had a fresh browser QA pass. Earlier browser screenshots do not demonstrate this increment.

## Completed

Subsequent live browser testing succeeded on the isolated QA instance at `http://localhost:4199`. Sign-in, preview interactions, UI integration/approval, editing, restart persistence, error detection, laptop-folder export, and ten combined static/browser checks were verified. See `BROWSER_QA.md` and `outputs/browser-tests-passed.jpg`. The earlier browser-access limitations below are historical; the chat client's browser-panel visibility remains unreliable.

Earlier backend increment: **61 tests passed, 0 failed**, including temporary server ownership/lifecycle, one-per-user/two-total capacity, expiry, shutdown during startup, bounded logs, credential stripping, capability-scoped redirects, and asynchronous browser-check logic. Three tests execute the real broker subprocess against trusted local HTTP fixture servers; these verify actual body forwarding, header filtering, response-size rejection, and target validation. Container lifecycle tests use an injected Docker adapter. They do not prove the image builds or the React/Node container executes successfully. Syntax checks pass for **38 JavaScript modules**.

The prior 46-test increment covered monthly quota boundaries and owner-only/locked AI pause. Those controls have not received a new full browser QA pass. A backup allowlist omission was fixed: the portable source archive now includes the root `server.mjs` entry point and browser-only fallback. Actual runtime data and credentials remain excluded.

The new Runtime controls rendered in the isolated QA browser with execution disabled. Further browser verification was stopped by automatic approval review over an outbound Visual Studio telemetry connection with unknown payload/authorization. It was not approved or bypassed. No fresh browser screenshot of this increment is available; earlier screenshots show the earlier verified workflows.

The earlier browser-tested increment passed 42 tests and syntax checks for 31 modules. The generated single-file frontend also passed an independent Node syntax check after verifying that relative module imports were removed. These checks do not substitute for real Docker/Azure execution; the separately observed browser QA is described above.

- Node.js 24.13.0 is available on this laptop.
- The v0.2 server starts at http://127.0.0.1:4173 and reports SQLite storage with AI off when no credentials are configured.
- Tests exercise account/session boundaries, password hashing, cross-origin rejection, per-user workspace isolation, optimistic save conflicts, component publishing consent, author/owner moderation, immutable previews/releases, re-enabling releases, nested-file exports, JavaScript parsing without executing source, Azure endpoint formats, explicit AI consent, per-user and total allowance rejection, concurrent-request blocking, cache reuse, retained failure reservations, GitHub non-force commits, and Netlify ZIP payloads.
- Provider and external-service tests inject fake transports. No live LLM, GitHub, or Netlify calls were made.
- Source validation and syntax-check results are recorded in the accompanying command output and updated before delivery.
- An encryption/decryption round trip with a dummy value verified Windows account protection after correcting the inherited PowerShell module path. No real credential was involved.
- ZIP output was independently opened and CRC-checked with Python's standard zipfile reader.
- Docker CLI is installed, but the Docker Desktop Linux engine pipe is unavailable. No image or dependency download was initiated. Container flags, consent gates, artifact validation, cleanup, and private-beta invitations are tested with an injected Docker adapter; an actual React compilation/container execution is not yet verified.

## Not verified end to end

- Earlier runs returned loopback EACCES and browser timeouts. The later browser QA run verified rendering and interactions at the normal browser viewport, including actual iframe checks. Additional responsive breakpoint coverage remains incomplete.
- The browser explicitly blocks file:// navigation. That route was not bypassed. `preview.html` remains available for the user to open directly, but it is browser-only mode, not the server app.
- Azure is configured locally by the user. No real key was read or printed and no paid verification request was sent. Live Azure model compatibility remains unverified; configuration does not imply a successful inference request.
- Real GitHub repository writes and Netlify publication were not performed.
- The interactive Windows secret setup must be run by the user; it is never run with a real key through assistant tools.

This is not a claim of production readiness. See README.md for implemented scope and PLAN.md for remaining cloud infrastructure.
