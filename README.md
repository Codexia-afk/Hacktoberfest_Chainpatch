# ChainPatch

**Inspect the update. Protect the workflow.**

ChainPatch is a local, full-stack security workbench for reviewing AI agent skill updates in context. An agent skill is a `SKILL.md` instruction package that teaches an agent a task. A safe-looking update can create an unsafe interaction with another installed skill.

The working demo shows Report Reader forwarding a private fictional incident document to Public Publisher after an instruction update. A narrow input rule blocks that document while still letting an approved summary publish.

## Quick start

Use Node.js **22.13 or newer** (Node's built-in SQLite API is required).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open [ChainPatch locally](http://127.0.0.1:3000). Click **Run the interactive demo**. A model is optional for the seeded demo. The default server binds to loopback.

```sh
npm test             # engine, model-adapter, persistence tests
npm run typecheck
npm run build
npm start            # production server, after build
```

The production build uses Next.js standalone output, disables framework
fingerprinting, and sends baseline browser security headers. A lightweight
health check is available at `/api/health`. The local SQLite file lives under
`.data/` by default and should be stored on a persistent volume when deployed.

### Container deployment

The multi-stage `Dockerfile` runs the typecheck, tests, and production build in
a locked dependency stage, then copies only the standalone runtime into a
non-root image. Build and run it with:

```sh
docker build -t chainpatch .
docker run --rm -p 3000:3000 -v chainpatch-data:/app/data chainpatch
```

The container intentionally listens on `0.0.0.0`; put it behind TLS and an
access-controlled reverse proxy before exposing it beyond a trusted network.
The default local server remains loopback-only. GitHub Actions runs the same
locked install, typecheck, unit/persistence tests, standalone build, and
critical Chromium workflows on every push and pull request.

## The experience

### Judge presentation and hands-on lab

Open `/playground` from **Judge presentation** in the sidebar. Click **Run full presentation** to execute and save all four scenarios, then automatically advance through their results every five seconds. Pause or select any stage to inspect its input, policy decision, destination, and action trace.

Judges can enter their own fictional private report and approved public summary, edit all three skill instruction inputs, and choose a narrow rule, disabled publishing, or required approval. The local keyword analyzer interprets the supplied instructions; unsupported patterns are explicitly labelled. Document classifications are assigned by their input fields, and the summary is supplied by the user, not generated or redacted. Each submission creates a separate saved review with the supplied documents, so later replays and evidence exports retain those inputs. Edited drafts are marked until rerun.

Both `http://localhost:3000` and `http://127.0.0.1:3000` work: mutation checks compare the browser origin to the actual request Host, even when Next normalizes its internal request URL. Other origins, ports, and protocols remain rejected.

- **Landing:** a concise explanation and interaction preview.
- **Workspace:** persisted reviews, search, investigation and verified-repair filters.
- **Update review:** line-level current/proposed comparison and companion skill instructions.
- **Interaction map:** selectable nodes and the source handoff with instruction/evidence details. On mobile, the chain becomes vertical.
- **Replay:** before, after, and fixed configurations; unsafe probe or legitimate task; input documents, action decisions, policy snapshots, destination state.
- **Patch Lab:** editable validated JSON policy; approved-summary allowlist, approval-required, or publication-disabled policies; both paths rerun when applied.
- **Evidence:** replay ledger plus JSON, Markdown, local Solana memo, and Snowflake SQL downloads.
- **Create review:** paste current and proposed skill content plus companion skills; server-side validation, model analysis or labelled local fallback, SQLite persistence.
- **Live Gemma:** an optional streaming prompt console with starter commands, recent conversation context, cancellation, and retry. Requires the configured Ollama model; it never substitutes sample answers.
- **Settings and documentation:** live model check, configuration, architecture, and limitations.

GitHub import is intentionally omitted; the required paste workflow is complete. Arbitrary uploaded code is never executed.

## Configure Gemma locally

Install [Ollama](https://ollama.com) and pull [Gemma 3 4B](https://ollama.com/library/gemma3).

```sh
ollama pull gemma3:4b
ollama serve
```

If the Ollama desktop application already runs the server, a second `ollama serve` is unnecessary.

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma3:4b
# Optional; defaults to .data/chainpatch.sqlite
CHAINPATCH_DB=.data/chainpatch.sqlite
```

Restart ChainPatch after changing environment variables. Check **Settings → Check connection**. New reviews attempt a model analysis. Existing reviews can use **Skill diff → Analyze with configured Gemma**. Reanalysis clears obsolete replays because the interpreted scenario may change, while preserving the applied rule.

The adapter sends the supplied skill instructions to Ollama's `/api/chat` endpoint, asks Gemma to interpret before/after private-source transfer and public publishing capabilities, and request exact quotes plus a narrow repair explanation. Zod validates the JSON schema. Every affirmative capability must include a verbatim supporting quote from its respective input. Valid Gemma hypotheses determine which source handoff is selected by the simulator. Policy decisions and destination writes remain deterministic.

The adapter has a 20-second timeout. Invalid JSON, unmatched evidence quotations, HTTP failures, and unavailable Gemma fall back explicitly:

- Seeded review: **curated sample analysis**.
- Custom review: **local keyword analysis**.

The UI and exports preserve the origin, model, warning, and explanation. Connection status is separate from result provenance: an installed model is not proof that a review used it. The current adapter is fixed to this report/publisher pattern; it does not execute arbitrary model-produced tools.

### Live Gemma prompt console

After connecting Ollama, open `/gemma` from **Live Gemma** in the sidebar.
Choose a starter command or type your own prompt, then click **Send to Gemma**
(or press Ctrl/⌘ + Enter). The answer streams from the configured model;
**Stop generating** cancels the request and restores the prompt for editing or
retry. **Clear** removes the on-screen conversation. Failed or incomplete
answers are discarded without losing earlier completed turns.

Prompts are limited to 4,000 characters. Only the most recent complete
user/assistant pairs that fit within 12 messages and 8,000 characters are sent
as context. Responses are limited to 16,000 characters with a 60-second deadline.
The transcript is not saved and is cleared when leaving or reloading the page.

This console sends text to Ollama's `/api/chat`; it does not execute commands,
read files, call tools, or produce verified replay evidence. If Ollama or Gemma
is unavailable, it displays an error instead of inventing an answer. The
interactive demo and judge presentation remain usable without a model.

## Architecture

```text
app/                    Next.js routes and responsive interface
app/api/reviews/        create/list/read, replay, patch, reset, analysis, exports
app/api/model/          local Ollama model availability
components/             reusable shell, interaction map, review workbench
lib/types.ts            Zod schemas and typed skills/documents/policies/evidence
lib/engine.ts           bounded parser, deterministic simulation, report generation
lib/model.ts            Gemma adapter, schema and evidence validation, fallback
lib/gemma-chat.ts       bounded conversation context and streaming JSON parser
app/api/gemma/          validated, cancellable live Ollama chat proxy
lib/store.ts            SQLite persistence and atomic review updates
lib/seed.ts             fictional SKILL.md versions and publisher instructions
lib/track-integrations.ts local-only Solana memo and Snowflake SQL artifacts
tests/                  behavior-focused engine, adapter, storage, and artifact tests
```

The database is created lazily at `.data/chainpatch.sqlite` using `node:sqlite`. WAL mode and transactions protect update operations. Seed initialization is idempotent. Each review retains its latest 60 replay records; each record includes the policy snapshot and full simulated inputs/destination. Navigation and refresh read saved server state. Exports serialize the same review objects used by the engine.

Saved reviews are validated and stored in a versioned envelope, separate from the export schema. Existing unversioned records migrate in memory when read and are written in the current format only on an explicit save. Instructions, replay evidence, and additional record fields are preserved. Legacy records missing structural support metadata require reanalysis before verification; corrupt records and unknown future versions are rejected without overwriting their data. Workspace and review-detail verification both require passing evidence for the currently applied policy.

`npm run test:e2e` builds an isolated production copy with the project's Next.js configuration, then runs the standalone server with its public and static assets. Browser tests cover desktop/mobile workflows, security headers, assets, verification after a policy change, and the Gemma console. Chat browser tests exercise real offline API handling plus explicitly mocked answers, history, retry, cancellation, and transient chat state; they do not claim live model inference. The developer's `.data` and `.next` are untouched. Set `CHAINPATCH_E2E_MODE=development` to use the previous isolated development-server workflow.

## Deterministic demonstration

| Scenario | Selected input at publisher | Policy | Destination |
| --- | --- | --- | --- |
| Before Update | Approved summary | Baseline trusted-skill rule | Summary only |
| After Update, source probe | Private source | Baseline trusted-skill rule | Private document exposed |
| After Fix, source probe | Private source | Approved summaries only | Empty; blocked |
| After Fix, normal task | Approved summary | Approved summaries only | Summary only |
| Disable publication | Either | Disable | Both blocked; legitimate test fails |
| Require approval | Either | Approval required | Both held; legitimate test fails |

The fixed probe and normal task must both satisfy their respective conditions before the review is marked verified. Editing the JSON to permit private sources correctly fails the attack test.

## Safety and evidence limits

- **Gemma suggested the risk** is a hypothesis, not a security proof. Matching a supporting quote validates provenance, not its semantic interpretation.
- **The simulator exercised a path** means a chosen report/publisher scenario was run with fixtures, not that a real agent followed the text or that every possible route was explored.
- **The policy blocked an action** means the deterministic policy rejected that particular typed document at the publisher boundary.
- Documents, recovery phrases, names, and `status.lumen.example` are fictional. Simulation never reads real files/secrets or writes to an external destination.
- The pre-approved summary is a fixed fixture. There is no claim of automatic sanitization or reliable DLP classification. Input labels are trusted fixture metadata; real deployments would require trustworthy labeling and tool-side enforcement.
- Local keyword analysis can miss paraphrases, implicit behavior, and subtle negation. Reviews outside the private-report/summary/publisher pattern are marked unsupported for simulation, not safe.
- This is a **single-user local prototype**, without authentication, tenant isolation, or a production policy gateway. Keep it on loopback; do not expose it publicly as a multi-user service.
- Instructions are sent to the configured model endpoint for analysis. Keep that endpoint local for a local-only workflow. No credentials are included or required.
- External Google Fonts are used for display/interface typography with system fallbacks. No functionality depends on them.

## 90-second judge script

The demo review includes a **Live walkthrough** with four numbered buttons. Each button calls the working server to replay a scenario or apply a policy; results and saved-run counts come from persisted evidence. Run steps 1–4 to show the safe baseline, unsafe update, narrow repair, and successful summary after repair. Use **Try blocking everything** to let a judge challenge the rule, then rerun step 3 to restore it. **Reset demo** clears the policy and replay history for the next presentation. The walkthrough works without Ollama; analysis provenance remains labelled separately from live simulator execution.

**0–15 sec:** Open the landing page and run the interactive demo. “A skill is instructions for an agent. These two skills normally summarize a report and publish the summary.” Run **Before Update** and show the approved summary at the destination.

**15–35 sec:** Open **Skill diff**. “The update adds permission to pass the original private source.” Select **After Update**. Show the new route and private document at the local public destination. Expand the publisher event to inspect its baseline rule.

**35–65 sec:** Open **Patch Lab**. Apply **Allow approved summaries only**. “We restrict the publisher's input rather than disabling its job.” Show attack PASS and legitimate task PASS. Optionally apply **Disable publication** to demonstrate why blocking everything fails.

**65–90 sec:** Restore the narrow rule, inspect **After Fix**, and export **Evidence report**. The JSON/Markdown report also offers clearly labelled local-only Solana memo and Snowflake SQL artifacts. “These are saved simulated observations, with explicit model provenance and limitations.”

## Track-ready, without overclaiming

The Evidence report also offers small, local-first artifacts for common hackathon tracks:

- **Solana:** a SHA-256 evidence digest formatted as an SPL Memo-compatible payload. It is marked `not-submitted`; no wallet, RPC call, transaction, or on-chain write is performed.
- **Snowflake:** a downloadable SQL script that creates a replay-event table and inserts the saved trace using `PARSE_JSON`. It is generated locally and is not uploaded to Snowflake.
- **GitHub Copilot:** repository guidance lives in `.github/copilot-instructions.md`, so Copilot can work within the same safety and evidence rules. The app does not claim Copilot generated code.
- **OWASP:** the demo models excessive agency and inter-skill data exposure, related to [LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/). It is not an OWASP certification or comprehensive assessment.
- **Google Gemma:** the optional local open-weight model interprets natural-language skill changes and proposes a supported route and repair; deterministic enforcement remains separate.

These artifacts improve portability and judging clarity; they do not substitute for a track's published requirement to use a live service or SDK. Application, engine, fixtures, adapters, and tests are available under MIT. Gemma model weights have separate license terms. No award or category qualification is guaranteed.

## License

MIT; see [LICENSE](LICENSE). Third-party dependencies and model weights retain their own licenses.
