# Implementation checklist

Source: `planning/06_DELIVERY_ROADMAP.md` and `planning/07_ACCEPTANCE_TESTS.md`. A checked item below means a bounded **local alpha** implementation, not completion of the corresponding production phase.

## Local alpha delivered

- [x] Idempotent education workforce migration that preserves CHIEF, archives ten legacy identities, and seeds ten protected academic specialists
- [x] Capability-bound academic role/tool registry and five validated mission templates
- [x] Persisted dependency tasks, handoffs, leases, retries, tool calls, events, pause/resume/cancel, and safe restart recovery
- [x] Organization-scoped PDF/DOCX/TXT/CSV/JSON storage and extraction with validation, hashing, deduplication, and authenticated downloads
- [x] Rubric-based draft assessment, deterministic QA findings, versioned correction, and independent re-verification
- [x] Class analytics plus downloadable assessment, gradebook-preview, and HTML report artifacts
- [x] Exact-action academic approval and organization-scoped mock gradebook update with single-use execution and read-after-write verification
- [x] Academic mission UI with uploads, task graph, QA trail, persisted timeline, approval controls, and artifact downloads

- [x] Local owner registration and sign-in
- [x] Eleven seeded built-in agent identities with supplied avatars
- [x] Organization-scoped agents, messages, tasks, reports, contacts, and events
- [x] CHIEF plan and Intelligence Manager read-only public research delegation
- [x] Source links, persisted result, restart recovery, pause/resume/cancel
- [x] Group conversations and recorded public-research handoff to a selected bot
- [x] Direct bounded public research with each built-in manager (not full role tools)
- [x] Draft/propose/activate/cancel of single-run research missions
- [x] Local timezone-aware research/report routines with bot assignment, restart recovery, blocked-bot state, and in-app notifications
- [x] Custom bot profile create/edit/version/enable/disable and bounded read-only public research
- [x] Custom bots and groups in the three-pane inbox, with device-local conversation drafts
- [x] Manually generated, timezone-aware, evidence-backed report snapshots
- [x] Local CRM note replacement through exact-action, once-only approval
- [x] Responsive light/dark UI and automated journey/security tests

## Production work remaining

## Backend foundations now delivered

- [x] Gemini function-calling loop with bounded steps and provider-key-free mocked tests
- [x] Tenant-scoped read-only computer tools plus exact-action approval for click/fill operations
- [x] Single-consumption in-memory credential leases; credential values are not persisted
- [x] Durable idempotent job records with leases, retries, budgets and cancellation state
- [x] Gemini Batch queue/submission/status adapter that waits honestly for credentials
- [x] Scoped Google Sheets service-account adapter and dedicated-sheet verification endpoint
- [x] Security headers, request IDs, API/auth rate limiting and consistent manifest-backed local backup
- [x] PostgreSQL RLS schema baseline and Kubernetes/RBAC/network-policy/gVisor templates

The items above are code foundations, not claims that WSL, a Kubernetes cluster, PostgreSQL cutover, Gemini, Google Sheets or other external services are live.

- [ ] Credentialed live Google Sheets provider run against a dedicated fictional sheet; current adapter acceptance is mock-provider only and labelled as such
- [ ] Production-grade PDF extraction/OCR, malware scanning, encryption-at-rest, retention controls, and privacy/compliance review before any real student data

- [ ] Production service stack, deployment, CI, and service health checks
- [ ] Hosted identity, tenant isolation with PostgreSQL RLS, roles, and audit hardening
- [ ] Model-backed CHIEF and manager workflows with Temporal, streaming, and attachments
- [ ] True multi-agent conversations beyond the bounded research handoff
- [ ] Production recurring scheduler, external notification delivery, and approval escalation
- [ ] External connectors with scope-specific exact-action enforcement
- [ ] Isolated persistent Linux computers with live control and retention policy
- [ ] Automatic reports and the specified voice workflow
- [ ] Full manager tool packs, custom-bot tool grants beyond public research, and BUILD GROWTH
- [ ] Billing, threat model, secret vault, backups, load/recovery tests, and launch readiness
