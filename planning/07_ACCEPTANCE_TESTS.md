# Acceptance and verification plan

Passing unit tests alone does not establish that BUILD BOT works. Each journey below must run through the real web/API/workflow/database path with controlled provider fixtures, then against selected production providers in staging.

## Product journeys

### 1. Organization and workforce

- Create an organization and owner.
- Verify CHIEF plus ten managers are created once with correct roles and avatars.
- Confirm a second organization receives separate agent, conversation, memory, computer, and policy records.
- Attempt cross-organization access through UI and direct API ids; every attempt is denied and audited where appropriate.

### 2. CHIEF delegates research

- Ask CHIEF a research question in chat.
- Verify a persisted plan and delegated Intelligence Manager task appear.
- Stream real task states to the conversation and activity page.
- Return a sourced result with evidence.
- Reload the browser and restart API/worker during execution; state and completion remain correct.
- Pause and cancel variants stop future execution.

### 3. Group collaboration

- Create a group with human, CHIEF, Finance, and Operations.
- Ask about an operational issue requiring Finance data.
- Verify CHIEF creates a targeted handoff; Finance returns a structured result; CHIEF summarizes and closes/continues the task.
- Confirm no unbounded bot-to-bot messages occur.

### 4. Exact-action approval

- Configure an external email send as Always Ask.
- Agent prepares recipient, subject, body, and attachments.
- Approval page shows the exact proposal and policy reason.
- Approve and verify the action executes once.
- Repeat while changing recipient/body/attachment after approval; execution must stop and require a new approval.
- Reject and expire variants never execute.

### 5. Per-bot Linux isolation

- Start two bot computers in organization A and one in organization B.
- Write distinct test files and browser state in each.
- Stop/start all workspaces; each state persists only in its owner workspace.
- Attempt filesystem, stream-token, network, and object-reference crossover; deny all.
- Verify secrets do not appear in desktop, logs, screenshots, or downloaded files.

### 6. Live computer task and takeover

- Ask an authorized manager to complete a read-only browser task.
- View live execution and step/evidence updates.
- Take control; automation pauses and input ownership changes.
- Return control; the bot observes current state before acting.
- Pause/resume, disconnect/reconnect, and stop variants behave correctly.
- Completion contains source URLs and redacted screenshots.

### 7. Sunday mission cycle

- Set organization timezone and Sunday planning time.
- Seed goals, an incomplete prior task, and one pending approval.
- CHIEF proposes a measurable plan with assignments, dependencies, and report schedule.
- Review/activate according to policy.
- Advance controlled time into Monday–Saturday; eligible tasks run and blocked work does not halt independent tasks.
- Restart workflow workers; schedules do not duplicate or disappear.

### 8. Daily reports

- Generate morning, afternoon, and evening reports from a known event set.
- Verify completed/in-progress/blocked/approval counts and narratives against source records.
- Every factual result links to evidence.
- Unavailable metrics display as unavailable; estimates are labeled.
- Correct timezone/day boundaries and no duplicate report for the same scheduled occurrence.

### 9. Connection revocation

- Authorize a scoped connector and complete a read.
- Revoke it while a later task is queued.
- Verify new access fails safely, the task becomes blocked/action-required, and the audit trail records revocation without exposing credentials.

### 10. Custom agent

- Configure identity, instructions, knowledge, tools, autonomy, reporting line, and computer policy.
- Run sandbox validation with no production side effects.
- Deploy, execute a permitted task, deny a forbidden action, revise configuration, and verify version history.
- Archive/delete according to retention policy and verify credential/computer cleanup.

### 11. Voice parity

- Send the same allowed request by text and voice; both create equivalent governed tasks.
- Send a voice request that requires approval; it must not bypass the gate.
- Verify transcript visibility, recording indicator, cancellation, and retention controls.

### 12. Failure and recovery

- Simulate model timeout, connector rate limit, expired token, browser crash, workspace loss, workflow-worker restart, and object-storage outage.
- Verify bounded retries, accurate status, no duplicate side effect, useful escalation, and preserved evidence.

### 13. BUILD GROWTH embedded workforce

- Open an opportunity in BUILD GROWTH and invoke CHIEF with signed organization, user, role, workspace, and opportunity context.
- Verify CHIEF delegates bounded fit analysis, company research, decision-maker discovery, and pursuit preparation to the correct managers.
- Confirm the run, tasks, approvals, activity, evidence, and computer session are the same records in the standalone and embedded surfaces.
- Approve one authorized business-record write and verify it is applied exactly once with actor, delegation, source evidence, and correlation id.
- Revoke access and verify subsequent reads/writes fail safely without exposing another tenant's data.

### 14. Construction opportunity-to-cash journey

- Detect or ingest a project/permit/planning/award signal and preserve source provenance.
- Produce a transparent fit score, company and winning-contractor research, verified decision-makers, and a proposed pursuit plan.
- Draft outreach and follow-up; require policy approval before external communication when configured.
- Progress the same opportunity through pipeline, quote/BOQ preparation, approved invoice creation, and payment-state follow-up.
- Verify Intelligence, Sales, Outbound, CRM, Estimating & Commercial, Finance, Tender & Bid, Operations, and CHIEF handoffs are bounded and auditable.
- Ensure BUILD GROWTH remains authoritative for the business records while BUILD BOT remains authoritative for agents, missions, runs, approvals, computers, and evidence.

### 15. Grok-style UX and functional parity

- At supported desktop widths, verify the agent/conversation roster, active chat, and contextual computer/routines pane are simultaneously usable with the proportions and hierarchy in the supplied reference.
- At mobile widths, verify the workforce inbox, pinned-agent strip, search, create action, conversation drill-in, back behavior, and contextual computer/routine drill-in.
- Select an employee, exchange streamed messages, upload/download an attachment, record a voice message, start a task, view live status, and inspect its computer without navigating to an unrelated dashboard.
- Create and pause a routine, connect an integration, create a custom bot, and start a group conversation through the same chat-first shell.
- Verify keyboard, screen-reader, focus, reduced-motion, loading, empty, offline, failure, permission, approval, and interrupted-run states.
- Run visual-regression comparisons against approved BUILD BOT reference captures at desktop and mobile breakpoints. Fail on unexplained structural drift, while permitting BUILD BOT branding, content, accessibility, and platform-native control differences.

## Engineering verification

- Frontend lint, type check, component/accessibility checks, and production build.
- Backend formatting/lint, static typing, migration up/down on test database, and focused domain tests.
- Contract test generated client against OpenAPI.
- Workflow replay/determinism tests and restart tests.
- Policy decision tests and approval hash tests.
- Tenant-isolation tests for database, cache, storage, events, streams, and computer gateway.
- Connector sandbox contract tests and idempotency tests.
- Container and dependency vulnerability scans.
- Load tests for chat streaming, event reconnect, scheduled workflow bursts, and computer stream gateway.
- Backup restoration and workspace-volume recovery drill.
- WCAG AA audit for primary journeys in both themes and responsive layouts.

## Release evidence

For each phase, create a dated report under `docs/verification/` containing:

- Git revision and environment.
- Commands executed and results.
- Acceptance journeys passed/failed.
- Screenshots or artifacts where helpful.
- Known limitations and risk owner.
- Migration and rollback notes.

