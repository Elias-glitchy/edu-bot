# BUILD BOT — video-derived master platform implementation prompt

## How to use this document

Give this entire document to the implementation agent as the controlling product prompt. It supplements the existing BUILD BOT plans and turns the user-supplied 12:58 product walkthrough into an explicit, testable platform contract.

The screenshots under `docs/video-reference/screenshots/` are observation evidence only. They contain third-party branding, blurred/private data, a presenter overlay, and external websites. Do not ship, trace, or reproduce those images. Recreate the interaction model using BUILD BOT branding, the supplied robot identities, original components, and governed BUILD BOT data. Do not claim access to the reference product's source code, APIs, private architecture, or proprietary assets.

---

## Master prompt

You are the principal product engineer, staff UX architect, agent-runtime engineer, and security owner for BUILD BOT. Build a production-grade autonomous AI workforce platform whose observable workflow closely matches the user-supplied desktop walkthrough while remaining an original BUILD BOT implementation.

Read every file in `planning/`, `docs/`, `apps/`, and the supplied build kit before editing. Preserve existing work. Implement complete vertical slices: a control is not complete until its UI, API, authorization, persistence, durable workflow, errors, audit events, and tests exist.

### Primary outcome

BUILD BOT must feel like a fast, calm team inbox where the user works with named AI employees through conversation. The product is not a dashboard with a chat widget. Chat is the operating surface. Agents can be created, configured, connected to apps, assigned scheduled routines, placed in group chats, observed while working in a computer, interrupted, and held at approval gates. Results return to the conversation with links, evidence, artifacts, and clear next choices.

The platform must support:

- CHIEF as the user's executive orchestrator.
- Operations, Finance, Sales, Outbound, Intelligence, CRM, Marketing, Technology, Tender & Bid, and Estimating & Commercial Managers.
- Organization-scoped custom bots created conversationally or through structured settings.
- Persistent direct conversations and multi-agent group conversations.
- Real plans, delegation, durable runs, schedules, retries, pause/resume/cancel, and evidence.
- Connected apps with explicit scopes, health, renewal, revocation, and account selection.
- Browser/computer work with a live preview, recorded actions, artifacts, and user takeover.
- Voice notes and governed live calls.
- Marketplace discovery for bot templates and integrations.
- Usage, billing, update, workspace, notification, and computer-management settings.
- Exact-action approvals for consequential work.
- Responsive desktop, tablet, and mobile behavior.

### Non-negotiable truthfulness

Never simulate work with client timers, canned progress, fake computer thumbnails, or invented business results. Every visible state must reconcile from persisted records after refresh, reconnect, worker restart, or device change. If a service is not available, show an honest unavailable state. Demo fixtures must be labeled `Demo`.

Do not infer that the reference product's security or technical choices are safe. Reproduce useful visible behavior while applying BUILD BOT's tenant isolation, policy, audit, and approval requirements.

---

## 1. Product experience contract

### 1.1 Interaction principles

1. Conversation first. The user gives outcomes in natural language; BUILD BOT converts them into plans, bounded actions, and follow-up choices.
2. Team mental model. Every bot has a name, role, avatar, status, conversation, memory scope, tool grants, routines, and execution history.
3. Context beside conversation. Computer state, routines, evidence, approvals, and artifacts appear in a contextual panel without forcing a navigation reset.
4. Progressive disclosure. Simple requests stay simple; implementation details are available when the user opens a run, approval, evidence item, or computer session.
5. Explicit agency. The UI distinguishes user messages, agent messages, tool events, scheduled events, system notices, and human approvals.
6. Safe autonomy. Reads and reversible actions may run within policy. High-impact actions stop at an exact, reviewable approval request.
7. Evidence-backed closure. Completed work returns a concise answer plus sources, screenshots, record links, artifacts, and the next useful choices.
8. Durable continuity. Drafts, selections, run state, routines, unread state, and computer state survive reloads and reconnects.
9. No endless bot chatter. Every delegation has an objective, owner, constraints, expected output, deadline or stop condition, and terminal status.
10. Original BUILD BOT expression. Use BUILD BOT names, logos, avatars, content, and code. Match hierarchy and interaction patterns, not proprietary branding.

### 1.2 Roles

- `Owner`: full organization control, billing, security policy, connections, approvals, computers, bot lifecycle, and data export/deletion.
- `Admin`: workforce and workspace administration except ownership transfer and restricted billing/security actions.
- `Member`: conversations and authorized runs; may approve only categories granted by policy.
- `Viewer/Auditor`: read-only conversations, reports, evidence, and audit activity as granted.
- `Bot`: non-human principal with explicit organization, capabilities, tool grants, budgets, memory scopes, and reporting relationship.
- `Service principal`: connector or worker identity; never displayed as a human user.

