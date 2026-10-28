# Security, approvals, and audit

## Trust boundaries

Treat users, model output, websites, uploaded files, connector data, retrieved memory, and computer-screen content as untrusted inputs. Only the policy/action gateway can authorize a side effect. A model may propose an action but cannot grant itself permission.

## Authorization layers

Every request or action must pass all applicable layers:

1. Authenticated user or service identity.
2. Organization membership and role.
3. Resource ownership and tenant scope.
4. Agent capability grant.
5. Connection/account scope.
6. Mission/task delegation scope.
7. Organization policy and limits.
8. Current approval, if required.
9. Provider-specific constraints.

Deny by default. Store the policy version and decision explanation with the action.

## Approval modes

- **Always Ask:** each exact action requires human approval.
- **Autonomous Within Limits:** execute within configured recipients, destinations, categories, time windows, and numeric limits.
- **Autonomous When Authorized:** execute when an active mission or routine explicitly grants the capability and scope.

Recommended default categories:

| Action | Default |
| --- | --- |
| Read permitted business records | Autonomous when authorized |
| Draft internal content | Autonomous when authorized |
| External email/message send | Always Ask until the organization configures recipients/domains and limits |
| CRM field update | Autonomous within configured fields; ask for destructive/bulk changes |
| Quote or proposal draft | Autonomous when authorized |
| Binding quotation issue | Always Ask |
| Tender/bid submission | Always Ask |
| Purchase or payment | Always Ask and respect provider controls |
| Delete critical or bulk records | Always Ask |
| Install software or grant a new scope | Administrator approval |

## Exact-action approval

Canonicalize the proposed action and hash:

- Tool/connector and operation.
- Account/connection.
- Recipient, destination, record ids, or URL.
- Content or immutable content reference.
- Amount, currency, quantity, and commercial terms where applicable.
- Attachments and artifact hashes.
- Expiration and policy version.

The approval UI renders this canonical proposal. Execution verifies the hash and approval state immediately before the side effect. A changed recipient, amount, attachment, message, or binding term invalidates the approval.

## Secrets and connections

- Use OAuth authorization code with PKCE where supported.
- Store refresh tokens and credentials in a managed secrets vault.
- Give workers short-lived scoped tokens or proxy access.
- Encrypt transport and storage; rotate keys and revoke connections.
- Test connections without exposing tokens.
- Record consented scopes and last successful use.
- Remove access promptly when a user, agent, or organization grant is revoked.

## Prompt injection and content safety

- Mark external content as data, never instructions.
- Separate system policy, user goal, retrieved context, and page/document text.
- Allow tools only through typed schemas and domain allowlists where appropriate.
- Require explicit confirmation from the policy engine for navigation or actions outside the plan.
- Scan downloads and uploads; quarantine suspicious files.
- Prevent websites and documents from changing approval or security rules.

## Audit trail

Audit events are append-only and capture:

- Human, agent, or service actor.
- Organization and affected resource.
- Action and result.
- Timestamp, request id, trace id, workflow/run id.
- Policy decision and version.
- Approval reference where applicable.
- Before/after references for configuration changes.
- Evidence/artifact references without storing secrets.

Restrict audit access by role. Support signed exports and retention rules. Administrative actions, control takeover, connector changes, policy edits, computer resets, and data exports must always be audited.

## Tenant isolation

- Tenant id on all records and object-storage paths.
- PostgreSQL row-level security with tests for every tenant-owned table.
- Tenant-aware cache keys, queues, event topics, logs, and metrics.
- Separate agent computer volumes and scoped service identities.
- Authorization tests that attempt cross-organization ids on every critical endpoint.

## Data lifecycle

Define retention separately for conversations, model traces, computer screenshots/recordings, artifacts, memories, audit events, and deleted accounts. Deletion workflows revoke credentials, stop computers, schedule volume destruction, remove eligible objects, and retain only legally/contractually required records. Export packages include provenance and remain access controlled.

## Operational controls

- Rate and cost limits per user, agent, organization, provider, and task.
- Emergency kill switch at organization, agent, connector, and computer levels.
- Software/image patch process and signed workspace images.
- Dependency and container scanning in CI.
- Backup restore drills and incident response runbooks.
- Security review before enabling payments, purchases, tender submission, or broad outbound communication.

