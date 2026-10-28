# Data model and API contract

## Core data model

All tenant-owned tables include `organization_id`, timestamps, and a stable UUID. Apply PostgreSQL row-level security in addition to application authorization.

| Domain | Principal records | Essential fields/relations |
| --- | --- | --- |
| Identity | organizations, users, memberships, roles | organization settings/timezone; user identity; membership role/status |
| Subscription | plans, subscriptions, usage_ledger, invoices | provider references, limits, metered model/tool/computer usage |
| Workforce | agent_templates, agents, agent_versions, reporting_lines | built-in/custom type, role, instructions, avatar, model policy, state, active version |
| Permissions | capabilities, agent_grants, user_grants, policy_rules | resource/action/scope, limits, effect, priority, conditions, version |
| Knowledge | knowledge_sources, documents, chunks, memories | owner/scope, provenance, retention, embedding, sensitivity, supersession |
| Conversation | conversations, participants, messages, attachments | individual/group type, sender, content parts, task/action references, sequence |
| Planning | missions, mission_versions, goals, tasks, dependencies, routines | schedule, owner, assignee, measurable target, state, policy snapshot |
| Execution | runs, run_steps, tool_calls, action_proposals, execution_events | workflow id, idempotency key, input/output references, state, trace id |
| Approval | approval_requests, approval_decisions | immutable action hash, preview, policy reason, expiry, decision actor/time |
| Integration | connector_definitions, connections, connection_scopes | provider, account label, encrypted credential reference, scopes, status |
| Computers | computers, computer_sessions, leases, snapshots | one active computer per agent, provider id, image version, volume id, state |
| Evidence | artifacts, screenshots, citations | object key, hash, mime type, redaction state, source and run relationship |
| Reporting | reports, report_sections, metric_snapshots | period, report type, evidence references, unavailable/estimated flags |
| Audit | audit_events | append-only actor/action/target, before/after reference, request and trace ids |

Do not store OAuth tokens or passwords directly in business tables. Store a reference to an external secrets vault entry. Encrypt especially sensitive application fields where required.

## State machines

### Task

`draft -> queued -> planning -> waiting_dependency -> ready -> running -> awaiting_approval -> verifying -> completed`

Terminal alternatives: `cancelled`, `failed`, `expired`. `paused` is resumable. Only the workflow engine writes execution state; API handlers issue commands.

### Approval

`pending -> approved | rejected | expired | withdrawn | superseded`

Approval binds to `action_hash`, policy version, preview, actor, scope, and expiry. A material change produces a new proposal and supersedes the old request.

### Computer

`provisioning -> stopped -> starting -> ready -> leased -> stopping -> stopped`

Alternatives: `paused`, `recovering`, `failed`, `quarantined`, `deleting`. A separate session tracks live viewing/control.

## HTTP API outline

Version all routes under `/api/v1`. Use cursor pagination, explicit idempotency keys for commands, and consistent problem responses.

### Identity and organization

- `GET /me`
- `GET/PATCH /organizations/{org_id}`
- `GET/POST /organizations/{org_id}/members`
- `PATCH/DELETE /organizations/{org_id}/members/{membership_id}`

### Agents

- `GET/POST /agents`
- `GET/PATCH /agents/{agent_id}`
- `POST /agents/{agent_id}/versions`
- `POST /agents/{agent_id}:activate|pause|resume|archive`
- `GET /agents/{agent_id}/capabilities`
- `PUT /agents/{agent_id}/grants`
- `GET /agents/{agent_id}/memory`

### Conversations

- `GET/POST /conversations`
- `GET/PATCH /conversations/{conversation_id}`
- `GET/POST /conversations/{conversation_id}/messages`
- `POST /conversations/{conversation_id}/participants`
- `DELETE /conversations/{conversation_id}/participants/{participant_id}`
- `POST /attachments:prepare-upload`

### Missions, tasks, routines

- `GET/POST /missions`
- `GET/PATCH /missions/{mission_id}`
- `POST /missions/{mission_id}:propose|approve|activate|pause|resume|cancel|duplicate`
- `GET/POST /missions/{mission_id}/tasks`
- `GET/PATCH /tasks/{task_id}`
- `POST /tasks/{task_id}:pause|resume|cancel|retry`
- `GET/POST/PATCH/DELETE /routines...`

### Runs, events, artifacts

- `GET /runs`
- `GET /runs/{run_id}`
- `GET /runs/{run_id}/steps`
- `GET /runs/{run_id}/events`
- `GET /runs/{run_id}/artifacts`
- `GET /events/stream?after={sequence}`

### Approvals

- `GET /approvals`
- `GET /approvals/{approval_id}`
- `POST /approvals/{approval_id}:approve`
- `POST /approvals/{approval_id}:reject`
- `POST /approvals/{approval_id}:request-changes`

Decision commands include the approval version and action hash to prevent stale approval.

### Integrations

- `GET /connectors`
- `GET/POST /connections`
- `POST /connections/{connection_id}:authorize|test|revoke`
- `GET /connections/{connection_id}/scopes`
- `PUT /connections/{connection_id}/scopes`

### Computers

- `GET /computers`
- `GET /computers/{computer_id}`
- `POST /computers/{computer_id}:start|pause|resume|stop|reset`
- `POST /computers/{computer_id}/sessions`
- `POST /computer-sessions/{session_id}:take-control|return-control|close`
- `GET /computer-sessions/{session_id}/stream-token`

### Reports and settings

- `GET /reports`
- `GET /reports/{report_id}`
- `POST /reports/{report_id}:export|speak`
- `GET/PATCH /settings/{section}`

## Event types

Minimum event vocabulary:

- `message.created`
- `mission.proposed`, `mission.activated`, `mission.completed`
- `task.delegated`, `task.started`, `task.progressed`, `task.blocked`, `task.completed`, `task.failed`
- `plan.created`, `plan.revised`
- `tool.requested`, `tool.succeeded`, `tool.failed`
- `action.proposed`, `action.authorized`, `action.denied`, `action.executed`
- `approval.requested`, `approval.decided`, `approval.expired`
- `computer.state_changed`, `computer.session_started`, `computer.control_changed`
- `artifact.created`, `evidence.attached`
- `report.generated`
- `agent.status_changed`

Use JSON Schema with versioned payloads. Large or sensitive bodies belong in access-controlled storage and are referenced by id.

## Report provenance

Every report assertion carries one or more provenance links to a goal, task, run step, connector record, metric snapshot, or artifact. The report builder must label estimates and unavailable fields. Narrative generation may summarize evidence but cannot create unsupported metrics.