---

## 2. Global information architecture

### 2.1 Desktop shell

At wide desktop widths render three full-height panes:

1. `Workforce inbox` on the left, 280–320 px by default, resizable within 248–380 px.
2. `Active conversation` in the center, flexible with a practical minimum near 460 px.
3. `Context/computer pane` on the right, 320–420 px, collapsible and resizable.

Use fine 1 px dividers, true-black or near-black dark mode, white/light-neutral light mode, compact spacing, and minimal shadows. Pane selection must update without a full-page flash. Persist pane widths, collapse state, last context tab, and selected conversation per user/device.

Reference: [workforce inbox, chat, computer pane](../docs/video-reference/screenshots/02-workforce-inbox-chat-computer-pane.jpg).

### 2.2 Left workforce inbox

The left pane is not a generic SaaS navigation sidebar. It is a searchable roster and conversation inbox.

Required structure:

- Top row: product/workspace identity, create button, optional window controls in desktop clients.
- Search field: matches bot name, role, label, group name, recent message text, status, and routine name.
- Ordered conversation rows: CHIEF first when pinned, then direct/group threads by pinning and recency.
- Row contents: 32–40 px avatar, bot/group name, optional role label, one-line last-message/result preview, relative time, unread badge, and one truthful status marker.
- Status marker semantics: working, waiting for approval, scheduled, paused, failed, unread, connection expired, offline. Never use a single ambiguous dot for all conditions.
- Keyboard support: Up/Down changes active row, Enter opens, context menu exposes pin/mute/mark unread/archive where authorized.
- Bottom anchors: Marketplace/Integrations and signed-in user/workspace menu.
- Virtualize long lists while keeping accessible semantics and stable focus.

Selecting a row changes the center conversation and right context atomically. Do not display one bot's chat with another bot's computer.

### 2.3 Center conversation

Required structure:

- Sticky header: avatar(s), name, role/status, share/export if authorized, settings, context/computer toggle, and group-participant control.
- Scrollable message timeline with date separators and a durable unread anchor.
- Sticky composer at the bottom.
- User messages align right or use a high-contrast surface.
- Agent messages align left and show the speaker in groups.
- System/run events use compact timeline rows, not fake chat speech.
- Structured content renders inside the thread without breaking reading order.

Supported message blocks:

- Plain and rich text.
- Files and images with processing state.
- Plan and checklist cards.
- Delegation/handoff cards.
- Tool-use and computer-action summaries.
- Connection-required cards.
- Approval requests.
- Progress/checkpoint events.
- Ranked results and comparison tables.
- Citations and deep links.
- Screenshot/evidence galleries.
- Downloadable artifacts.
- Choice cards with quick options and a custom-answer field.
- Error/retry cards.
- Routine-created/updated notices.

### 2.4 Composer

The composer must support:

- Multiline text, Shift+Enter newline, Enter send, and IME-safe behavior.
- Add/attach control for files, images, records, and supported context.
- Drag/drop and paste uploads.
- Microphone for voice notes; live voice when enabled.
- Send button, stop-generation/run control, and visible disabled reasons.
- Draft persistence per conversation.
- Upload, scan, parse, and transcription progress.
- Mention completion for bots in groups.
- Slash/launcher actions where useful, without requiring command syntax.
- Mobile safe-area handling and keyboard avoidance.

Sending creates a persisted user message before execution begins. Optimistic UI must reconcile with the server-assigned identifier and report failure without losing the draft.

### 2.5 Right context/computer pane

Default priority:

1. Active computer preview or honest offline/unavailable state.
2. Current action, plan step, elapsed time, connection quality, and input owner.
3. Controls: view, open, take control, return control, pause, resume, stop, reconnect.
4. Routines for the selected bot with schedule, next run, last outcome, and state.
5. Tabs/sections for plan, tasks, evidence, artifacts, approvals, memory/context, and linked BUILD GROWTH records.

When no run is active, keep the pane useful with routines, recent artifacts, connection health, and selected bot context. Reference: [routines context panel](../docs/video-reference/screenshots/17-routines-context-panel.jpg).

### 2.6 Responsive behavior

- `>= 1280 px`: three panes.
- `1024–1279 px`: roster and chat stay visible; right pane becomes an overlay/drawer.
- `768–1023 px`: roster or chat is primary; context is a full-height sheet.
- `< 768 px`: one primary screen at a time. Home is the workforce inbox; chat, computer, routines, approvals, and settings are full-screen drill-ins.
- Preserve the selected conversation, draft, scroll position, run controls, and computer continuity across breakpoint changes.
- Never squeeze the desktop three-column design into unreadable mobile columns.

