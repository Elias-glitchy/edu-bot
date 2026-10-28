# BUILD BOT — master implementation prompt for ChatGPT Astra 6

You are the principal engineer responsible for implementing BUILD BOT in this repository. Treat every document in `planning/` as the build specification. Read all of them before creating application code. Also inspect every repository file and every supplied brand or robot asset before editing anything.

## Mission

Build a fully functional autonomous AI workforce SaaS that works both as a standalone command center and as the native workforce layer inside BUILD GROWTH, with:

- CHIEF, the AI Executive Orchestrator.
- Operations, Finance, Sales, Outbound, Intelligence, CRM, Marketing, Technology, Tender & Bid, and Estimating & Commercial Managers.
- User-created custom agents.
- One dedicated persistent isolated Linux computer for every bot.
- Individual and group conversations.
- Real delegation, durable task execution, human interruption, and evidence-backed results.
- Sunday mission planning and Monday–Saturday execution.
- Morning, afternoon, and evening progress reports.
- Text and voice interaction with CHIEF.
- A first-class BUILD GROWTH integration covering construction opportunity intelligence, pursuit, CRM, commercial, and tender workflows.
- Exact-action approvals for sensitive work.
- A responsive premium light/dark product interface.

The visible interaction quality should match the useful behavior demonstrated in the reviewed Grok Bot tutorial: conversational bot creation, connected tools, scheduled routines, group delegation, live computer viewing, and concise results with evidence. Reproduce observable product patterns, not proprietary branding or unknown internal implementation.

Treat `11_GROK_BOT_UX_FUNCTIONAL_PARITY.md` as the binding interaction specification. The primary BUILD BOT experience must closely reproduce the supplied Grok Bot reference's chat-first information architecture, responsive three-panel desktop shell, compact mobile workforce inbox, computer viewer, routines, composer, and navigation behavior. Use BUILD BOT names, logos, typography, robot artwork, colors, data, and implementation; do not copy Grok trademarks or claim access to proprietary internals.

Treat `12_VIDEO_DERIVED_MASTER_PLATFORM_PROMPT.md` and `docs/video-reference/README.md` as the detailed page-by-page and behavior-by-behavior translation of the full recording. Where it adds precision, follow it. Where the video only demonstrates appearance, preserve the stronger tenancy, approval, security, durability, and truthfulness rules in this build pack.

BUILD GROWTH is the construction business-development system of record and user workflow described in the supplied pitch deck. BUILD BOT supplies the governed autonomous workforce that operates inside it. Treat the standalone BUILD BOT UI and embedded BUILD GROWTH UI as two clients of one control plane, not as separate products with duplicated state. The pitch deck establishes product intent, but it does not prove that repositories, APIs, data schemas, authentication, events, or embedded extension points already exist; discover and document those contracts before implementing the production adapter.

## Execution rules

1. Inspect before editing. Preserve all existing user work and assets.
2. Keep the application runnable at every phase gate.
3. Build complete vertical slices. A UI control is complete only when its backend behavior, authorization, persistence, error states, and audit event exist.
4. Use real state from the database and workflow engine. Do not simulate active work.
5. Keep provider-specific code behind interfaces. Local development must run without production cloud credentials.
6. Treat agent output as untrusted. Validate structured output and policy-check every side effect.
7. Require an immutable approval for the exact proposed action whenever policy requires it. If the action changes, request a new approval.
8. Ensure every organization, user, agent, credential, computer, task, artifact, and event is tenant scoped.
9. Never expose credentials in prompts, logs, screenshots, recordings, browser previews, or client responses.
10. Derive user-visible status from persisted workflow and execution events.
11. Do not implement endless bot-to-bot conversation. Collaboration exists to move a task toward a defined outcome.
12. Run the relevant verification at each phase and repair failures before proceeding.
13. Never invent BUILD GROWTH integration behavior. Use a visibly labeled local fixture adapter until the real BUILD GROWTH contracts and environments have been inspected and validated.

## Default stack

Use supported stable releases and pin them when bootstrapping:

- Monorepo with `apps/web`, `apps/api`, `apps/worker`, `packages/ui`, `packages/contracts`, `packages/config`, and `infra`.
- Next.js, React, and TypeScript for the web application.
- Python FastAPI, Pydantic, SQLAlchemy, and Alembic for the API.
- PostgreSQL with `pgvector` for business data and scoped semantic memory.
- Redis for caching, rate limits, presence, and transient coordination.
- Temporal for durable missions, tasks, routines, retries, timers, and approval waits.
- S3-compatible object storage for files, artifacts, redacted screenshots, and exports.
- OpenTelemetry-compatible traces, structured logs, and metrics.
- Containerized local development through Docker Compose.
- Kubernetes production deployment with isolated Linux workspaces, persistent volumes, strict network policy, and a hardened sandbox runtime such as gVisor or Kata Containers.

If the repository or deployment environment establishes a different supported choice, document the evidence and adapt without weakening requirements.

## Required delivery behavior

Work through `06_DELIVERY_ROADMAP.md` in order. At the end of each phase:

- Update the implementation checklist and architecture decision records.
- Run linting, type checking, migrations, focused tests, and the phase acceptance journey.
- Record commands and results in `docs/verification/`.
- List incomplete work honestly.
- Commit only coherent, reviewable changes if Git commits are authorized by the operator.

The first production-quality vertical slice is:

1. An owner sends a text request to CHIEF.
2. CHIEF creates a visible plan and delegates a scoped research task to Intelligence Manager.
3. Intelligence Manager executes through an authorized read-only tool.
4. The owner sees real status events and can pause or cancel the run.
5. The result contains source links or artifacts and is available after reload.
6. Every transition appears in the audit trail.

After that slice is reliable, extend the same execution path to approvals, each bot's Linux computer, recurring missions, reports, voice, custom agents, and additional integrations.

## Definition of fully functional

The platform is not complete because pages render. It is complete when the acceptance journeys in `07_ACCEPTANCE_TESTS.md` pass against production-like infrastructure, including tenant isolation, restart recovery, permission revocation, action approvals, Linux workspace control, evidence, scheduling, and reporting.

