# EDU BOT — Autonomous AI Education Workforce

EDU BOT is a Melsoft Academy Hackathon project created by **Elias Dzonzie**. It coordinates a protected team of specialist AI agents that can plan academic work, analyse uploaded documents, generate downloadable deliverables, check one another's work and stop for human approval before consequential actions.

This repository contains the independent hackathon build. It does not include local databases, session cookies, API keys, uploaded files, generated artifacts or runtime logs. It remains a demonstration build—not a production learning-management or student-record system. Use fictional data only.

The protected workforce is CHIEF plus Academic Operations, Student Records, Curriculum & Lesson Planning, Student Communications, Academic Research, Student Support & Tutoring, Academic Reporting & Analytics, Technology & Integrations, Assessment & Grading, and Academic Quality Assurance. Legacy business-role identities are archived during an idempotent migration so their historical work is not relabelled.

## Start

Requires Node.js 24 or newer and a Gemini API key for hosted chat and agent work. From this directory:

```powershell
npm run dev
```

The development server reloads automatically when server code changes, so newly added controls and their API routes stay in sync. This independent copy uses local port 3005.

Open `http://localhost:3005` and create a local workspace. The copy stores its SQLite database at `data/build-bot-colleague-zero.sqlite`; this path is excluded from Git. `COLLEAGUE_ZERO_DB` may select a different path only when it stays inside this project directory. Set `COLLEAGUE_ZERO_PORT` to override the port. Public research needs access to Wikipedia. For offline UI/testing only, set `COLLEAGUE_ZERO_RESEARCH_FIXTURE=1`; fixture results are visibly labeled and are not factual research.

For the academic demonstration, open **Workforce**, activate the academic team, then open **Missions**. Upload the fictional files in `fixtures/education`: ten assignments as Assignment files, `rubric.json` as the Rubric, and `demo_gradebook.csv` as the Fictional roster. The assessment template runs persisted specialist tasks, deterministic QA, a versioned correction, an exact lecturer approval, a local mock gradebook write/read-back, and a downloadable class report. The mock provider is deliberately labelled and is not a claim of live Google Sheets verification.

Double-click `Open BUILD BOT 2.0.cmd` in this folder to start, verify, and open the independent copy on port 3005.

## Per-bot Linux computers

Every bot receives a tenant-scoped computer record. The development provider uses a separate hardened Docker container and named persistent home volume per bot. Containers stay stopped while idle; browser profiles and files remain on their volumes. The right context pane can start, pause, resume, stop, reset and open the bot's proxied noVNC view. Exclusive leases prevent simultaneous automation and owner control.

This PC must first have WSL 2 and Docker Desktop running. Then build the runtime image:

```powershell
npm run computer:doctor
npm run computer:build
npm run dev
```

See `docs/COMPUTER_RUNTIME.md` for installation, isolation, credential and production Kubernetes guidance. The full AI-provider key is never injected into a bot container.

The backend also includes a bounded Gemini tool loop, exact-action browser approvals, one-time in-memory credential leases, durable Gemini Batch adapters, a scoped Google Sheets adapter, a PostgreSQL RLS schema baseline, Kubernetes isolation templates, rate limits and manifest-backed backups. These foundations are documented in `docs/PRODUCTION_BACKEND.md`; they do not mean external credentials, WSL, PostgreSQL or Kubernetes are already live.

## External platform connections

Settings now includes a governed Google Workspace connector alongside Remote MCP, Composio and Zapier. Google OAuth tokens are encrypted locally, external tools are denied by default, and consequential actions pause for exact approval with evidence receipts. See `docs/EXTERNAL_PLATFORM_CONNECTIONS.md` for Google Cloud setup and the permission model.

## Hosted AI setup

Gemini is the default provider. Provider selection does not change or rebuild the bot computer image.

### Gemini 3.1 Flash-Lite

1. Create a Gemini API key in Google AI Studio and enable billing or credits. Never paste the key into the browser, a bot chat, or a bot's Linux computer.
2. In the same PowerShell window that will run BUILD BOT, set the provider and key without printing the key:

   ```powershell
   $env:COLLEAGUE_ZERO_AI_PROVIDER = 'gemini'
   $buildBotGeminiKey = Read-Host 'Gemini API key' -AsSecureString
   $env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new('', $buildBotGeminiKey).Password
   npm run dev
   ```