---

## 3. Page and surface specifications

For every surface below implement loading, empty, populated, permission-denied, offline/disconnected, stale, error, and recovery states.

### 3.1 Public/download entry

Purpose: explain the platform briefly and route an authenticated user to the web app or desktop client.

Required:

- BUILD BOT wordmark and concise value statement.
- Web launch and supported desktop download actions.
- Supported operating systems and version information.
- Sign in, documentation, status, privacy, and security links.
- Signed packages and update channel metadata when desktop clients exist.
- Do not reproduce the recording's branding or copy.

Observation reference: [platform download page](../docs/video-reference/screenshots/01-platform-download-page.jpg).

### 3.2 Workforce inbox/home

Purpose: resume any bot or group conversation immediately and understand what needs attention.

Required:

- Search, create, roster, unread/status markers, marketplace, and user menu.
- Truthful previews sourced from the latest visible message or run event.
- Create menu for custom bot, direct conversation, group conversation, routine, and mission.
- Filters for all, unread, working, approvals, scheduled, failed, and archived.
- Pinning and recency ordering.
- Empty state that invites bot creation or CHIEF conversation.

### 3.3 Direct bot conversation

Purpose: assign work, inspect progress, configure capability in context, and receive evidence-backed results.

Required workflow:

1. User sends an outcome.
2. Agent acknowledges and either acts, asks the minimum required question, or proposes a bounded plan.
3. If capability is missing, the agent emits a connection or permission card with clear choices.
4. A run record and plan appear when work begins.
5. Progress events stream from persisted execution events.
6. Computer/tool state appears in the right pane.
7. Approval pauses only the affected action.
8. Completion returns summary, evidence, artifacts, and next choices.
9. Failure returns what was attempted, the last verified state, retry options, and whether any side effect occurred.

### 3.4 Conversational bot creation

Purpose: create a useful custom bot without forcing the user through a long form.

Reference: [role onboarding](../docs/video-reference/screenshots/03-new-bot-role-onboarding.jpg), [custom answer and settings](../docs/video-reference/screenshots/04-new-bot-custom-answer-and-settings.jpg), and [research-bot onboarding](../docs/video-reference/screenshots/16-research-bot-onboarding.jpg).

Flow:

1. Create a draft bot immediately with temporary identity and `draft` state.
2. Ask the primary ownership question: what should this bot own?
3. Offer role-relevant quick answers plus `Something else` and free text.
4. Ask only the follow-ups needed to define outcomes, scope, frequency, sources, tools, prohibited actions, and reporting.
5. Update the settings panel live as answers are accepted.
6. Generate a reviewable configuration summary.
7. Run a sandbox test with fake or read-only data.
8. Require deployment confirmation when tool or schedule permissions are material.
9. On deploy, create a versioned bot configuration and add the bot to the roster.

Do not hide configuration behind chat. Keep an editable settings pane visible on desktop and a settings sheet on mobile.

### 3.5 Bot profile/settings

Reference: [agent profile settings](../docs/video-reference/screenshots/05-agent-profile-settings.jpg).

Sections:

- Identity: name, role label, description, avatar, color, pronouns/voice where relevant.
- Responsibility: objectives, outputs, reporting relationship, success measures, stop conditions.
- Instructions: organization overlay plus protected built-in role instructions.
- Knowledge/memory: approved sources, retrieval scope, retention, writable notes, exclusions.
- Tools/integrations: grants, account, scopes, test status, expiry, and revoke.
- Computer: workspace policy, allowed domains, download/upload rules, persistence, takeover.
- Autonomy: read/write categories, budgets, rate limits, recipient/domain limits, allowed hours.
- Approvals: exact categories, approver roles, expiry, escalation, emergency stop.
- Routines: schedules, next runs, last results, pause/run/edit.
- Collaboration: bots it may delegate to or receive tasks from.
- Notifications: completion, failure, approval, input-needed, quiet hours, channels.
- Versions: compare, publish, roll back, disable.
- Danger zone: archive/delete with dependency impact and recovery policy.

Every edit creates a versioned draft. Publishing records editor, diff, policy evaluation, and effective time. Running jobs retain the version they started with unless explicitly migrated.

### 3.6 Account/workspace menu

Reference: [account and workspace menu](../docs/video-reference/screenshots/06-account-and-workspace-menu.jpg).

Include:

- Current workspace and account identity.
- Workspace switcher.
- Subscription/plan and usage shortcut.
- Help/support and documentation.
- Settings.
- Add/switch account where supported.
- Sign out.

Never mix organization settings with personal preferences silently. Label the scope of every setting.

### 3.7 Global settings

Use a modal or dedicated settings destination with a left section list and stable deep links.

Required sections:

