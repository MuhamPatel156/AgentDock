# AgentDock Studio v0.2

A running local development platform for multi-file websites and curated Node/Python applications, with durable accounts and projects, reviewable AI proposals, UI integration, functional preview checks, and export/deployment adapters. All code is in this folder on your laptop. No npm dependencies are required. Node.js 24+ is required (this laptop has Node 24.13).

## Run on your laptop

Double-click `START.cmd`, or open a terminal in this folder and run:

```sh
npm start
```

Open **http://127.0.0.1:4173** in your browser. Create a local username and a unique password (12+ characters); the first account is the instance owner. This is not your Azure, Microsoft, GitHub, or ChatGPT account. The instance owner alone can use configured GitHub and Netlify credentials. There is no password recovery service yet; keep your password securely.

The selected direction is **React + Node for an invited private beta**. After the first owner account, additional registration requires `AGENTDOCK_INVITE_CODE`, configured locally by the owner. Registration can also be closed with `AGENTDOCK_REGISTRATION=closed`. Never place invitation codes in public source or chat.

The server listens on loopback only. If an older Studio server is running, close it first. Change `PORT` in local configuration if necessary. The local app is not publicly accessible on the internet.

`preview.html` is the same frontend bundled into one file. Double-click it for browser-only mode if you cannot run the server. Accounts, ZIP export, shared components, server persistence, functional preview checks, and AI require the local server. Browser-only mode is clearly labelled and does not pretend to have a backend.

## Configure Azure securely

On Windows, run this command **yourself in an interactive terminal**:

```sh
npm run configure:azure
```

Enter the Azure deployment name, resource endpoint, API style, and API key. Key input is hidden. The key is encrypted with Windows DPAPI for your current Windows account and saved in ignored `.agentdock/azure.credentials.json`. It is unlocked only into server memory at startup; it is not written into source, the browser, or plaintext `.env`. Any process running as your Windows user with access to the encrypted file may also decrypt it, so this is account-bound protection, not a separate enterprise vault.

Restart with `npm start`. The key is passed to the PowerShell encryption/decryption helper through stdin, not process command arguments or log output. Do not run this interactive setup through an assistant tool: enter the secret directly yourself. Setup makes no model requests.

Alternatively, put these values in local `.env` (already ignored by Git). This alternative stores the key as plaintext, so prefer the Windows setup command when available:

```dotenv
LLM_MODEL=your-azure-deployment-name
AZURE_API_KEY=enter-only-on-your-laptop
AZURE_API_BASE=https://your-resource.openai.azure.com
AZURE_API_STYLE=v1
```

`LLM_MODEL` is the Azure **deployment name**, not necessarily the underlying model name. The Azure v1 adapter accepts resource-root, `/openai/v1/`, and full Chat Completions URLs, and uses the `api-key` header. The older deployment-specific API is supported with `AZURE_API_STYLE=legacy` and an explicit `AZURE_API_VERSION` from your deployment. Full legacy target URIs with an `api-version` query are also supported. An optional `AI_TOKEN_PARAMETER=max_tokens` supports older compatible deployments; the default is `max_completion_tokens`. A deployment supporting Chat Completions and JSON object output is required. No API-version fallback or automatic paid retry occurs.


For an existing CrewAI-style `LLM_MODEL=openai/your-model`, AgentDock selects the OpenAI-compatible Bearer adapter and strips `openai/` from the request model. The existing `AZURE_API_KEY` and exact `AZURE_API_BASE` can remain paired; the compatible adapter appends `/chat/completions` without inserting an Azure path. An explicit `LLM_PROVIDER` must agree with the prefix. The prefixed compatible default is `max_tokens`; an explicit `AI_TOKEN_PARAMETER` overrides it. Use Settings > Diagnose model connection for a safe, request-free check. HTTP 401 requires verifying the matching endpoint and credential locally; it does not prove the key alone is wrong. Environment Azure keys override the encrypted setup file. Never share keys in chat.

For a non-Azure provider, leave Azure fields empty and use `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL`. Server credential fields are never returned in API responses.

## Budget controls