3. Everyday chat and reasoning use `gemini-3.1-flash-lite`. Optional overrides are `COLLEAGUE_ZERO_GEMINI_EVERYDAY_MODEL` and `COLLEAGUE_ZERO_GEMINI_REASONING_MODEL`. Native voice uses `gemini-3.8-live`; multimodal analysis uses `gemini-3.1-flash-lite`.
4. Open `http://localhost:3005`, activate a bot, and send a message. `http://localhost:3005/api/health` should report `"ai":"gemini"` and `"aiConfigured":true` without exposing the key.

Live Inbox chat uses Gemini's API. The backend also contains a durable Gemini Batch queue for explicitly queued non-interactive work. This alpha should use fictional data only.

## Expansion runtime

The Astra expansion pack is implemented as additive, tenant-scoped SQLite modules and authenticated APIs. It adds governed remote MCP execution with deferred discovery, exact-action approvals, receipts and connector budgets; sourced/reviewable memory; twelve protected academic skills plus versioning/import/export/recording drafts; cited document collections with PDF/DOCX/PPTX/XLSX/CSV/TXT/JSON extraction; dependency-aware Gemini mission branches; Gemini Live voice with short-lived tokens; tenant-scoped multimodal analysis; and usage ledgers/budgets.

Without `GEMINI_API_KEY`, local memory, skills, collections, MCP governance and mission-graph preparation still work. Gemini text, real mission branch content, voice and multimodal analysis report `awaiting_credentials` or a clear configuration error. The microphone button never asks for or exposes the API key. See `docs/EXPANSION_IMPLEMENTATION_STATUS.md` for exact boundaries and remaining production work.

### OpenAI

1. Create an OpenAI API project, enable billing/credits, create a project API key, and set project spending limits. Do not paste the key into the browser or commit it to this repository.
2. In the same PowerShell window that will run BUILD BOT, set the key without printing it:

   ```powershell
   $buildBotKey = Read-Host 'OpenAI API key' -AsSecureString
   $env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $buildBotKey).Password
   ```

3. Optional model overrides are `COLLEAGUE_ZERO_OPENAI_EVERYDAY_MODEL` and `COLLEAGUE_ZERO_OPENAI_REASONING_MODEL`. The defaults are `gpt-6-luna` for ordinary chat and `gpt-6.1-sol` for reasoning; access depends on the models enabled for the OpenAI project.
4. Run `npm run dev` in that same window and open `http://localhost:3005`. Activate a bot in AI Workforce, then send any message in the Inbox. The UI shows no API key, model selector, or internal routing names.

For current events, prices, news, and general live web search, obtain a Brave Search API key and set `COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY` **in this copy's server environment only** before starting it. In PowerShell, `$env:COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY = Read-Host 'Brave Search API key'` sets it for the current terminal session. This is a search service, not a cloud LLM; live search queries leave your computer. Without the key, fresh search requests fail clearly rather than getting a guessed answer. A specific public HTTPS page URL can be browsed without the search key. Native X search is not connected; for X requests, web search looks for indexed public X pages and labels that limitation.

The server routes casual conversation to the selected provider's everyday model and coding, math, analysis, planning, tool-oriented, multi-step, or time-sensitive requests to its reasoning model through a Responses-compatible API. The internal mapping and prompts are in `apps/api/chat.mjs`; freshness detection and constrained web/page tools are in `apps/api/live-tools.mjs`. The AI API key stays in the server process and is never returned to browser state, included in model input, or injected into a bot computer. Fresh web tools contact outside sites only when needed. Inference is serialized to keep rate-limit and spending behavior predictable. If the provider, configured model, billing, or required live search is unavailable, chat returns an explicit error rather than a fabricated bot reply. Web browsing blocks obvious private/local targets and caps page text, but this MVP is not a production-hardened web crawler.

For a standalone FastAPI illustration of the same routing and live tools, see `docs/local_fastapi_example.py`. It is not a second backend required by this app. To try it separately, install `fastapi`, `uvicorn`, and `requests` in a project-local virtual environment and run `uvicorn docs.local_fastapi_example:app --host 127.0.0.1 --port 8000`. Do not run this example on port 3005.

Existing public-research, mission, and routine workflows are separate from local chat and may access Wikipedia; they are not offline features. The local chat model does not gain computer control or external tool access.

```powershell
npm test
```

## Implemented in this alpha

