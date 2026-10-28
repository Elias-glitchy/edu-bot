# ADR 0001: local research pilot before production stack

Status: interim, 13 October 2026.

The kit specifies a production monorepo with Next.js, FastAPI, PostgreSQL, Temporal, Redis, object storage, and isolated Linux computers. This checkout had no application code. The current host has Node.js 24, but no Docker executable and no installed production services. A self-contained Node/SQLite slice makes the first owner-to-CHIEF-to-Intelligence journey runnable and testable now. The design is intentionally narrow and must not be presented as completion of Phases 0–2.

The pilot uses a single HTTP process, SQLite persistence, an explicit research-only command, and a read-only Wikipedia adapter. Task state is recorded before execution; running read-only tasks are requeued on restart. Agent status derives from tasks. Research source failure is surfaced to the user. Organization IDs scope every query used by the UI and task controls. Tests cover basic cross-tenant denial. SQLite application scoping is not a substitute for PostgreSQL row-level security.

Migration to the specified stack should preserve the API and event vocabulary while replacing local identity, storage, and worker execution. Production deployment requires PostgreSQL RLS, durable workflow and outbox, capability policy, approval engine, Linux workspace isolation, and provider-backed monitoring. Do not use this pilot for sensitive data or external side effects.