- General: language, timezone, date/time, theme, density, startup behavior, default workspace.
- Workspace: name, branding, members, roles, data region, retention, export.
- Computer: default session policy, allowed domains, downloads, persistence, reset/rebuild, isolation.
- Usage & billing: current plan, weekly/monthly usage, remaining allowance, quotas, overage policy, invoices, payment management.
- Updates/desktop: release channel, version, automatic updates, check for updates, computer image update, safe reset/recovery.
- Notifications: events, channels, quiet hours, per-bot overrides.
- Voice: voice notes/live calls, recording/transcript policy, voices, microphone test.
- Security: sessions, MFA/SSO, audit export, connection revocation, emergency stop.
- Developer/API where enabled: keys, webhooks, test environment, rate limits; key creation requires strong confirmation.

Reference: [usage and billing](../docs/video-reference/screenshots/07-global-settings-usage-and-billing.jpg) and [updates/computer](../docs/video-reference/screenshots/08-global-settings-updates-and-computer.jpg).

### 3.8 Routines

Purpose: convert natural-language recurring work into durable schedules.

Creation workflow:

1. User asks in chat, for example, `Every weekday at 09:00, review email and Slack and send me a needs-you brief.`
2. Agent parses timezone, cadence, sources, recipients, expected output, and approval policy.
3. If any essential field is ambiguous, ask one focused question.
4. Show a structured preview before activation when policy requires it.
5. Persist a routine definition and next occurrence.
6. Emit a `routine.created` or `routine.updated` chat event.
7. Show the routine immediately in the right pane.

Routine fields:

- Name and description.
- Owning bot.
- Organization timezone and canonical schedule.
- Natural-language schedule and machine schedule.
- Next occurrence and last occurrence.
- Input sources and connector accounts.
- Output destination and format.
- Approval policy.
- Overlap policy: skip, queue, or cancel/replace.
- Missed-run policy.
- Retry/backoff and maximum runtime.
- Active, paused, disabled, invalid, or connection-blocked state.
- Version and audit history.

Controls: edit, pause, resume, run now, duplicate, view history, delete. A material edit must not mutate an already-running occurrence.

Reference: [recurring routine execution](../docs/video-reference/screenshots/25-recurring-routine-execution.jpg).

### 3.9 Live computer and browser work

Purpose: let the user see and control real work without exposing credentials.

The recording describes a shared cloud-computer experience. BUILD BOT must provide the same continuity—agents can use common organization files, approved logged-in app sessions, and handoffs—without forcing unsafe shared process state. Implement a logical organization workspace with isolated per-run or per-agent execution sessions, controlled shared storage, and brokered credentials. The UI may present one continuous workspace while the backend enforces isolation and leases.

Computer viewer requirements:

- Live frame/video, connection state, current URL/app, current action, plan step, bot identity, elapsed time, and last verified event.
- View-only by default.
- Take-control handshake that pauses agent input before granting human input.
- Return-control handshake that snapshots state and requires agent re-observation.
- Pause, resume, stop, reconnect, and open full screen.
- Session recording/evidence policy and visible recording state.
- Downloads and artifacts surfaced in chat.
- Redaction for secrets and sensitive fields.
- Blocked-domain, permission, CAPTCHA, login, and MFA states.
- Crash recovery from the last safe checkpoint, not blind replay.

Credentials must be injected by a broker and never appear in prompts, logs, screenshots, recordings, or downloadable files. External pages such as [Gmail](../docs/video-reference/screenshots/13-external-gmail-page.jpg) and [Amazon](../docs/video-reference/screenshots/15-external-amazon-product-page.jpg) are execution targets only; do not clone their UI.

### 3.10 Integration-required cards

When an agent lacks access, it must stop before the attempted call and present an in-chat capability card.

The card includes:

- Missing capability and why it is needed.
- Candidate connector/account.
- Requested scopes in plain language.
- `Connect`, `Choose another account`, `Use another method`, and `Cancel` actions as applicable.
- Privacy/data-use note and link to connection details.

After authorization, show the selected account, granted scopes, health, and a `Connected` event before resuming. Never treat connection success as permission for an unrelated consequential action.

Reference: [connection action card](../docs/video-reference/screenshots/09-chat-action-card-connect-email.jpg) and [connected state](../docs/video-reference/screenshots/10-integration-connected-in-chat.jpg).

### 3.11 Marketplace home

Reference: [marketplace home](../docs/video-reference/screenshots/19-marketplace-home.jpg).

Purpose: discover reusable bot templates and integrations without leaving the active workspace.

Required:

- Search across bots and integrations.
- Installed count and installed-management entry.
- Featured bots.
- Personalized recommendations based on enabled product categories, never private message content unless explicitly allowed.
- Official BUILD BOT templates.
- Organization-approved/private templates.
- Category rows and `View all`.
- `Add`, `Import`, `Connect`, `Added`, `Update`, and `Unavailable by policy` states.
- Publisher identity, verification, version, last update, permissions, privacy link, rating/usage if trustworthy.

Marketplace content must be server-driven, paginated, searchable, and policy-filtered.

### 3.12 Bot-template detail

Reference: [bot-template detail](../docs/video-reference/screenshots/20-marketplace-bot-template-detail.jpg).

Show:

- Bot icon, name, publisher, verification, short description, and import action.
- Version, update date, compatibility, and required plan.
- Instructions summary.
- Seed memories/knowledge.
- Skills/playbooks.
- Routines created by import.
- Integration and scope requirements.
- Computer/domain requirements.
- Approval defaults.
- Data accessed, retained, and transmitted.
- Changelog and reviews where available.

Import creates an organization-owned draft copy. Do not execute or connect anything during preview. Before deployment, show the full permission diff and allow the user to remove optional capabilities.

### 3.13 Integrations catalog

Reference: [integrations catalog](../docs/video-reference/screenshots/21-marketplace-integrations-catalog.jpg).

Organize connectors by categories such as featured, BUILD GROWTH, communication, email/calendar, files, CRM, finance, productivity, research, password/credential management, and developer tools.

Each item shows icon, name, short capability summary, publisher, status, and action. Connection detail shows accounts, scopes, bots using it, health, last successful call, token expiry, recent errors, test, reconnect, and revoke.

Revocation must stop new calls immediately. Runs waiting on the connector move to a blocked state; they do not silently continue using cached credentials.

### 3.14 Group-chat creation

Reference: [participant picker](../docs/video-reference/screenshots/22-group-chat-participant-picker.jpg) and [group composer](../docs/video-reference/screenshots/23-group-chat-composer.jpg).

Flow:

1. Create group.
2. Search/select bots; show selected participants as removable chips.
3. Add group name automatically from participants with an editable override.
4. Optional objective, linked mission/record, and default coordinator.
5. Type the first request and send.
6. Persist the group and participant membership atomically with the first message.

Prevent duplicate selection, disabled bots, cross-tenant bots, and unauthorized custom bots. Warn when a bot lacks required data/tool access.

### 3.15 Group conversation and delegation

Reference: [agent delegation](../docs/video-reference/screenshots/24-group-chat-agent-delegation.jpg).

Required:

- Header shows participant avatars and names.
- Every agent message names the speaker.
- Mentions route attention but do not bypass permission checks.
- CHIEF or assigned coordinator decomposes the user's objective.
- Delegation appears as a structured card containing task, owner, inputs, constraints, due time, status, and expected output.
- Agents can report progress, blocker, partial result, or completion.
- Coordinator consolidates outcomes and identifies unresolved decisions.
- User can pause/cancel an individual subtask without cancelling unrelated work.
- Agent-to-agent messages are bounded by task and message budgets.

### 3.16 Voice-call modal

Reference: [voice-call modal](../docs/video-reference/screenshots/14-voice-call-modal.jpg).

Required states:

- Incoming, ringing, connecting, connected, muted, held, reconnecting, ended, failed, and declined.
- Caller/channel identity, purpose, timer, audio device, mute, accept, end, and optional transcript controls.
- Clear consent/recording indicator.
- Conversation linkage and transcript retention policy.
- Handoff between voice and text with a written summary.

Voice instructions have the same authorization and approval requirements as text. Never treat voice identity as sufficient authorization for high-risk actions.

### 3.17 Results, evidence, artifacts, and next choices

Reference: [result with evidence and choice card](../docs/video-reference/screenshots/18-results-with-evidence-and-choice-card.jpg), [document preview](../docs/video-reference/screenshots/11-computer-artifact-document-preview.jpg), and [contextual agent tools](../docs/video-reference/screenshots/12-contextual-agent-tools-menu.jpg).

A strong result block includes:

- Direct answer first.
- Method/constraints when material.
- Ranked or grouped findings.
- Source links and retrieval time.
- Screenshot/evidence gallery with captions.
- Artifact cards with type, size, version, scan state, download, and linked run.
- Explicit caveats, missing data, and confidence.
- Follow-up choices plus custom text.
- Whether any external side effect occurred.

Artifacts are immutable by version. Editing produces a new version with lineage. Downloads use signed, expiring URLs and authorization checks.

---

## 4. Agent runtime and execution model

### 4.1 Core entities

At minimum persist:

