# BUILD BOT 2.0 — Colleague Zero hackathon copy

This is the independent hackathon duplicate of BUILD BOT. It preserves the runnable local alpha, supplied ASTRA 6 kit, source, assets, tests, and documentation without sharing the original project's database, HTTP session cookie, local port, Git repository, or runtime logs. It is not a finished hosted SaaS. Education-specific development has intentionally not started yet.

## Start

Requires Node.js 24 or newer and local Ollama for chat. No cloud credentials are needed. From this directory:

```powershell
npm run dev
```

The development server reloads automatically when server code changes, so newly added controls and their API routes stay in sync. This independent copy uses local port 3005.

Open `http://localhost:3005` and create a local workspace. The copy stores its SQLite database at `data/build-bot-colleague-zero.sqlite`; this path is excluded from Git. `COLLEAGUE_ZERO_DB` may select a different path only when it stays inside this project directory. Set `COLLEAGUE_ZERO_PORT` to override the port. Public research needs access to Wikipedia. For offline UI/testing only, set `COLLEAGUE_ZERO_RESEARCH_FIXTURE=1`; fixture results are visibly labeled and are not factual research.

Double-click `Open BUILD BOT 2.0.cmd` in this folder to start, verify, and open the independent copy on port 3005.

## Local chat setup (8 GB laptop)

1. Download Ollama for Windows from https://ollama.com/download/windows and run its normal installer. No administrative system-control script is needed. Start Ollama if it is not already running.
2. Open PowerShell and pull the two compact local models, one at a time:

   ```powershell
   ollama pull llama3.2:3b
   ollama pull qwen2.5:3b
   ```

3. Check that both are available with `ollama list`. Ollama serves its local API at `http://localhost:11434`.
4. Run `npm run dev` here and open `http://localhost:3005`. Activate a bot in AI Workforce, then send any message in the Inbox. The UI shows no model selector or internal model names.

For current events, prices, news, and general live web search, obtain a Brave Search API key and set `COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY` **in this copy's server environment only** before starting it. In PowerShell, `$env:COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY = Read-Host 'Brave Search API key'` sets it for the current terminal session. This is a search service, not a cloud LLM; live search queries leave your computer. Without the key, fresh search requests fail clearly rather than getting a guessed answer. A specific public HTTPS page URL can be browsed without the search key. Native X search is not connected; for X requests, web search looks for indexed public X pages and labels that limitation.

The server routes casual conversation to an everyday model and coding, math, analysis, planning, tool-oriented, multi-step, or time-sensitive requests to a reasoning model. The internal mapping and prompts are in `apps/api/chat.mjs`; freshness detection and constrained web/page tools are in `apps/api/live-tools.mjs`. LLM requests go only to localhost Ollama. Fresh web tools contact outside sites only when needed. Inference is serialized, context is capped, and each model is unloaded after a reply to avoid keeping both loaded on an 8 GB machine. Cold starts may be slow. If Ollama or required live search is unavailable, chat returns an explicit error rather than a fabricated bot reply. Web browsing blocks obvious private/local targets and caps page text, but this MVP is not a production-hardened web crawler.

For a standalone FastAPI illustration of the same routing and live tools, see `docs/local_fastapi_example.py`. It is not a second backend required by this app. To try it separately, install `fastapi`, `uvicorn`, and `requests` in a project-local virtual environment and run `uvicorn docs.local_fastapi_example:app --host 127.0.0.1 --port 8000`. Do not run this example on port 3005.

Existing public-research, mission, and routine workflows are separate from local chat and may access Wikipedia; they are not offline features. The local chat model does not gain computer control or external tool access.

```powershell
npm test
```

## Implemented in this alpha