- AI is off without a complete provider configuration. Merely opening the app or refreshing status makes no model call.
- Every AI request needs explicit consent in the browser and a server-validated `confirm` flag.
- One provider call at a time. No background calls, recursive agent loops, automatic retries, or paid escalation.
- Select context files; source context is limited to 12,000 characters and instructions to 1,500 characters.
- Per-request output is capped by the lower of the server and browser preference.
- Per-account and aggregate daily token allowances are enforced transactionally in SQLite. Default per-account allowance: 12,000; aggregate allowance: 24,000; output cap: 1,200. Configure these in `.env`.
- Input reservations use UTF-8 bytes plus framing overhead and the output maximum. Failed and uncertain calls retain reservations. Successful identical requests are cached within the process/day/account. Do not reset the database to reset budgets.
- These are conservative token reservations, not exact tokenizer counts or a guarantee of a particular currency spend. Also configure Azure quotas and billing alerts.
- Calendar-month caps are also enforced across earlier days in SQLite: default 100,000 per account and 200,000 aggregate. Set `AI_MONTHLY_TOKEN_LIMIT` and `AI_TOTAL_MONTHLY_TOKEN_LIMIT` locally. Month/day boundaries use UTC.
- The owner can pause all new model calls from Settings; the pause persists across restarts. `AI_PAUSED=1` forces a server-side lock which cannot be undone from the UI. Already-sent requests may still complete and be charged.
- Obvious API keys in source are blocked before sending source to an AI provider. Detection is a heuristic, not a complete secrets scanner.

## Python environments and bulk editor tools

New project now includes Python stdlib web, Flask, FastAPI, React + Python Flask, and Python script/CSV starters. Runtime adds environment inspection, AST syntax checks, unittest, pytest, and script execution; Python web snapshots use the existing broker, logs, stop, expiry and recovery controls. The editor adds file search, individual downloads, reviewable renames, Python indentation and config/data text formats.

Rebuild the trusted image before using Python. See [PYTHON_ENVIRONMENTS.md](PYTHON_ENVIRONMENTS.md) for exact setup, dependency pins, export steps, limits and test coverage. No per-project package installation or AI request is performed by these tools.

## Editor file list and program output

Workspace > Code hides known support/configuration files by default. Application source, Python tests and user data stay visible. **Show all files** restores the complete list; searching also finds hidden files. Filtering does not delete or exclude files from saves, builds or exports.

Below the editor, **Run & output** provides Python syntax checks, unittest and **Run Python file** for the selected `.py` file. Tick the execution checkbox before each job. Results include program output/errors, completion status and, on the updated server, exit code and elapsed time. Output can be downloaded or cleared and is marked outdated after source changes. Output is kept in this tab's memory, not saved as project source. Website rendering remains in Preview and JavaScript logs remain in Browser console.

Run Python file executes a temporary script snapshot without changing the saved runtime configuration, so it also works for helper files in a web project. Use `print(...)` to show values; defining a function alone prints nothing. Jobs are noninteractive and output is returned at completion. Start long-running web servers in Runtime. Restart Studio after this update to enable the new selected-file endpoint; the existing trusted Python image does not need rebuilding for this feature.

## Implemented workflows

**Projects:** create, rename, duplicate, import, and back up workspaces. Edit up to 80 text files per project, including nested paths. Source limit: 150 KB per file and 1 MB per project. The workspace, including checkpoint history, has a 12 MB server limit. Saves use optimistic revisions; simultaneous changes in another tab cannot silently overwrite a workspace. The browser keeps a recovery copy.

**Preview:** each server preview is an immutable, one-hour snapshot. HTML/CSS/classic JavaScript and JavaScript modules can load local snapshot files. Code runs in an opaque-origin sandbox, cannot access Studio cookies/storage, and cannot make network/API requests or submit forms. Relative assets must be included in the project. External dependencies are deliberately blocked. Console output and runtime errors are displayed in Studio.

**Checks:** server checks parse JavaScript without executing application code and check HTML metadata, structure, local references, and obvious credentials. Browser checks run DOM assertions and interactions against the actual iframe. Create `agentdock.tests.json`, for example:

```json
{
  "steps": [
    {"action": "exists", "selector": "h1"},
    {"action": "click", "selector": "#start"},
    {"action": "text", "selector": "#start", "contains": "ready"}
  ]
}
```