- Organization, workspace, user, membership, role, and policy.
- Bot, bot version, capability, tool grant, memory source, and notification preference.
- Conversation, participant, message, message block, attachment, and read state.
- Mission, task, dependency, delegation, run, attempt, and checkpoint.
- Routine, routine version, occurrence, schedule claim, and next occurrence.
- Connector, connection, account, scope grant, token reference, and health event.
- Computer workspace, session, lease, input owner, snapshot, frame/evidence reference.
- Proposed action, policy evaluation, approval request, decision, and execution receipt.
- Artifact, artifact version, citation, evidence item, and BUILD GROWTH record link.
- Usage meter, quota, invoice reference, notification, and immutable audit event.

All records must be organization scoped. Use stable opaque IDs. Store timestamps in UTC and preserve the organization timezone for display and scheduling decisions.

### 4.2 Run state machine

Use a durable workflow engine. Minimum states:

`created -> queued -> planning -> running -> waiting_for_connection | waiting_for_input | waiting_for_approval | paused -> running -> verifying -> completed | partial | failed | cancelled | expired`

Rules:

- State changes are server-authoritative and evented.
- Every transition records actor, reason, timestamp, version, and correlation IDs.
- `waiting_for_approval` freezes the exact proposed action, not the entire unrelated mission.
- Cancellation is cooperative first, then enforced after a bounded grace period.
- Retry is bounded and idempotent. Never retry a consequential write without an idempotency key and execution receipt.
- Completion requires output verification, not merely tool return.
- Partial completion identifies completed and incomplete objectives separately.

### 4.3 Execution loop

For each user or scheduled request:

1. Authenticate user/service principal and resolve organization.
2. Load conversation, selected bot version, linked records, and permitted context.
3. Classify intent, risk, required tools, expected output, and ambiguity.
4. Ask the minimum clarifying question only when the answer materially changes the action.
5. Create a structured plan with bounded steps and stop conditions.
6. Evaluate capabilities, connector scopes, computer policy, budget, and approval policy.
7. Emit the plan/delegation into the conversation.
8. Acquire leases for tools/computer resources.
9. Execute one observable step at a time.
10. Persist events, checkpoints, evidence, and resource usage.
11. Before a consequential action, create an exact proposed-action payload and evaluate policy.
12. Wait for approval when required; reject stale approvals if the payload changes.
13. Verify effects through an independent read when possible.
14. Generate a concise result with evidence and caveats.
15. Release leases and update conversation, routine, reports, notifications, and audit.

### 4.4 Delegation

Delegation payload must include:

- Parent run/task.
- Delegating bot and assignee bot.
- Objective and expected output schema.
- Allowed data, tools, connector accounts, computer workspace, and budget.
- Constraints, deadline, and stop conditions.
- Approval inheritance rules.
- Return channel and verification requirement.

An assignee cannot gain permissions from the delegator. Effective authority is the intersection of organization policy, delegator grant, assignee grant, connector scope, and current user delegation.

### 4.5 Memory

Separate:

- Conversation history.
- Organization knowledge.
- Bot-private working memory.
- User-specific preferences.
- Linked business records.
- Run scratch state.
- Durable verified facts.

Every memory item needs provenance, scope, retention, sensitivity, confidence, and last verification. Do not promote model output to durable fact without evidence or explicit user confirmation.

---

## 5. Approvals and policy

### 5.1 Risk categories

Classify at least:

- Read-only public research.
- Read-only private data.
- Reversible internal write.
- External communication.
- Financial commitment.
- Legal/tender/contract submission.
- Credential/access change.
- Destructive action.
- Sensitive personal/regulated data.
- Computer takeover or broad automation.

### 5.2 Exact-action approval

An approval request contains:

- Bot, user, run, and organization.
- Connector/computer and exact account.
- Operation name and normalized parameters.
- Recipient/destination/record identifiers.
- Full content or a deterministic content hash plus reviewable preview.
- Amount/currency where relevant.
- Record version and expected precondition.
- Policy rule and reason.
- Supporting evidence.
- Expiry and idempotency key.

Approve, reject, or request changes. Approval is single-use. If recipient, content, amount, record version, attachment, or operation changes materially, invalidate it and request a new approval. Persist an execution receipt proving the approved action executed at most once.

### 5.3 Emergency controls

Provide organization stop, bot disable, run cancel, connector revoke, computer revoke, and schedule pause. These controls must be server enforced and reflected in active workers within a bounded time.

---

## 6. APIs and real-time events

Implement versioned APIs for:

- Auth/workspaces/memberships.
- Bots and bot versions.
- Conversations, messages, attachments, groups, read state.
- Missions, tasks, delegations, runs, attempts, pause/resume/cancel.
- Routines and occurrences.
- Marketplace templates and imports.
- Connectors, accounts, scopes, health, reconnect, revoke.
- Computers, sessions, frames, control lease, pause/resume/stop.
- Proposed actions, approvals, decisions, receipts.
- Artifacts, citations, evidence, downloads.
- Usage, billing summary, notifications, settings, audit.

