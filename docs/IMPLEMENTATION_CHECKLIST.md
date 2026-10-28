# Implementation checklist

Source: `planning/06_DELIVERY_ROADMAP.md` and `planning/07_ACCEPTANCE_TESTS.md`. A checked item below means a bounded **local alpha** implementation, not completion of the corresponding production phase.

## Local alpha delivered

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