- Local owner registration/sign-in with scrypt password hashing and an HTTP-only session cookie; organization-scoped records.
- CHIEF to Academic Research Manager delegation for bounded, read-only public research, cited results, status/events, and pause/resume/cancel. Read-only work recovers after server restart.
- Eleven protected education identities are listed in AI Workforce but inactive by default. They reuse the original built-in robot PNGs unchanged—including the original CHIEF, red, green, and orange robots—while only their tier roles and responsibilities change. Existing legacy business identities are archived without relabelling their history. Owners activate only the bots they want; inactive bots stay out of the Inbox. Organization-scoped custom bots retain profile editing, activation/deactivation, deletion, and bounded public research.
- Five versioned education mission templates, persistent dependency tasks, specialist tool allowlists, typed handoffs, retry/lease state, real event history, and pause/resume/cancel controls.
- Organization-scoped PDF/DOCX/TXT/CSV/JSON intake with type/signature checks, opaque storage names, hashing, extraction limits, deduplication, authenticated downloads, and untrusted-content treatment.
- Rubric-based draft assessment, deterministic bounds/total/feedback QA, visible findings, versioned correction, independent re-verification, class analytics, and downloadable report artifacts.
- Exact-action lecturer approval for a fictional draft-gradebook diff, followed by a single-use local mock-provider update and read-after-write verification. Live Google Sheets acceptance remains unverified unless a real dedicated demo connector is added and exercised.
- Group conversations with selected agents, persisted messages, and a bounded CHIEF-to-selected-bot public-research handoff. Groups can be created and removed from the Inbox; deletion retains their history in local storage. Academic Research Manager is preferred when present but not required.
- Direct conversations with all active managers and hosted open-ended chat through Gemini 3.1 Flash-Lite, with optional OpenAI text-chat compatibility. Education missions retain their explicit role tool allowlists and deterministic approval/QA workflow; not every mission step is model-generated.
- Owner-controlled mission draft, proposed plan, activation, cancellation, and task-linked outcomes. Missions are single-run and are not yet schedulable.
- Local recurring research/report routines with organization-timezone scheduling, restart-safe once-per-occurrence claims, pause/resume, and in-app notifications. Research routines can be assigned to an active bot and return work to its direct conversation; a disabled assigned bot produces a recorded blocked occurrence. A missed occurrence runs once after restart rather than replaying every missed day. Nonexistent spring-forward local times are skipped.
- Timezone-aware, manually generated morning/afternoon/evening/daily report snapshots from recorded work. Missing business metrics are stated, not invented.
- In-app contact records and exact-action approval for replacing a contact note. The action hash binds destination, text, contact version, expiry, and policy version; decisions are recorded and execution is once-only. This is an internal test connector, not an external CRM integration.
- Responsive light/dark browser UI, activity timeline, and automated API journey tests.
- A corrected 75-portrait avatar library with one centered robot per square image. The platform uses the corrected PNG assets in `apps/web/assets/bot-avatars-v2`; the earlier sheet crops are retained only as source references. Custom bots can select an avatar during creation or change it later; avatar IDs are tenant-scoped presentation metadata and do not alter bot instructions, permissions, schedules, or research behavior. The gallery is responsive and works with keyboard input.
- Inbox-first desktop/mobile chat layout based on the supplied visual reference: built-in and custom bots, group threads, selected conversation, workspace context, and a compact mobile inbox. The top header shows only BUILD BOT branding and the workspace name; navigation, including Inbox, is in the inbox “+” menu. Light and Dark choices live in Settings → Themes, not the header. The right context panel can be collapsed to widen the middle workspace and reopened, with the preference saved on this device. Per-conversation drafts persist on this device. The computer panel truthfully shows an unavailable state until a computer service exists.

## Not implemented / do not deploy as SaaS

The production build remains broader than this local alpha. BUILD account sign-in/linking is **not connected**: this app currently has its own local account system and cannot access BUILD Growth or BUILD Bid data. Implementing that connection requires BUILD's authentication/OAuth and API details. Provider OAuth token exchange still requires a production secret vault; optional memory embeddings, a hardened code sandbox, a real OCR provider for scans, full Office artifact rendering, external notification delivery, PostgreSQL RLS enforcement, Kubernetes/gVisor deployment, TLS, monitoring and incident operations remain production work. Per-bot Docker computers exist, but this PC must have Docker Desktop running; Kubernetes is not installed by this repository. Connector-specific writes remain denied until an owner creates a policy grant and approves the exact action.

Use `docs/IMPLEMENTATION_CHECKLIST.md` and `planning/06_DELIVERY_ROADMAP.md` for the remaining work. `docs/verification/` records what has actually been tested. The 16 video screenshots are separately packaged in `BUILD_BOT_VIDEO_UX_SCREENSHOTS_16.zip` as observation references, not shipped UI assets. The original supplied ZIP is preserved outside the source release; the new release ZIP contains the extracted kit plus this source tree and a SHA-256 manifest.
