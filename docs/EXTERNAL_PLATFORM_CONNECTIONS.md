# External platform connections

BUILD BOT now includes an organization-scoped external tool broker. Bots receive four deferred tools—search, describe, request and status—instead of loading every connector schema into each Gemini prompt.

## Google Workspace

The first-party Google connector supports Drive, Docs, Slides, Sheets, Gmail drafts/send and Calendar. OAuth uses Authorization Code with PKCE, single-use hashed state, a ten-minute expiry and AES-256-GCM encrypted token storage. The local launcher creates the vault key in the ignored `.env.local` file automatically.

Add the following server-only values to `.env.local` before connecting a real Google account:

```text
COLLEAGUE_ZERO_GOOGLE_CLIENT_ID=
COLLEAGUE_ZERO_GOOGLE_CLIENT_SECRET=
COLLEAGUE_ZERO_GOOGLE_REDIRECT_URI=http://localhost:3005/api/connectors/oauth/callback
```

Register that exact redirect URI in the Google Cloud OAuth client, restart BUILD BOT, then open **Settings → Connections & tools → Add Google Workspace → Connect Google**.

The requested scopes are identity, `drive.file`, `calendar.events` and `gmail.compose`. `drive.file` limits Drive access to files the app creates or the user explicitly opens with the app.

## Governance

- All tools are denied by default.
- Permissions are granted per bot, role or organization as read-only, propose, or deny.
- A bot-specific deny overrides broader grants.
- Reads execute only after an explicit read grant.
- Drafts and writes create an exact-action approval with an argument fingerprint.
- Gmail draft creation and Gmail sending are separate actions.
- Receipts store sanitized results, hashes, provider IDs, resource IDs, before/after evidence and rollback guidance.
- Connector call budgets apply before provider execution.
- Disconnect revokes provider authorization, erases encrypted credentials and revokes active grants.

Remote MCP, Composio and Zapier connections continue to use environment references for their secrets and share the same catalogue, permissions, approvals, budgets and receipts.

## Current local readiness

The implementation and fake-provider tests work without real credentials. Until Google OAuth values are added, the Settings screen honestly shows `awaiting credentials`; no simulated provider success is displayed.
