# Direct bots and routines verification — 13 October 2026

The seven automated tests pass on the local Node/SQLite alpha. New journeys verify a built-in manager's direct research conversation, tenant denial, timezone scheduling including a US daylight-saving gap, research/report routine execution, once-per-occurrence behavior, in-app notifications, and no duplicate run after server restart. Syntax checks pass for the modified server, store, domain, scheduling module, and browser script.

This verifies a bounded public research capability for each built-in manager, not a specialized finance, sales, bid, or other tool pack. The research adapter is the same Wikipedia search across managers. Scheduling depends on the local server running; recovery claims one missed occurrence after restart. There is no external notification service or hosted scheduler. Further production acceptance tests remain open in `planning/07_ACCEPTANCE_TESTS.md`.
