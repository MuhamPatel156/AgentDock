# Current execution plan

PHASES.md is the authoritative 16-phase sequence requested by the user. Work on one phase at a time and pause after each completed phase for the user's continue. PHASE1_REPORT.md records completed local runtime verification. Phase 2 is waiting for the user's continue. These current files supersede older historical counts and engine-status notes below.

# AgentDock implementation status

## Implemented in v0.2

- Python/editor bulk phase: stdlib, Flask, FastAPI, React + Python and script/CSV starters; syntax/unittest/pytest/script jobs; Python web snapshots; catalog/manifest inspection; matching verification stages; source search, downloads and reviewable rename. 103 tests pass; 55 JavaScript modules pass syntax checks. Actual Docker image build/framework execution is still pending.

- Verification phase: private SQLite reports, source fingerprints and stale-report warnings, fixture validation, preview result persistence, source-matched container evidence, bounded history and JSON export. 90 automated tests pass; 49 modules pass syntax checks. Browser report creation/display verified; full browser result persistence still needs live QA.

- Latest increment: durable interrupted-session recovery, revoked old preview capabilities, verified container ownership, retryable cleanup failures, and read-only runtime diagnostics. Automated suite: 74 passing tests. A real Node process-exit recovery test passed; actual Docker engine execution is still unverified.

- Local accounts, salted password hashes, hashed session tokens, owner role.
- SQLite persistence; per-account workspaces and optimistic revision checks.
- Multi-file editing, imports, folder/ZIP export, workspace backups, checkpoints.
- Isolated immutable static previews, console errors, DOM smoke checks.
- Source parsing and deterministic checks, metadata repairs, UI insertion.
- Personal components plus a shared, licensed component catalog on this instance.
- Explicit AI request consent; review/approve/reject; context selection.
- Azure OpenAI v1 and legacy adapters using LLM_MODEL / AZURE_API_KEY / AZURE_API_BASE.
- Optional hidden-input Windows setup with account-bound DPAPI encryption.
- Transactional per-user and total daily reservations, caps, caching, no retries.
- GitHub commit/push and Netlify ZIP-deploy code, disabled without credentials.
- Local release snapshots and durable activity records.
- An AI assistant project template with developer-approved preview inference and an exported local Node/Azure backend.
- The user selected React + Node and an invited private beta. Additional accounts are invitation-gated.
- Optional container job driver, trusted React/Vite image definition, React project template, build artifact previews/exports/releases, and isolated Node tests. Real engine execution remains blocked until Docker Desktop is running and the image is prepared.

## Still required for the full cloud platform

1. Complete real-engine verification of the implemented React/Node build and temporary-server drivers, pin the reviewed image digest/dependency lock, and provision disposable cloud workers with operational monitoring. Add persistent services and orphan-worker recovery without exposing host credentials or the Docker control socket to project code.
2. Add a real agent-app backend runtime: model routing, secure tool connections, tracing, evaluation fixtures, and per-project secrets.
3. Add production authentication/password recovery, HTTPS configuration, durable managed storage, monitoring, backups, abuse controls, and server-enforced monetary budgets.
4. Add GitHub OAuth and per-user scoped integration credentials instead of instance-wide tokens.
5. Add a public community with moderation, attribution enforcement, reporting, quality checks, and submission versioning.
6. Add multi-user collaboration and build/deployment orchestration; test real cloud rollout and recovery.

## Information useful next (no secrets)

- The Azure deployment's underlying model family, deployment name, and whether it uses v1 or a versioned endpoint. These affect API compatibility and context/output defaults.
- Monthly AI budget in INR/USD and expected number of users. Token caps alone do not define currency spend.
- First application framework and language to support beyond static websites.
- Whether the next release is only for you or for invited developers.

## Actions requiring your concrete authorization

- Paid Azure calls: approve each request in the app; no background spending.
- Paid cloud compute/storage: choose account and spending ceiling before provisioning.
- External repository writes: configure your exact repository and explicitly approve a push.
- External deployment/public audience/domain: configure the target and explicitly approve publishing.
- Public component distribution: confirm source ownership/license and submission policy.
- Customer billing: decide business/payment ownership before enabling charges.

API keys, passwords, and access tokens must be entered locally using the secure setup command or local environment configuration, never in chat. Nonsecret product preferences do not block ongoing coding.