Use a resumable event channel (SSE or WebSocket) with monotonic sequence numbers. Clients must reconnect with a cursor, deduplicate events, and fall back to a snapshot. Event types should include:

`message.created`, `message.block.updated`, `run.state_changed`, `plan.updated`, `task.delegated`, `tool.started`, `tool.completed`, `computer.frame_available`, `computer.input_owner_changed`, `approval.requested`, `approval.decided`, `routine.created`, `routine.occurrence_started`, `artifact.created`, `connection.health_changed`, `usage.updated`, and `notification.created`.

The event stream is not the source of truth; durable database/workflow state is.

---

## 7. Visual system

### 7.1 Appearance

- Light mode: white foundation, near-black text, neutral gray secondary surfaces.
- Dark mode: true black or near black foundation, white text, charcoal raised surfaces.
- Agent colors appear in avatars, small status accents, selected rows, and subtle glows—not as large saturated backgrounds.
- Use supplied BUILD BOT robot imagery with consistent crops and dark/light treatments.
- Compact density: 8 px base spacing; common gaps 8/12/16/24; touch targets at least 44 px on touch devices.
- Modest 8–12 px radii, 1 px borders, restrained shadows.
- System or licensed sans-serif type with compact metrics.
- Motion 120–220 ms for pane transitions and state changes. Respect reduced motion.

### 7.2 Semantics

- Blue/brand: selection and primary action.
- Green: verified completion/healthy.
- Amber: waiting, scheduled soon, or caution.
- Red: failure, destructive, revoked, or urgent approval.
- Gray: idle, disabled, or unavailable.
- Never encode state by color alone.

### 7.3 Accessibility

- WCAG 2.2 AA contrast.
- Complete keyboard operation, visible focus, logical reading order.
- Screen-reader labels for bots, statuses, unread counts, run controls, evidence, and approvals.
- Live-region announcements for meaningful run changes, throttled to avoid noise.
- Captions/transcripts for voice.
- Alt text and textual summaries for screenshots/artifacts.
- Zoom to 200% without loss of function.
- Reduced motion and high-contrast support.

---

## 8. Required states and edge cases

Implement and test:

- First-run empty workspace.
- No bots, no conversations, no routines, and no connections.
- Long names, multilingual content, RTL, and large attachments.
- Offline client and reconnect with unsent draft.
- Duplicate send, duplicate webhook, duplicate schedule claim.
- Worker restart during planning, tool use, approval wait, and verification.
- Connector token expiry during a run.
- Revoked permission after planning but before execution.
- Computer disconnect, crash, takeover conflict, and stale frame.
- Approval expires or is based on an outdated record version.
- User edits bot configuration during an active run.
- Routine overlap and missed occurrence across daylight-saving changes.
- Partial tool failure after one side effect succeeded.
- Evidence upload failure after task completion.
- Quota exhausted before or during execution.
- Bot archived while referenced by a routine/group.
- User removed from organization while a session is open.
- Cross-tenant ID probing and event-stream isolation.

No error may leave the user uncertain whether an external action occurred. Reconcile and state `confirmed executed`, `confirmed not executed`, or `execution state unknown—manual verification required`.

---

## 9. Security and privacy

- Enforce tenant isolation in API authorization and database policy.
- Encrypt data in transit and at rest; secrets live in a dedicated secret store.
- Connector tokens are never sent to the browser.
- Sanitize/scan uploads and downloaded computer artifacts.
- Treat emails, webpages, documents, tool output, and agent output as untrusted input.
- Apply prompt-injection defenses at retrieval and tool boundaries.
- Use domain/network egress controls for computer sessions.
- Redact secrets from screenshots, logs, traces, and model context.
- Immutable audit events for auth, configuration, connection, approval, computer control, and consequential actions.
- Data retention and deletion are organization configurable and legally compliant.
- Provide export and deletion workflows with dependency and recovery disclosure.

---

## 10. BUILD GROWTH integration

BUILD GROWTH remains authoritative for construction opportunities, companies, contacts, pipeline, tenders, estimates, quotes/BOQs, invoices, and payments. BUILD BOT supplies governed workforce execution.

Requirements:

- One identity and organization mapping.
- Deep links in both directions.
- Record context chip in conversation with type, identifier, version, and last refresh.
- Reads and writes through documented APIs/events only.
- Optimistic concurrency on record writes.
- Exact-action approval for sensitive submissions, communications, pricing, invoices, payments, and deletions.
- A visibly labeled fixture adapter until the real BUILD GROWTH contract is inspected.
- Never invent endpoints, schemas, or available records from a pitch deck.