Supported actions: `exists`, `click`, `text` (`contains`), `input` (`value`), and `wait-text` (`contains`, optional `timeout` up to 5,000 ms). Maximum 30 steps, with a 20-second run deadline. Use `wait-text` for asynchronous UI updates such as API responses. These are functional smoke checks, not a full browser automation suite or security certification. Source can influence its own runtime and test results; do not treat the results as a security boundary.

**UI library:** curated snippets and personal components; license/attribution is required for submissions. Publish deliberately to share with accounts on this local server. Authors and the instance owner can unpublish. Integration shows source before/after and requires approval. It appends markup and CSS; it does not wire arbitrary backend business logic.

**AI roles:** builder, reviewer, and integrator use focused prompts and the same bounded gateway. They propose replacement files, never apply source automatically. Review all changes; approval preserves a rollback checkpoint. Reviewers may return findings without changes. These are specialist request roles, not continuously running autonomous agents.

**Agent application starter:** New project > AI assistant creates a working chat UI, editable `agent.config.json`, functional-check fixtures, and an exportable Node/Azure backend. In Studio the sandbox asks its parent for inference, and the developer must approve each displayed input/instruction pair. Application inference shares the same account/aggregate token ledger and single-flight limit as coding requests. Outside Studio, the exported `server.mjs` runs locally using Azure v1 environment configuration. That small exported example has an in-process allowance and no account system; it is a local starting point, not a public production backend. Static Netlify deployment does not execute it.

**Exports:** full-source ZIP, project JSON, workspace backup, component collections, or source written to a fresh folder under `.agentdock/exports`. Backups can be merged back into the app. Safe-path validation prevents traversal, case collisions, and `.env`/private-key file imports.

**Releases:** immutable snapshots with local capability URLs. Enable/disable them without changing project source. They are local to this server, not internet hosting.

**React builds and Node tests:** an optional Docker driver runs fixed React builds or `node --test` in a separate Linux container. Start Docker Desktop, run `npm run sandbox:prepare` once, then set `AGENTDOCK_ENABLE_BUILDS=1` locally and restart Studio. New project > React + Node creates the supported starter. Runtime > Build React compiles it and makes the compiled files available to Preview, ZIP download, local releases, and explicit Netlify deployment. Source edits invalidate the compiled preview. Node tests are separate, short-lived jobs.

**Live Node backends:** rebuild the trusted image after this update, set `AGENTDOCK_ENABLE_SERVERS=1`, and restart Studio. This is separate from the build opt-in. Runtime > Start current backend executes an explicitly approved source snapshot; the React starter compiles first, then serves its frontend and `/api/health`. View logs, stop the server, or open its iframe from Runtime. Source edits require stopping and approving a fresh snapshot. The React starter's `agentdock.live-tests.json` verifies its backend button and asynchronous response; static previews use `agentdock.tests.json`.

Configure a project's entry with `agentdock.runtime.json`:

```json
{"entry":"server.mjs","port":3000,"build":true}
```

The entry must be an existing `.js`/`.mjs` file; internal port must be 1024–65535. Use `build:false` for plain Node projects. No shell command, npm install, or user lifecycle script is accepted. Limits: one server per account, two per instance, at most 15 minutes (configurable down to one minute with `AGENTDOCK_RUNTIME_LIFETIME_MS`). Temporary app state is discarded at stop/expiry. This runtime does not provide persistent databases or a public deployment.

**Interrupted-session recovery:** new sessions write a small local recovery record before launching. On the next Runtime visit/start after a Studio crash, sessions from a terminated process appear as `interrupted`; their previous preview capabilities are revoked and app code is not restarted automatically. Owners can inspect logs and Stop, then approve a new snapshot. Container runtime and instance labels must match before logs are read or containers removed. Expired recovered sessions are cleaned up after the same ownership checks. If Docker cleanup fails, the record and occupied capacity remain visible as `cleanup-failed`; start Docker and retry Stop. Source staging is deleted only after confirmed removal or confirmation the container no longer exists. An active previous process blocks takeover. Use one Studio process per data directory. Older unjournaled jobs, invalid records and foreign containers are deliberately left for manual inspection. The container supervisor also has an independent expiry timer.

