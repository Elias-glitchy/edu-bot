# BUILD GROWTH integration and construction workforce plan

## Product relationship

BUILD BOT is both:

1. A standalone autonomous workforce command center.
2. The native governed AI workforce operating inside BUILD GROWTH.

Both surfaces use one control plane and one set of organization, identity, workforce, mission, conversation, task, approval, computer, artifact, audit, and policy records. BUILD GROWTH owns the construction opportunity and commercial records; BUILD BOT acts on those records through authorized contracts and records the execution evidence.

The supplied pitch deck establishes desired product behavior and positioning. It does not establish that BUILD GROWTH repositories, APIs, schemas, authentication, event streams, or extension points already exist. Phase 0 must inspect the real implementation and record those contracts before a production adapter is built. Until then, use a clearly labeled local fixture adapter.

## Construction growth journey

The shared journey is:

1. **Find the work** — ingest tenders, permits, planning applications, approvals, developments, capital projects, private-project signals, and contract awards.
2. **Analyze** — classify the opportunity, assess eligibility and fit, expose evidence, confidence, missing information, risks, and recommended next action.
3. **Find the company** — identify the client, developer, consultant, winning main contractor, relevant suppliers, and related entities.
4. **Find the people** — identify and verify decision-makers, influencers, estimators, buyers, project managers, and commercial contacts.
5. **Pursue** — propose a pursuit strategy, prepare personalized outreach, coordinate follow-up, and maintain relationship context.
6. **Manage** — maintain pipeline stage, tasks, notes, communications, next actions, blockers, and ownership.
7. **Quote / BOQ** — prepare estimates, bills of quantities, assumptions, exclusions, supporting documents, and commercial reviews.
8. **Invoice** — prepare an invoice or approved accounting-system instruction from authorized commercial records.
9. **Get paid** — monitor due dates and payment state, prepare governed reminders, surface disputes, and escalate risk.

## BUILD product lanes

### BUILD GROWTH: pre-tender intelligence

Monitor early signals such as planning applications, permits, approvals, developments, capital projects, and credible private-sector activity. Agents should help the user find work before a formal tender exists and retain the source and observation time for every signal.

### BUILD GROWTH: award and subcontract intelligence

Monitor award sources, identify the winning main contractor, infer likely subcontract packages with confidence and rationale, match the user's capabilities, find relevant decision-makers, propose outreach, and coordinate CRM follow-up.

### BUILD BID: direct tender bidding

Treat BUILD BID as a related product boundary for tender discovery, bid/no-bid analysis, proposal drafting, estimating/pricing, compliance, submission, tracking, and learning. Tender submission is always a sensitive external commitment and must require an authorized human approval unless a stricter policy denies it entirely. Do not merge or duplicate BUILD BID records until its real integration contract has been inspected.

## Workforce capability mapping

The deck's labels such as “project intelligence agent” and “contact intelligence agent” describe capabilities. They map onto the eleven persistent BUILD BOT employees rather than creating an additional competing workforce.

| BUILD capability | Accountable manager | Supporting managers |
| --- | --- | --- |
| Project, permit, planning, development, and capital-project intelligence | Intelligence Manager | Tender & Bid, Technology |
| Award detection and winning-contractor research | Intelligence Manager | Tender & Bid, Sales |
| Opportunity matching and explainable fit scoring | Sales Manager | Intelligence, Estimating & Commercial |
| Company research and entity resolution | Intelligence Manager | CRM, Sales |
| Decision-maker discovery | Intelligence Manager | CRM, Outbound |
| Contact verification and consent/status handling | CRM Manager | Intelligence, Outbound |
| Pursuit strategy and opportunity ownership | Sales Manager | CHIEF, Intelligence, Estimating & Commercial |
| Personalized outreach preparation and delivery | Outbound Manager | Sales, CRM, Marketing |
| Follow-up sequences and reply handling | Outbound Manager | CRM, Sales |
| Pipeline, notes, tasks, and customer records | CRM Manager | Sales, Operations |
| Quotes, estimates, BOQs, assumptions, and exclusions | Estimating & Commercial Manager | Finance, Sales, Tender & Bid |
| Invoices, receivables, and payment follow-up | Finance Manager | CRM, Operations |
| Tender discovery and bid/no-bid | Tender & Bid Manager | Intelligence, Estimating & Commercial |
| Proposal, compliance, pricing coordination, and submission package | Tender & Bid Manager | Estimating & Commercial, Finance, Technology |
| Cross-functional plan, delegation, and executive escalation | CHIEF | Operations |

Marketing Manager supports capability statements, case studies, proposal content, and campaigns. Technology Manager owns technical integrations, automation reliability, and governed computer operations. Operations Manager owns capacity, service levels, dependencies, and delivery coordination.

## Native integration architecture

### Shared identity and embedded context

Use shared identity or an explicit SSO federation. BUILD GROWTH passes a short-lived signed embedded-context token containing, at minimum, user id, organization id, role/permission claims, workspace id, selected record type/id, audience, issuer, issued/expiry time, and nonce. BUILD BOT validates the signature and audience, resolves the current membership, and reevaluates authorization; it never trusts client-provided record context on its own.