---

## 11. Delivery sequence

### Phase 1 — Shell and durable chat

- Responsive three-panel shell and mobile inbox.
- Organization auth and tenant-scoped bots/conversations/messages.
- CHIEF plus seeded manager identities.
- Draft persistence, unread state, search, direct chat, real-time reconnect.

Exit: two users in different organizations cannot see each other's bots, messages, events, or attachments; chat survives restart.

### Phase 2 — One real agent vertical slice

- CHIEF plans and delegates bounded public research to Intelligence Manager.
- Durable run/task/event model.
- Pause/cancel, citations, artifact, and audit.

Exit: request -> delegation -> verified evidence-backed result after reload.

### Phase 3 — Bot creation and routines

- Conversational creation, settings, versioning, sandbox, deployment.
- Timezone-aware routines, schedule claims, pause/resume/run-now/history.

Exit: a custom read-only research bot can be created, scheduled, restarted, and audited without duplicate occurrence execution.

### Phase 4 — Integrations and approvals

- Marketplace/catalog, one production connector, connection cards, health/revoke.
- Exact-action approval and single-use execution receipt.

Exit: authorized reads work; a sensitive write waits on its exact action; changed content invalidates approval.

### Phase 5 — Computer execution

- Isolated browser/computer sessions, logical shared workspace, live viewer, takeover, evidence, artifact transfer, recovery.

Exit: an agent completes browser work while the user watches, pauses, takes control, returns control, and receives evidence.

### Phase 6 — Groups, voice, marketplace templates

- Group creation, bounded delegation, consolidated result.
- Voice notes/live call states and transcripts.
- Template preview/import and permission review.

Exit: a group completes a multi-agent objective without permission escalation or endless chatter.

### Phase 7 — Full workforce and BUILD GROWTH

- Role-specific tool packs, reports, billing/usage, notifications, full settings.
- Production BUILD GROWTH adapter only after contract discovery.
- Security, accessibility, load, recovery, and tenant-isolation validation.

---

## 12. Acceptance journeys

Automate at least these end-to-end journeys:

1. Owner signs in, sees CHIEF and managers, searches roster, opens a direct chat, reloads, and retains selection/draft/read state.
2. Owner asks CHIEF for research; CHIEF delegates; Intelligence Manager completes; citations and evidence open; audit matches timeline.
3. Owner creates a custom bot conversationally, edits settings, runs sandbox test, deploys, and finds it in the roster.
4. Agent requests an email connector; owner connects the exact account/scopes; health is visible; run resumes.
5. Sensitive external message produces an approval; owner edits requested changes; original approval cannot execute; new exact approval executes once.
6. Owner creates a weekday routine in natural language; next run is correct for organization timezone; restart does not duplicate it.
7. Routine runs with an expired connector and becomes visibly blocked; reconnect resumes according to policy.
8. Computer run shows current action; owner takes control; agent input stops; owner returns control; agent re-observes before acting.
9. Computer crashes mid-run; recovery resumes from safe checkpoint or returns a truthful partial result.
10. Owner creates a group with CHIEF, Finance, and Operations; CHIEF delegates; independent subtasks complete; CHIEF consolidates.
11. Marketplace template preview shows all capabilities; import creates a draft; optional permissions can be removed before deploy.
12. Voice call creates transcript and summary; an attempted consequential command still requires approval.
13. Quota exhaustion pauses cleanly without losing the run; usage screen reconciles with metering records.
14. Connector revocation blocks new calls immediately and updates affected bots/routines.
15. Cross-tenant access attempts fail at API, event stream, artifact URL, and computer session layers.
16. All desktop/tablet/mobile breakpoints pass keyboard, screen-reader, focus, contrast, and reduced-motion checks.

---

## 13. Definition of done

BUILD BOT is not done because screenshots look similar. It is done only when:

- The chat-first shell, creation flow, routines, marketplace, integrations, groups, voice, computer viewer, settings, and result cards work against real APIs and durable state.
- Every consequential action is policy checked, idempotent, auditable, and approval bound when required.
- Runs and schedules recover correctly after restart.
- The user can always tell what is happening, which bot is acting, which account/computer is used, whether a side effect occurred, and what needs attention.
- Results include verifiable evidence and do not fabricate business data.
- Tenant isolation, revocation, accessibility, responsive behavior, and error recovery pass automated tests.
- BUILD BOT uses original implementation, branding, and assets while preserving the useful interaction quality observed in the recording.

When a requirement is not implemented, expose an honest unavailable state and record it in the implementation checklist. Never replace missing behavior with a fake animation or static mock.