**Runtime diagnostics:** click Runtime > Diagnose runtime, or run `npm run doctor` for infrastructure checks. The report distinguishes a missing Docker CLI, stopped engine, Windows-container engine, missing image, and outdated runtime image. It does not execute project code, pull an image, install packages, send source, or call AI. The CLI deliberately does not load `.env`; the in-app report reflects the running server's actual build/server opt-ins. A passing infrastructure report still requires a real build/test/preview to verify execution.

No container port is published. A bounded HTTP broker reaches only the container's loopback server through Docker exec, with the container network disabled. Only method/path, content type, accept header, and bounded body are forwarded; Studio cookies, authorization headers, platform keys, upstream cookies, and external redirects are excluded. Requests are limited to 64 KB, responses to 1 MB, four concurrent exchanges per session, and five seconds per backend HTTP exchange. WebSockets, streaming responses, external network access, login cookies, and HTML form submissions are not supported. Use relative local assets and fetch calls; HTML root asset URLs and root fetch URLs are scoped to the live preview. Preview URLs are temporary bearer capabilities: anyone who obtains one while Studio is reachable can access that backend snapshot. Keep them private.

The trusted image contains React 19.3.1, React DOM 19.3.1, Vite 8.3.5, Node 24, Linux Python 3.11+, and curated Flask/FastAPI/Uvicorn/pytest packages. Preparing it downloads the base image and packages; individual jobs do not download or install dependencies. Other libraries require rebuilding an audited trusted image. Builds ignore user npm lifecycle scripts and custom Vite configuration and use the image's build entry point. Exported projects still include normal package manifests for use outside Studio.

Jobs use `--pull=never`, no network, non-root UID 1000, a read-only root and source mount, dropped capabilities, no-new-privileges, 512 MB memory/no extra swap, one CPU, 128 PIDs, and a 90-second timeout. Writable paths are size-limited tmpfs; there is no writable host mount or credential/Docker socket mount. Output is bounded to 2 MB of logs/protocol data and 1 MB of validated compiled source. Host staging is cleaned only within the job's generated workspace. These are defense-in-depth container limits, **not certification for hostile public multi-tenant execution**; use only trusted invited testers until the runtime has been reviewed and tested on real infrastructure. Pin an audited image digest and dependency lockfile before a hosted beta.

**GitHub:** optional server-side `GITHUB_TOKEN`, `GITHUB_REPOSITORY=owner/repo`, and `GITHUB_BRANCH`. Requires an existing repository and branch, instance-owner authorization, and explicit target confirmation. Creates a commit preserving other repository files, then updates the branch without force-pushing. A concurrent branch change fails rather than overwriting it. Uploaded files may replace matching repository paths; removed project files are not deleted remotely. No OAuth flow is implemented.

**Netlify:** optional server-side `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`. Requires an existing site, instance-owner authorization, and explicit confirmation. Sends the saved static project as a ZIP to Netlify's deployment API. This may update the configured site's production deployment. A submitted deployment is not reported as ready unless the provider says so; verify status in Netlify. No framework build occurs.

## Verification reports

Open Verification > Verify current source to save static analysis and fixture validation. Reports use a SHA-256 fingerprint of all source files; edits make an older report visibly out of date. From a ready Preview, Run browser checks creates a report and saves matching results. A source/preview mismatch prevents the run; edits during a run retain earlier-source evidence without applying it to current checks. Timeouts leave checks pending. Report creation uses zero AI tokens and does not start containers or deploy.

React build and Node test stages use server-recorded Runtime results for matching source. Older jobs without fingerprints must be rerun. Evidence comes from the newest 100 activity entries; aged-out execution is conservatively shown as unrecorded. Browser results must match all fixture steps, but project code can influence its own results. `checks-passed` describes these checks and is not production or security certification.

Reports are private in SQLite, with 20 retained per project and 100 per account. Select history entries or download report JSON. Complete source and fixture input values are omitted; diagnostic messages may contain short error context, so review before sharing. Workspace/project exports do not include report database records. Export report JSON or back up the private database separately.

## Storage and security

`.agentdock/studio.sqlite` stores salted scrypt password hashes, hashed session tokens, workspaces, components, releases, usage reservations, and activity. Session cookies are HttpOnly and SameSite=Strict. They are local HTTP cookies because this edition only listens on loopback. Mutations require same-origin JSON requests. No raw password or API key is included in activity logs or exports.

