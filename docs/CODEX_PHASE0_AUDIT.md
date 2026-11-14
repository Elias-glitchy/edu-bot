# BUILD BOT 2.0 education upgrade — Phase 0 audit

Date: 2026-10-28 (Africa/Johannesburg)

## Repository identity and isolation

- Workspace and Git root: `C:\Users\elias\OneDrive\Documents\ChatGPT\build-bot-colleague-zero`
- Branch: `main`
- Baseline commit: `37c03df219f63069ea18f2b84930fb99979b83a8`
- Git remotes: none configured.
- Baseline worktree: clean.
- Original sibling repository observed at `C:\Users\elias\OneDrive\Documents\ChatGPT\BUILD BOT`; it was not opened, modified, executed, or connected.
- The supplied Melsoft ZIP was extracted to a temporary directory outside both repositories for review.

## Runtime and storage

- Runtime: Node.js 24+ ES modules and `node:http`.
- Frontend: static HTML/CSS/browser JavaScript in `apps/web`.
- Storage: Node `DatabaseSync`, SQLite WAL, foreign keys enabled.
- Hackathon database: `data/build-bot-colleague-zero.sqlite`.
- Port: `3005`, independently configurable through `COLLEAGUE_ZERO_PORT`.
- Database overrides are rejected unless they remain inside this project root.
- No `.env` file is loaded by the application. `.env.example` contains placeholders only.
- Local Ollama is expected at `http://localhost:11434`; public research uses Wikipedia and optional Brave Search.
- No Google, BUILD production, CRM, email, calendar, payment, or hosted service credentials were found in the repository.

## Baseline architecture

- `apps/api/server.mjs`: auth, HTTP routes, worker loop, static files.
- `apps/api/store.mjs`: schema, migrations, built-in seeding, state snapshot.
- `apps/api/domain.mjs`: bounded research tasks and reports.
- `apps/api/chat.mjs`: local-model chat routing.
- `apps/api/approvals.mjs`: exact-action local CRM approval.
- `apps/api/schedules.mjs`: local recurring tasks and report scheduling.
- `apps/web/app.js` and `messenger-view.js`: chat-first responsive UI.

The baseline has eleven business-oriented built-ins, all inactive by default, plus custom bots. Its background worker performs only the bounded public-research workflow. Missions are single-run research plans; groups are not true concurrent multi-agent execution.

## Baseline verification

Command: `npm test`

- Tests: 21
- Passed: 21
- Failed: 0
- Duration: 5.28 seconds

The health endpoint returned `{"ok":true,"storage":"sqlite","research":"wikipedia"}` before the development server was stopped for migration work.

## Backup

Before education schema or identity changes, SQLite WAL was checkpointed and the database was copied to:

`data/backups/pre-education-migration-20261028.sqlite`

Source and backup SHA-256:

`44CD7C1708F3061A91001AD287729B566F89658629D69F356A26963930B7CA20`

## Selected implementation approach

Keep the existing stack and add versioned, idempotent SQLite migrations; a protected education role/tool registry; archived legacy identities; persistent mission tasks, handoffs, tool calls, artifacts and events; organization-scoped academic files; deterministic assessment/QA tools; exact-action gradebook approvals; a clearly labelled local demonstration Sheets provider; and UI extensions within the existing chat-first shell.

Uploaded content and external text remain untrusted data. The implementation uses fictional demonstration records only and labels generated assessment outcomes as drafts requiring educator review.
