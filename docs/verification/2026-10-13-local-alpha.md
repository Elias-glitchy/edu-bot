# Local alpha verification — 13 October 2026

Environment: Windows local workspace, Node.js 24.19.0. The repository has no initial commit, so no Git revision is available.

| Check | Result |
| --- | --- |
| JavaScript syntax checks for API, store, domain, approvals, research, and UI | Pass |
| Automated HTTP tests for registration, delegation, result, tenant isolation, and task controls | Pass |
| Group, mission, report, and custom profile journeys | Pass |
| Exact-action approval: correct hash, cross-tenant denial, once-only execution, supersession, rejection | Pass |
| Browser check: navigation, mission, local CRM, approval decision | Pass |

Commands: `node --check` on application modules and `npm test` (5 passed). The HTTP/browser checks ran against local loopback with fixture research, not a production deployment or live external connector. The browser test used an in-memory database and did not create a user in the persistent workspace database.

Known limitations: the approval integration is an internal SQLite contact-note write only; research uses a bounded Wikipedia adapter; reports are manually generated; custom agents are profiles; missions are single-run. No production deployment, PostgreSQL/Temporal stack, external connectors, Linux computers, billing, voice, or scheduled routines have been verified. Back up the local SQLite file before replacing or migrating it.