Keep `.agentdock/` and `.env` private. Back up the database while the server is stopped, including any SQLite WAL files if present. Encrypted Azure credentials are tied to the Windows account and are not portable to another machine. Source-code export does not export credentials or accounts. The app intentionally does not display stored secret values.

## What this does not yet do

This is a substantial local development platform, **not the full production cloud IDE** originally described. It does not install arbitrary per-project libraries, provide persistent Node/Python services or Jupyter notebooks, build Next.js applications, provide cloud terminals, accept payments, offer password recovery, or provide managed public multi-user hosting. The optional curated Docker driver supports React builds, Node/Python tests, Python scripts, and temporary Node/Python HTTP previews; it needs a functioning Docker engine and prepared image. Do not expose this loopback-oriented server publicly without a production deployment design, HTTPS/session changes, abuse controls, review, and operational testing.

## Verify

For the current phased roadmap, read PHASES.md. Phase 1 evidence is in PHASE1_REPORT.md. The explicit `npm run test:runtime-live` command runs two real Docker acceptance checks in a dedicated test directory: real 60-second expiry and recovery after an abrupt subprocess exit. It saves outputs/phase1-live-runtime-results.txt, never loads .env, makes no model calls and leaves the main Studio process running. These longer opt-in checks are separate from npm test.


```sh
npm test
npm run check
npm run doctor
npm run preview:build
```

Automated tests use injected provider transports; no live Azure, GitHub, or Netlify credentials are used. Browser QA is recorded below; real provider compatibility and real Docker execution still need live verification. See `VERIFICATION.md` for actual results and limitations.

Live browser QA has now been performed against a separate local test instance. See `BROWSER_QA.md` for the exact workflows verified and issues corrected. `node scripts/qa-server.mjs` starts that instance at `http://localhost:4199` with dummy credentials and all paid/external integrations disabled. Use `localhost` for QA and `127.0.0.1` for the main workspace to keep host-scoped session cookies separate. Do not place personal projects in the QA instance.

## Code map

For the shortest launch/recovery instructions and a future development handoff, read `CONTINUE_HERE.md`. Run `npm run backup:source` for a portable archive of the application code with real credentials and runtime data excluded.

| Location | Purpose |
| --- | --- |
| `server.mjs` | HTTP application, authentication gates, project APIs |
| `lib/store.mjs` | SQLite accounts, sessions, revisions, community, usage |
| `lib/agents.mjs` | Bounded AI proposals and JavaScript parsing |
| `lib/provider.mjs` | Azure/OpenAI endpoint and authentication adapters |
| `lib/preview.mjs` | Isolated snapshots, console bridge, browser checks |
| `lib/integrations.mjs` | GitHub commits and Netlify deployment adapter |
| `lib/zip.mjs` | Dependency-free ZIP export |
| `lib/sandbox.mjs`, `sandbox/` | Optional bounded React/Node container jobs and trusted image |
| `lib/runtime.mjs` | Temporary Node server lifecycle, limits, and HTTP broker |
| `lib/runtime-state.mjs`, `lib/runtime-diagnostics.mjs` | Recovery records, ownership checks, and read-only infrastructure checks |
| `dist/studio.mjs` | Complete frontend application |
| `dist/core.mjs` | Shared validation, components, deterministic changes |
| `scripts/` | Launch, hidden-key setup, credential protection, verification |
| `tests/` | In-process API, isolation, budgets, and integration tests |

### OpenAI-compatible variable names

Use `OPENAI_MODEL=openai/gpt-4.1-mini` (also accepts `gpt-4.1-mini`) and `OPENAI_ENDPOINT` with your exact base URL. These explicit names take precedence over legacy model/base settings. Use `OPENAI_API_KEY` or retain the existing encrypted credential. Startup no longer overwrites an explicit model with saved metadata or loads saved credentials when an OpenAI key is already configured. The UI preserves the configured `openai/` identifier. As in OpenAI-compatible routing frameworks, the HTTP request model is `gpt-4.1-mini`; no `azure/` prefix or Azure-specific path is added. An empty endpoint is not a new endpoint: existing paired configuration remains the fallback. Restart after configuration or server changes.