### Typed adapter

Define a versioned `BuildGrowthAdapter` with typed operations for:

- Opportunities, project signals, awards, source evidence, fit scores, and pipeline stages.
- Companies, people, relationships, contact methods, verification, and consent/suppression status.
- Tasks, notes, communications, outreach drafts, follow-up status, and next actions.
- Quotes, estimates, BOQs, invoices, payment status, documents, and record deep links.

Every operation declares read/write scope, organization, acting user, delegated agent, correlation id, idempotency key, expected record version, and provenance. Writes use optimistic concurrency and return the authoritative record version.

### Record ownership

- BUILD GROWTH is authoritative for opportunities, projects, awards, companies, people, pipeline records, communications, quotes/BOQs, invoices, and payment states.
- BUILD BOT is authoritative for agent definitions, conversations, missions, tasks/runs/steps, policies, approvals, Linux computers, execution events, artifacts, and evidence.
- Cross-system records store stable external references and deep links, not uncontrolled copies. Any search index or cache is rebuildable and labeled with source version and observation time.

### Event synchronization

Use versioned domain events with a transactional outbox at the publisher and an inbox/deduplication record at the consumer. Support retries, replay, ordering per aggregate where required, dead-letter handling, schema compatibility, and trace/correlation ids. Representative events include opportunity created/updated, award detected, pipeline stage changed, person/contact updated, outreach replied, quote approved, invoice issued, payment changed, agent run started/completed/blocked, and approval requested/decided.

## Embedded user experience

- A global **Ask CHIEF** action opens a contextual conversation without losing the selected BUILD GROWTH record.
- Opportunity pages offer **Analyze fit**, **Research company**, **Find decision-makers**, **Plan pursuit**, **Draft outreach**, and **Create mission** actions according to permission.
- Company and person pages expose research, verification, relationship summary, and follow-up actions.
- Pipeline, quote/BOQ, invoice, and payment screens expose relevant manager actions and exact-action approvals.
- A compact activity drawer shows accountable manager, current step, verified events, blockers, evidence, approval state, and live-computer access.
- Every embedded run links to its full BUILD BOT workspace; every BUILD BOT run links back to the exact BUILD GROWTH record and version that initiated it.
- The embedded UI uses BUILD GROWTH navigation and context while preserving BUILD BOT agent identity colors and status semantics.

## Minimum construction domain records

The integration contract should cover, without prematurely coupling database tables:

- Project/opportunity signal, source, geography, sector, dates, value range, stage, status, and provenance.
- Tender/award identifiers, issuer/client, winning contractor, award date/value, and source evidence.
- Capability profile and matching criteria for the customer organization.
- Fit assessment with components, rationale, confidence, missing data, disqualifiers, and reviewer override.
- Company/entity, role in project, aliases/registration identifiers, and relationships.
- Person, organization role, decision relevance, contact verification, source, consent, and suppression state.
- Pursuit, owner, stage, value/probability, next action, tasks, interactions, blockers, and outcome.
- Scope/package prediction with assumptions and confidence.
- Estimate/quote/BOQ versions, line items, rates, assumptions, exclusions, tax, approvals, and source documents.
- Invoice/payment references and status; accounting remains authoritative where an accounting connector is used.

## Approval and policy boundaries

The organization's policy decides when reads, internal record updates, or bounded drafts may proceed autonomously. Default sensitive actions require exact-action approval, including:

- Sending external email, messages, campaigns, or follow-ups.
- Publishing or submitting a quote, BOQ, proposal, tender, or contractual response.
- Creating or issuing an invoice, changing payment or banking data, or initiating any financial transaction.
- Bulk contact enrichment, purchase of data, or use of personal information outside authorized purpose and jurisdiction.
- Changing pipeline ownership, deleting records, or overwriting material commercial data.
- Buying services, accepting terms, signing, or representing the customer externally.

The approval preview must show the exact destination, content, attachments, amounts, record version, business context, policy reason, and expiration. Any material change invalidates the approval.

## First end-to-end BUILD GROWTH slice

Implement this after the base CHIEF research slice is reliable:

1. A user opens a fixture or real BUILD GROWTH opportunity and selects **Ask CHIEF to assess and prepare pursuit**.
2. CHIEF creates a visible plan tied to that exact opportunity version.
3. Intelligence Manager verifies the source, researches the project/company, and produces cited findings.
4. Sales Manager produces an explainable fit assessment and pursuit recommendation.
5. CRM Manager records or proposes verified entities and people through the adapter.
6. Outbound Manager drafts a personalized message but does not send it without the configured exact-action approval.
7. The user reviews the plan, evidence, proposed record writes, and message in either surface.
8. Approval applies the authorized writes and send exactly once; rejection or mutation prevents execution.
9. The outcome, communication, next action, audit trail, and deep links remain consistent in BUILD GROWTH and BUILD BOT after refresh and worker restart.

This slice proves the native product relationship without pretending that the complete opportunity-to-cash workflow is already implemented.
