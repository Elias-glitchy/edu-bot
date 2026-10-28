# Research pilot verification — 13 October 2026

Environment: Windows local workspace, Node.js 24.19.0. Repository has no initial commit; Git revision is unavailable.

| Check | Result |
| --- | --- |
| JavaScript syntax checks for API, store, research, UI | Pass |
| Local HTTP journey: register, seed 11 agents, delegate, result, reload | Pass |
| Cross-organization task access | Denied (404) |
| Unsupported external action request | Rejected (400) |
| Pause, resume, cancel | Pass in automated HTTP test |
| Live Wikipedia search adapter | HTTP 200; returned five real links for “solar energy South Africa” |
| Desktop visual check | Pass: auth, CHIEF, delegated result, workforce |

Commands: `node --check` on the application modules, `npm test` (3 passed), and a direct read-only research-adapter invocation. HTTP tests required local loopback access outside the restricted sandbox. The live source also required network access outside that sandbox. The browser check used a separate in-memory fixture instance and left no test account in the persistent database.

This report verifies only the local research pilot. The full phase exits and production-like acceptance journeys in `planning/07_ACCEPTANCE_TESTS.md` have not run. Docker, PostgreSQL, Temporal, isolated Linux computers, approval enforcement, and billing are absent. No migrations or rollback scripts exist for the pilot schema; the SQLite file is local and should be backed up before replacing it.
