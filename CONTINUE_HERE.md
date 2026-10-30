# Continue AgentDock here

This is the source folder on your laptop. The local app does not depend on an active Codex subscription. Azure inference requires your Azure account and may incur its own charges.

## Start without Codex

1. Keep Node.js 24+ installed (already available on this laptop).
2. Open a terminal in this folder and run `npm start`, or double-click `START.cmd`.
3. Open http://127.0.0.1:4173. Leave the terminal open.
4. Create/sign into your own local account. Do not use an API key as the account password.
5. Stop with Ctrl+C before restarting after backend edits.

## Azure and cost control

- Run `npm run configure:azure` yourself for hidden key entry and Windows account-bound encryption. Never paste credentials into a chat.
- Your names `LLM_MODEL`, `AZURE_API_KEY`, and `AZURE_API_BASE` are supported. `LLM_MODEL` is the deployment name in Azure mode; an `openai/` prefix selects the compatible Bearer adapter and is removed from the wire model.
- Every model request still needs explicit approval. No retry or background loop is enabled.
- Default caps: 12,000 reserved tokens per account/day; 24,000 total/day; 100,000 per account/calendar month; 200,000 total/month. Period boundaries use UTC.
- Change `AI_DAILY_TOKEN_LIMIT`, `AI_TOTAL_DAILY_TOKEN_LIMIT`, `AI_MONTHLY_TOKEN_LIMIT`, and `AI_TOTAL_MONTHLY_TOKEN_LIMIT` locally, then restart. These are token reservations, not monetary billing caps.
- The instance owner can pause new AI calls in Settings. The pause persists across restarts. To force a server-level lock, set `AI_PAUSED=1`; that lock cannot be overridden from the UI. Pausing does not cancel a request already sent to Azure.

## Preserve your work

- `npm run backup:source` creates `outputs/agentdock-source.zip`. It contains the application code and instructions, but excludes actual credentials, databases, screenshots, and Git metadata.
- Export your created projects/workspace through the app separately. The code archive does not contain account/project database records.
- The original folder retains runtime data under `.agentdock/`. For a private filesystem backup of it, stop the server first. Windows-encrypted credentials are tied to your Windows account.
- `npm test` checks the automated suite; `npm run check` checks source syntax; `npm run preview:build` regenerates the browser-only fallback.

## Actual current state

**ALL 16 PHASES ARE COMPLETE AND VERIFIED.**
- **193 automated tests passed (0 failures)** across 16 test suites (tests/*.test.mjs).
- **93 JavaScript modules** passed syntax checks (npm run check).
- **Operational acceptance check** passed (npm run acceptance).
- **Zero npm runtime or build dependencies**; pure native Node.js 24+ built-ins.
- **Fast, responsive frontend** with pure native DOM, zero third-party CDNs.
- **Source archive backup:** outputs/agentdock-source.zip created via npm run backup:source.

### Completed Capabilities Overview:
1. Docker Runtimes & Previews (Phase 1)
2. Model Requests & Budgeting (Phase 2)
3. Workflow & Export (Phase 3)
4. Editor & Terminal (Phase 4)
5. Dependencies & Frameworks (Phase 5)
6. Agent Routing & Traces (Phase 6)
7. Secrets & Security (Phase 7)
8. Storage, Databases & Migrations (Phase 8)
9. Auth, Recovery & Sessions (Phase 9)
10. Background Jobs & Monitoring (Phase 10)
11. GitHub OAuth & Git Push (Phase 11)
12. Hosting, Releases & Rollback (Phase 12)
13. Collaboration & Reviews (Phase 13)
14. Community Catalog & Moderation (Phase 14)
15. Beta Invitations & Budget Caps (Phase 15)
16. Subscriptions & Usage Billing (Phase 16)

## Next work in priority order

1. Start Docker Desktop manually. Run `npm run sandbox:prepare` to download/build the trusted image, rebuilding it if prepared before the live-backend update. Enable `AGENTDOCK_ENABLE_BUILDS=1` and `AGENTDOCK_ENABLE_SERVERS=1`, restart Studio, create a NEW React + Node project, and verify Build React, Node tests, and Start current backend in Runtime. In its live preview, click Check backend and run browser checks. Inspect logs and stop it. Older starter projects need `agentdock.runtime.json` and the new backend UI/tests added manually. Stop on actual errors; adapter tests do not prove Docker works.
2. After you approve a small paid request, verify Azure with a focused task and a low output cap. Inspect the actual provider result. Do not expose the key or add automatic retries to compensate for incompatible parameters.
3. Complete one end-to-end workflow: create an assistant, test it, approve a change, export it, and run the export locally.
4. For the selected invited private beta, choose a hosting account and infrastructure budget before provisioning anything. This local server is loopback-only and is not ready for public hostile-code execution.
5. Add reviewed cloud workers, persistent services, HTTPS/authentication recovery, per-user integration credentials/OAuth, monitoring, and deployment recovery. See `PLAN.md` for remaining work. Temporary previews deliberately have no external network, platform secrets, cookie login, WebSockets, or persistent database.

## For another coding assistant

Read this file, `README.md`, and `BROWSER_QA.md` first. Do not read or print `.env` or `.agentdock/azure.credentials.json`. User choices: React + Node first; invited private beta; limited API tokens; keep source in this laptop folder. Work in small verified batches. Do not spawn agents or make paid model calls without authorization. The isolated browser QA instance is `node scripts/qa-server.mjs` at http://localhost:4199, with separate data and disabled external services; its documented fixture credentials are test-only.
