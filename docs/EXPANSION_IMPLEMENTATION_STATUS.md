# BUILD BOT 2.0 Astra expansion — implementation status

Updated: 2026-10-30

## Running now

- Additive SQLite migrations preserve the eleven protected academic bots, avatar mappings, histories and computer records.
- `GET /api/capabilities` and Settings show local, disabled and `awaiting_credentials` states without claiming hosted services are live.
- MCP/Composio/Zapier-compatible Streamable HTTP discovery, versioned tool catalogs, deferred policy-filtered search, deny-by-default grants, read/write risk classification, exact-action approvals, sanitized receipts, connector call budgets, revocation and removal cleanup.
- Sourced memory with organization/user/course/bot/mission scope, review, revision history, expiry-aware keyword retrieval, export and exact-scope purge. Credential-like content is rejected.
- Twelve protected academic skill manifests, immutable versions, validation, deterministic tests, approval/activation/deprecation, protected bot/role assignment checks, import/export and redacted “watch me once” draft recordings.
- Tenant-scoped document collections, ACLs, versions, signature/size/checksum validation, PDF/DOCX/PPTX/XLSX/CSV/TXT/JSON extraction, optional broker/mock OCR text, chunk search, citations and version comparison.
- Persisted mission DAGs with concurrent ready branches, joins, retry, pause/resume/cancel, restart recovery and conflict records. Real branch content requires Gemini or an injected test provider; the default runtime never fabricates branch output.
- Gemini Live session records, short-lived constrained tokens bound by hash to one tenant session, browser PCM microphone streaming, native audio playback, interruption handling, transcript events/deletion and text-chat fallback.
- Tenant-scoped image/audio/video storage with MIME signature checks, honest `awaiting_credentials` state, Gemini multimodal analysis adapter, delete reconciliation fields, usage ledger and workspace budgets.

## Configuration

Run on port 3005:

```powershell
$env:COLLEAGUE_ZERO_AI_PROVIDER = 'gemini'
$buildBotGeminiKey = Read-Host 'Gemini API key' -AsSecureString
$env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new('', $buildBotGeminiKey).Password
npm start
```

Never put the key in the browser, chat, SQLite database, connector form or a bot computer.

## Honest remaining production work

- Provider-specific OAuth registration/token exchange backed by a real secret vault. The route returns a configuration error until that exists; no tokens are faked or stored in SQLite.
- Optional embeddings and idempotent re-indexing for semantic memory/document retrieval.
- Production OCR for scanned PDFs; the current API accepts explicitly supplied broker/mock OCR text and labels it.
- Hardened code execution with CPU, memory, time, network and file limits. `CODE_SANDBOX_ENABLED` remains off.
- Full DOCX/PPTX/XLSX/PDF artifact render-and-verify workers.
- PostgreSQL row-level-security enforcement and migration, Kubernetes persistent volumes, network policy, gVisor/Kata, TLS, secret manager, monitoring, backup restore drills and incident controls.
- Real credential acceptance tests for each external LMS/email/calendar/SIS connector.

## Verification

`npm test` exercises the original regression suite and expansion tests. Hosted provider and real connector acceptance tests must be run only after dedicated fictional-data credentials are configured.
