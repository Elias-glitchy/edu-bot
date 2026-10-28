# Phased delivery roadmap

Every phase ends with a runnable demonstration and the relevant acceptance tests. Estimates should be produced only after the implementation team selects providers and measures the first vertical slice.

## Phase 0 — Bootstrap and decisions

Deliver:

- Monorepo, formatting, linting, type checking, CI, local Compose stack, environment templates, health checks, and generated API client path.
- Architecture decision records for identity, workflow engine, object storage, model providers, Linux computer runtime, streaming, deployment, and secrets.
- Final role/avatar mapping and selected primary pose per employee.
- Threat model, action taxonomy, approval defaults, data retention defaults, and acceptance fixtures.
- Design tokens and core responsive shell based on the supplied brand/mockups.
- BUILD GROWTH integration discovery: inspect its repositories and environments; document identity, tenants, APIs, schemas, events, business-record ownership, and embedded extension points. Do not infer these from the pitch deck.

Exit: one command starts the local platform; web/API/worker/database/workflow services report healthy; migrations run; no product feature is falsely presented as live.

## Phase 1 — SaaS and workforce foundation

Deliver:

- Authentication, organization creation, memberships, roles, protected routes, and tenant isolation.
- PostgreSQL schema/migrations and row-level policies for identity/workforce.
- Official logo, themes, responsive navigation, accessibility baseline.
- Eleven seeded built-in agent templates and organization-specific agent instances.
- Workforce page, agent profile/configuration basics, truthful states, and custom-agent empty state.
- Subscription/usage domain skeleton without pretending payment processing is complete.

Exit: two test organizations cannot access each other's data; an owner sees the correct eleven employees and can edit permitted organization-level configuration.

## Phase 2 — CHIEF vertical slice

Deliver:

- Chief and individual conversation persistence, streaming responses, attachments, and message sequencing.
- Agent/version/instruction system, model router, typed tool registry, memory retrieval baseline.
- Task, run, step, artifact, and execution-event records.
- Temporal workflow for plan, delegate, execute, verify, and report.
- Intelligence Manager read-only research tool with citations.
- Live status and activity timeline, plus pause/cancel.
- A typed read-only `BuildGrowthAdapter` contract with a visibly labeled local fixture provider until a real BUILD GROWTH environment is available.

Exit: the master prompt's first vertical slice passes after browser refresh and API/worker restarts, including a variant launched from BUILD GROWTH opportunity context through the fixture or validated production adapter.

## Phase 3 — Collaboration, missions, and routines

Deliver:

- Group conversations, mentions, task handoff cards, participant management, and consolidated summaries.
- Missions, goals, dependencies, task assignment, timelines, and routine schedules.
- Sunday plan proposal/review/activation.
- Organization-timezone scheduling and restart-safe timers.
- Manager capacity rules and avoidance of endless bot chatter.

Exit: CHIEF creates a weekly plan, delegates a dependent task chain across at least two managers, and resumes correctly after a worker restart.

## Phase 4 — Connections and approval engine

Deliver:

- Connector catalog, OAuth/secret lifecycle, scope display, test, revoke, and account labels.
- First production connector selected by the owner; add one read and one write operation.
- Capability grants, policy rules, exact-action proposals, approval inbox, decision history, expiry, and supersession.
- Audit event UI and export foundation.
- Emergency revocation.

Exit: authorized reads succeed; a sensitive write pauses; approval executes the exact action once; mutation invalidates approval; rejection and revocation are enforced.

## Phase 5 — Per-bot Linux computers

Deliver:

- `ComputerProvider` interface and local Docker implementation.
- Production Kubernetes provisioner with hardened sandbox and encrypted per-bot persistent volume.
- Workspace image, Playwright/desktop automation sidecar, egress proxy, malware scanning, and credential proxy.
- Computer inventory, start/stop lifecycle, exclusive lease, snapshots, reset, quarantine, and metering.
- Authenticated live viewer, view-only mode, take/return control, pause/resume/stop, and evidence capture.

Exit: two agents in one organization and one agent in another have distinct persisted files/browser state; no cross-workspace access; a browser task survives a worker restart and the owner can interrupt it.

## Phase 6 — Reports, notifications, and voice

Deliver:

- Morning, afternoon, evening, weekly, mission, and manager reports with provenance.
- Configurable schedules and delivery preferences.
- In-app/email/push adapters as selected; quiet/retry rules.
- Voice notes with transcription and playback.
- Live voice with CHIEF if the chosen provider and latency meet acceptance criteria.

Exit: scheduled reports are generated from verified events, all claims link to evidence, and voice commands follow the same permissions and approvals as text.

## Phase 7 — Complete workforce and custom agents

Deliver:

- Domain tool packs and guarded workflows for all ten managers.
- Custom-agent creation wizard, sandbox test, capability validation, deploy, versioning, pause, archive, and delete.
- Complete BUILD GROWTH production adapter, signed embedded context, bidirectional deep links, event synchronization, and contract tests.
- BUILD BID adapter boundaries and contract tests for the available tender platform operations, without duplicating tender records in BUILD BOT.
- Memory inspection/correction/export/deletion.
- Role-specific report templates and handoffs.

Exit: every built-in employee completes at least one role-relevant acceptance journey, and a custom bot can be safely configured, tested, deployed, and revoked.

## Phase 8 — Billing and production readiness

Deliver:

- Subscription checkout/customer portal/provider webhooks, entitlements, quotas, metered usage, invoices, and graceful limit handling.
- Security hardening, privacy/retention controls, accessibility audit, performance/load tests, disaster recovery, operational dashboards, alerting, and runbooks.
- Staged rollout, support/admin tools, onboarding, and truthful product documentation.

Exit: `07_ACCEPTANCE_TESTS.md` passes in staging; restore and incident drills are documented; launch blockers are closed or explicitly accepted by the product owner.

## Recommended release slices

- Internal alpha: end of Phase 2.
- Controlled design-partner alpha: end of Phase 4.
- Computer-use beta: end of Phase 5.
- Complete workforce beta: end of Phase 7.
- General availability candidate: end of Phase 8.

