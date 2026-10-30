# Phase 2 - model verification

Status: COMPLETE. Wait for the user to say Continue before Phase 3.

Verified on 30 October 2026 after synchronizing the working-project credential into Windows account encryption. The configured model is openai/gpt-4.1-mini with the OpenAI-compatible Bearer adapter.

- One approved live request: index.html only (271 source characters), 256 output-token cap. Successful proposal; provider-reported usage 390 tokens, conservative reservation 2098.
- Reviewed before/after: only the H1 changed from Hello, builder. to Phase 2 verified. Rejected the first proposal; preview and source stayed unchanged.
- Repeated identical request with fresh consent: cache hit, zero new reservation/provider tokens, no second upstream started record. Approved cached proposal; preview showed Phase 2 verified and one checkpoint was created.
- Seven code checks and one browser check passed; source-bound verification report saved. Durable Activity records confirmed the request, usage, rejection and application.
- Daily/monthly reservation total 8392 includes the three earlier failed requests (6294). This total is not a confirmed bill.
- Output preference restored to its original 1200. No automatic retries were added. Credentials stayed private and encrypted.
- Full available suite: 129 passed, zero failures. Three pre-existing host socket cases remain excluded in this assistant environment; see outputs/phase2-automated-test-results.txt. Previous syntax validation passed 61 modules.

Evidence screenshot: outputs/phase2-model-verified.jpg. Source backup: outputs/agentdock-source.zip; actual credentials and runtime data excluded.

## Historical investigation

# Phase 2 — model verification

Status: in progress. Do not advance to Phase 3.

One approved live request, capped at 256 output tokens and limited to the 271-character QA index.html, returned HTTP 401. No changes were applied and no retry occurred. Activity recorded a conservative reservation of 2098 tokens; this is not a confirmed provider charge. Missing-consent blocking was also verified in the actual UI.

The user supplied a previously working CrewAI LLM factory using model=LLM_MODEL, api_key=AZURE_API_KEY and base_url=AZURE_API_BASE. The configured model is openai/gpt-4.1-mini. The old adapter inferred Azure mode from variable names, adding an Azure path and api-key header. The corrected adapter honors the openai/ routing prefix, strips it from the wire model, uses Bearer authentication, and retains the paired Azure-named base URL and credential. Unused AI_BASE_URL settings cannot redirect an Azure-named key. Explicit AI_TOKEN_PARAMETER remains respected; otherwise prefixed OpenAI uses max_tokens. No credential values were read into tool output or changed.

Additional fixes: owner-only read-only provider diagnostics, sanitized upstream/network errors, a 1 MB provider response limit, reservation metadata on failures, refreshed visible accounting after failed requests, separate provider-reported token counts and conservative reservations, and account-scoped persistent request outcomes. No automatic paid retries are enabled.

Targeted tests: 24 passed. Full available-suite results: outputs/phase2-automated-test-results.txt. Three pre-existing host socket tests remain excluded in this assistant environment.

Next: restart Studio with Ctrl+C then npm start and refresh the browser. No Docker rebuild or key change is required. Recheck the QA request with the corrected adapter; verify proposal rejection, cached replay without another provider call, approval and checkpoint behavior, and updated usage accounting. Restore the previous preferred output cap of 1200 after testing (currently temporarily 256). Phase 2 is not complete until the live provider success is observed.

References: https://docs.litellm.ai/docs/providers/openai_compatible and https://docs.crewai.com/en/concepts/llms .

## Restart verification - 30 October 2026

The user restarted Studio. Browser diagnostics confirmed the openai adapter, Bearer authentication and the configured Azure AI Services host. One explicitly approved request with only index.html and a 256-token output cap again returned HTTP 401. No retry, proposal or source change occurred. The new failure panel correctly showed the retained 2098-token reservation and refreshed the daily total to 4196. These are conservative reservations, not confirmed billed usage. Screenshot: outputs/phase2-authentication-result.jpg.

The original output preference of 1200 was restored and saved. Phase 2 remains blocked on local verification of the exact model/base/key combination. Do not send another request until configuration has been verified; do not advance to Phase 3. The user should compare the exact base URL and model with the working CrewAI configuration and enter any corrected key locally only. Environment Azure keys take precedence over the encrypted setup file; rerunning configure:azure alone does not override such a key. Live success, rejection/cache/approval and actual provider usage remain unverified.

## Integration investigation - 30 October 2026

No inference request was made during this investigation. The encrypted credential unlocked successfully; safe boolean checks found no outer whitespace, line breaks, literal quotes, Bearer prefix or non-ASCII characters. The configured endpoint path is /openai/v1 and model is openai/gpt-4.1-mini. No credential values were printed or changed.

A network-free capture using the installed official Python OpenAI SDK produced /openai/v1/chat/completions, Bearer authentication, normalized gpt-4.1-mini and max_tokens, matching the corrected adapter routing. The supplied CrewAI example additionally sets temperature=0.3; AgentDock currently omits temperature. This difference does not establish the cause of an authentication rejection.

Two deliberate read-only GET /models probes (no generation) returned HTTP 401: one with Bearer and one with api-key authentication. The latter response matched a fixed safe classification for provider key/endpoint rejection; raw bodies were not logged. An independent official Python SDK read-only models request could not connect in this process environment, so no SDK live parity claim is made. A models-list failure alone does not establish the result of Chat Completions. The previously observed Chat Completions 401 remains the live inference evidence. No authentication fallback or automatic retry was added to the application.

Next useful input: the local folder/file of the working CrewAI application, to compare its actual configuration loading and request construction privately. The factory snippet alone cannot establish that the running applications receive identical configuration. The user permits alternative frameworks including LangGraph; framework migration is not necessary to diagnose this HTTP failure and no migration was made. Phase 2 remains in progress, Phase 3 has not started.

## OpenAI aliases correction

Added OPENAI_MODEL and OPENAI_ENDPOINT support following the user clarification. OPENAI_MODEL=gpt-4.1-mini canonicalizes to openai/gpt-4.1-mini; the UI now preserves this routing identifier. The compatible HTTP model remains gpt-4.1-mini and the exact configured base receives only /chat/completions. No Azure adapter/path is selected for these aliases. Explicit OpenAI configuration takes precedence over legacy saved model metadata. Startup skips encrypted Azure configuration when an OpenAI key is already set. Existing keys and endpoint values were not changed, and no live inference call was made. Restart required before browser verification. Phase 2 remains incomplete; this change does not establish that HTTP 401 is resolved.

## Latest restart verification

The restarted browser confirmed configured model openai/gpt-4.1-mini, openai adapter and Bearer authentication. One approved request (only the 271-character index.html, output cap 256) returned HTTP 401 again. No retry, proposal or source change. Daily/monthly conservative reservation now 6294, not confirmed billed tokens. Restored output preference to 1200. Evidence: outputs/phase2-openai-restart-result.jpg. Stop further identical paid probes. Next required input is the working CrewAI project path for private comparison of actual configuration loading. Phase 2 remains blocked; Phase 3 has not started.

## Working-project comparison and credential synchronization

Inspected the user-provided Test project privately. Its make_llm uses LLM_MODEL, AZURE_API_BASE and AZURE_API_KEY with required_env stripping whitespace. Model and endpoint match AgentDock; the working-project key differs from the previously saved AgentDock key. Copied the working key directly into Windows DPAPI encryption without displaying it. Preserved previous encrypted configuration under .agentdock/azure.credentials.before-project-sync.json. No source project files or model/base settings changed. Running Studio still holds its old credential in memory and must restart. No generation request was made. Phase 2 remains pending actual successful proposal, review/cache/approval checks.