- Local owner registration/sign-in with scrypt password hashing and an HTTP-only session cookie; organization-scoped records.
- CHIEF to Intelligence Manager delegation for bounded, read-only public research, cited results, status/events, and pause/resume/cancel. Read-only work recovers after server restart.
- Eleven supplied built-in agent identities and avatars are listed in AI Workforce but inactive by default. Owners activate only the bots they want; inactive bots stay out of the Inbox. Existing workspaces retain activation for bots with recorded use while untouched preloads are deactivated. Organization-scoped custom bots support profile edits, activation/deactivation, deletion, and bounded read-only public research. Deletion removes the bot from the workforce and Inbox, cancels pending work, and pauses its routines while retaining historical records. This research uses a fixed workflow; saved custom instructions are not yet interpreted by a model. Custom bots do not have external tool grants or role-specific execution yet.
- Group conversations with selected agents, persisted messages, and a bounded CHIEF-to-selected-bot public-research handoff. Groups can be created and removed from the Inbox; deletion retains their history in local storage. Intelligence Manager is preferred when present but not required.
- Direct conversations with all active managers and locally generated open-ended chat through Ollama. The managers do not yet have role-specific business tools.
- Owner-controlled mission draft, proposed plan, activation, cancellation, and task-linked outcomes. Missions are single-run and are not yet schedulable.
- Local recurring research/report routines with organization-timezone scheduling, restart-safe once-per-occurrence claims, pause/resume, and in-app notifications. Research routines can be assigned to an active bot and return work to its direct conversation; a disabled assigned bot produces a recorded blocked occurrence. A missed occurrence runs once after restart rather than replaying every missed day. Nonexistent spring-forward local times are skipped.
- Timezone-aware, manually generated morning/afternoon/evening/daily report snapshots from recorded work. Missing business metrics are stated, not invented.
- In-app contact records and exact-action approval for replacing a contact note. The action hash binds destination, text, contact version, expiry, and policy version; decisions are recorded and execution is once-only. This is an internal test connector, not an external CRM integration.
- Responsive light/dark browser UI, activity timeline, and automated API journey tests.
- A corrected 75-portrait avatar library with one centered robot per square image. The platform uses the corrected PNG assets in `apps/web/assets/bot-avatars-v2`; the earlier sheet crops are retained only as source references. Custom bots can select an avatar during creation or change it later; avatar IDs are tenant-scoped presentation metadata and do not alter bot instructions, permissions, schedules, or research behavior. The gallery is responsive and works with keyboard input.
- Inbox-first desktop/mobile chat layout based on the supplied visual reference: built-in and custom bots, group threads, selected conversation, workspace context, and a compact mobile inbox. The top header shows only BUILD BOT branding and the workspace name; navigation, including Inbox, is in the inbox “+” menu. Light and Dark choices live in Settings → Themes, not the header. The right context panel can be collapsed to widen the middle workspace and reopened, with the preference saved on this device. Per-conversation drafts persist on this device. The computer panel truthfully shows an unavailable state until a computer service exists.

## Not implemented / do not deploy as SaaS

The requested full build remains broader than this alpha. BUILD account sign-in/linking is **not connected**: this app currently has its own local account system and cannot access BUILD Growth or BUILD Bid data. Implementing that connection requires BUILD's authentication/OAuth and API details. It also does not include the specified Next.js/FastAPI/PostgreSQL/Temporal production stack, PostgreSQL RLS, hosted identity, billing, arbitrary model reasoning, role-specific manager tool packs, real external connectors, Linux computers, external notification delivery, voice, or production operations. It also lacks TLS, a secret vault, rate limits, backups, and production deployment hardening. The approval mechanism has only been exercised against local contact notes; it is **not** a claim that future external writes are safe without connector-specific enforcement.

Use `docs/IMPLEMENTATION_CHECKLIST.md` and `planning/06_DELIVERY_ROADMAP.md` for the remaining work. `docs/verification/` records what has actually been tested. The 16 video screenshots are separately packaged in `BUILD_BOT_VIDEO_UX_SCREENSHOTS_16.zip` as observation references, not shipped UI assets. The original supplied ZIP is preserved outside the source release; the new release ZIP contains the extracted kit plus this source tree and a SHA-256 manifest.
