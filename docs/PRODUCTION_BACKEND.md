# Production backend status and activation runbook

This repository contains a working local control-plane alpha plus production foundations. A foundation is not a claim that an external provider or cluster has been deployed.

## Implemented and locally verified

- Gemini 3.1 Flash-Lite interactive provider with a mocked acceptance path when no key is configured.
- Bounded Gemini function-calling loop with a maximum tool-step count.
- Read-only bot-computer tools protected by tenant scope and an exclusive lease.
- Exact-action approval for click, text-fill and credential-fill operations.
- An ephemeral, single-consumption credential broker. Secret values remain in process memory, are never written to SQLite, and expire automatically.
- Durable job records with idempotency keys, bounded leases, retry classification, cancellation fields and unit budgets.
- Gemini Batch queue and status adapter. Jobs can be queued without credentials and submitted after `GEMINI_API_KEY` is supplied.
- A scoped Google Sheets service-account adapter for connection verification and explicit range reads/updates. It remains disabled until credentials and a dedicated fictional sheet are supplied.
- Security headers, request IDs and per-address API/auth rate limiting.
- Consistent local SQLite backup with a SHA-256 manifest (`npm run backup`).
- PostgreSQL control-plane schema baseline with forced tenant row-level security.
- Kubernetes namespace, RBAC, default-deny networking, API deployment and gVisor computer pod/PVC templates.
- TLS ingress and External Secrets templates with deliberately invalid `replace.*` placeholders so they cannot be mistaken for a deployed production configuration.

## Host activation still required

Docker Desktop is installed, but the Windows host still reports that WSL is not installed. From an Administrator PowerShell run:

```powershell
cd "C:\Users\elias\OneDrive\Documents\ChatGPT\build-bot-colleague-zero"
powershell -ExecutionPolicy Bypass -File .\scripts\enable-wsl.ps1
```

Restart Windows if requested, open Docker Desktop, and run:

```powershell
npm run computer:doctor
npm run computer:build
npm run dev
```

Start one active bot computer from the BUILD BOT UI. Validate Chromium navigation, text extraction, screenshot, owner takeover, lease conflict, credential fill, and noVNC reconnect before starting more computers.

## Credentials and external accounts still required

- `GEMINI_API_KEY` for live interactive, mission, multimodal, voice-token and Batch model calls.
- `COLLEAGUE_ZERO_GOOGLE_SERVICE_ACCOUNT_JSON` plus a dedicated fictional spreadsheet for Google Sheets verification.
- Provider choices, OAuth applications, scopes, test tenants and sandbox accounts for LMS, email and calendar. No generic backend can safely invent these contracts.
- A production secret-vault integration. The current broker deliberately holds only short-lived values in one process and is not a distributed vault.

## Production migration still required

The PostgreSQL schema is in `infra/postgres/001_control_plane.sql`, but the Node alpha still uses synchronous SQLite. Moving the application requires a PostgreSQL repository adapter, data migration, RLS integration tests, connection pooling and cutover/rollback rehearsal. Kubernetes manifests are templates and cannot be deployed on this PC until Kubernetes or a remote cluster is available.

Before real student data, complete malware scanning/OCR hardening, encryption-at-rest, retention/deletion workflows, centralized logs/metrics, alerting, restore drills, TLS ingress, external secret management, container scanning and an independent security/privacy review.
