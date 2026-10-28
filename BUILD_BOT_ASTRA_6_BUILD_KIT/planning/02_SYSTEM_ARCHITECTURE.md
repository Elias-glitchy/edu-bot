# System architecture

## Service boundaries

```text
Browser / Mobile Web / BUILD GROWTH embedded surface
        |
        v
Next.js Web Application
        |
        v
FastAPI Gateway  ---- WebSocket/SSE event stream
   |        |        |         |          |
   v        v        v         v          v
Postgres   Redis   Object    Temporal   Provider adapters
                  storage    workflows  (models/connectors/voice)
                                |
                                v
                         Agent workers
                                |
                     Policy + action gateway
                       /                \
                      v                  v
             Connector workers     Computer broker
                                          |
                               Dedicated bot Linux workspaces
```

## Monorepo layout

```text
apps/
  web/                 Next.js product UI
  api/                 FastAPI HTTP and realtime API
  worker/              Temporal workers and agent runtime
  computer-gateway/    authenticated stream/control gateway
packages/
  ui/                  design tokens and shared components
  contracts/           generated TypeScript clients and event schemas
  config/              shared lint/build/runtime configuration
services/
  computer-image/      hardened Linux workspace image
  automation-sidecar/  browser/desktop automation service
infra/
  compose/             local stack
  kubernetes/          production manifests/Helm
  terraform/           cloud resources
docs/
  adr/                 architecture decisions
  verification/        phase results and runbooks
```

Keep Python and TypeScript boundaries connected through an OpenAPI contract plus versioned event schemas. Generate clients; do not duplicate request/response types by hand.

## Control plane and execution plane

The control plane owns organizations, identity, configuration, conversations, missions, tasks, policies, approvals, events, reports, billing metadata, and computer lifecycle state.

The execution plane runs agent reasoning, connector calls, and Linux-computer actions. It receives short-lived scoped execution grants, not broad user credentials. All results return through the action gateway and append execution events before UI status changes.

## Durable workflow model

Temporal workflows provide:

- Mission activation and dependency resolution.
- Task planning, delegation, execution, verification, and completion.
- Recurring schedules in organization timezones.
- Pauses for approval without holding a worker process.
- Retry policies with idempotency keys and backoff.
- Cancellation, interruption, and restart recovery.
- Daily and weekly report generation.
- Computer provisioning/start/stop leases.

Long-running state must not depend on in-process queues or Redis alone.

## Realtime delivery

Persist events first, then publish them. The web client subscribes by organization and conversation/run through WebSocket or SSE. On reconnect, the client resumes after its last event sequence. Events include a schema version, unique id, tenant id, timestamp, actor, entity, type, visibility, and payload reference.

## Provider interfaces

Define interfaces for:

- Text/reasoning model and model router.
- Embeddings.
- Speech-to-text and text-to-speech.
- Email, calendar, CRM, accounting, and storage connectors.
- BUILD GROWTH domain API, event stream, embedded-context validation, and deep-link adapter.
- BUILD BID adapter boundary for tender discovery, bid/no-bid, proposal, estimating, compliance, submission, and learning workflows when that product contract is available.
- Object storage and malware scanning.
- Notifications.
- Linux computer provisioning and streaming.

Local adapters must support development and automated acceptance tests without claiming to be production providers.

## Deployment environments

- Local: Docker Compose for Postgres/pgvector, Redis, Temporal, object storage, API, worker, web, and one test Linux workspace.
- Preview: isolated database/schema and object prefix per branch, controlled test providers.
- Staging: production-equivalent identity, networking, workflow, secrets, and workspace runtime with synthetic organizations.
- Production: high-availability data plane, encrypted backups, private networks, sandboxed workspaces, centralized telemetry, and controlled releases.

## Reliability requirements

- Idempotent action execution using stable action keys.
- Optimistic concurrency/version fields on mutable business records.
- Outbox pattern for database-to-event publication.
- Workflow retry classifications: transient, user action required, policy denied, permanent.
- Graceful reconnect for chat and computer viewing.
- Point-in-time database recovery and tested restore procedures.
- Artifact integrity hashes and retention lifecycle.
- Per-bot computer lease prevents conflicting UI automation by default.

## Observability

Every request and task run receives a trace id. Logs contain identifiers and outcomes, not secrets or raw sensitive payloads. Metrics cover API latency/errors, workflow lag, task success/failure, approval wait time, computer startup time, session failures, provider cost, token use, and tenant-level quotas. Alerts link to runbooks.

