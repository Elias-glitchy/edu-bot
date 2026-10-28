# BUILD BOT — repository assessment and phased implementation plan

Assessment date: 12 October 2026 (Africa/Johannesburg)

> Detailed Astra 6 implementation specifications now live in [`planning/README.md`](planning/README.md). This document remains the initial repository assessment and summary roadmap.

## Current state

The repository at `C:\Users\elias\OneDrive\Documents\ChatGPT\BUILD BOT` is an empty Git checkout. It has no commits, tracked files, application code, configuration, tests, running services, or configured remote. No BUILD BOT feature can presently be marked implemented or verified in this repository.

The available product material is planning and design input:

| Material | What it provides | Implementation status |
| --- | --- | --- |
| BUILD BOT master context pasted in this chat | Product vision, eleven employees, weekly cycle, daily reports, autonomous computer use, approvals, standalone SaaS positioning | Specification only |
| `BUILD_BOT_Complete_Design_Kit.zip` | Brand assets and thirteen Markdown design documents, including one master system and eleven screen prompts | Static design source; no application code |
| `BUILD_BOT_44_Individual_UI_Images.zip` | Eleven screens in desktop/mobile and dark/light combinations | Forty-four static, mostly empty-state mockups; no active workflows or interactions |
| `BUILD_BOT_ALL_11_COLOR_GROUPS_ROBOT_IMAGES (1).zip` | Sixty-seven 1254×1254 PNG robot variants in eleven color groups | Usable source artwork; no role-to-color assignment or transparent/animated variants |
| `BUILD_BOT_All_Robot_Images.zip` | Earlier monochrome robot gallery and brand boards | Reference artwork, overlapping the complete design kit |
| `Screen Recording 2026-10-11 181512.mp4` | 12:58 Grok Bot tutorial showing agent setup, chat, connected apps, routines, live computer view, result delivery, and group delegation | Behavioral reference, not BUILD BOT software or proof of Grok Bot's internal architecture |
| `1786889381857.png` | Grok Bot desktop three-panel chat shell and compact mobile workforce inbox | Visual and interaction reference; third-party names, trademarks, example data, and assets must not ship in BUILD BOT |
| `BUILD_Pitch_Deck_MANCOSA_Hackathon_2026_compressed.pdf` | BUILD GROWTH construction opportunity, award/subcontract, pursuit, CRM, commercial, and BUILD BID product journey | Product context only; not proof that BUILD GROWTH code, APIs, schemas, identity, events, or integrations exist |

The three numbered copies of the Complete Design Kit have identical SHA-256 hashes; so do the two copies of the eleven-color robot archive. The older design-kit README describes the monochrome robot as the sole approved product avatar. The user's later instruction explicitly requires distinct avatars for all eleven employees, so retain the official logo/CHIEF identity while using the newer color collection for the workforce. The archives do not define which color belongs to which role; confirm that mapping during visual design.

All color-group images are opaque RGB PNGs with dark backgrounds. The UI pack's 44 images are useful layout references, but their tiny placeholder avatar marks, limited interaction detail, and empty states need production design work. Light-mode use of the colorful robots requires a reviewed presentation treatment, such as dark avatar tiles or carefully prepared cutouts. Do not treat mockup labels or example content as live business data.

## Product contract

BUILD BOT is a multi-tenant subscription SaaS with two first-class surfaces: a standalone workforce command center and a native embedded workforce inside BUILD GROWTH. CHIEF is the main entry point and delegates to ten built-in managers. Organizations may create custom employees with scoped tools, memory, autonomy, and reporting relationships. Both surfaces share one control plane, while BUILD GROWTH remains authoritative for construction opportunities, companies, people, pipeline, quote/BOQ, invoice, and payment records.

The target user experience from the Grok Bot recording is: create/configure an employee; converse in individual or group chat; delegate to another employee; connect a permitted application; schedule a routine; watch computer work; and receive a result with evidence. The recording visibly demonstrates those interface flows, but does not establish production reliability, secure tenancy, approval enforcement, or the technical implementation beneath them. BUILD BOT must implement and verify those qualities independently.

The primary shell must closely follow the supplied Grok Bot reference: searchable workforce/conversation roster on the left, active chat in the center, live computer and routines/context on the right, and a compact workforce inbox on mobile. Use BUILD BOT branding, robot identities, colors, content, accessibility, and original implementation; do not copy Grok trademarks or example business data.

Non-negotiable BUILD BOT workflows:

- Sunday: CHIEF proposes the coming week's mission plan from owner goals and verified prior results.
- Monday–Saturday: managers execute authorized tasks through connected apps and cloud computers.
- Daily: morning, afternoon, and evening reports compare plan with verified work, blockers, approvals, and next actions.
- The owner can speak or write to CHIEF, inspect work, interrupt tasks, and revoke access.
- Sensitive actions use configurable policy gates. Ordinary work within delegated authority may proceed autonomously.
- Agent statuses and activity are derived from execution records; the product must not simulate activity as if it were live.

## Missing functionality

Everything below remains unimplemented in this repository:

1. Frontend app, responsive light/dark design system, navigation, eleven product screens, accessible interactions, and real avatar integration.
2. Authentication, organizations, roles, subscriptions, billing, settings, and tenant separation.
3. CHIEF and manager conversations, group chats, custom-agent configuration, memory, model routing, delegation, and persistent task state.
4. Missions, dependencies, routines, scheduling, weekly planning, daily reports, notifications, and voice interaction.
5. Business app connectors, OAuth/account lifecycle, the first-class BUILD GROWTH embedded/API/event integration, permissions, approval engine, and audit records.
6. Isolated persistent cloud computers, browser/computer automation, live viewing, takeover, pause/resume/stop, retries, and evidence capture.
7. Deployment, operational monitoring, security hardening, usage controls, and end-to-end validation.

## Proposed architecture

The repository does not establish a stack. Start with the stack in the product brief, subject to validation during Phase 0:

- **Frontend:** Next.js, React, TypeScript; shared tokens for light/dark themes; responsive app shell; streaming chat and live session viewer.
- **API:** Python FastAPI for authenticated product APIs, connector operations, report queries, and real-time event delivery.
- **Source of truth:** PostgreSQL for organizations, users, agents, conversations, missions, tasks, runs, actions, approvals, integration grants, session metadata, and reports. Object storage for artifacts and redacted screenshots.
- **Durable execution:** a workflow engine for mission/task state, retries, scheduling, cancellation, and waiting for approval. Redis may support caching, presence, rate limits, and short-lived coordination; it must not be the sole record of long-running work.
- **Agent runtime:** CHIEF planner/delegator plus specialist manager workers; model routing by task and cost; explicit tool contracts; per-agent memory scopes; bounded context; structured results and verification.
- **Action gateway:** every connector call and computer action checks organization, agent, user-delegated capability, destination, action category, limits, and current policy. Approval requests bind to an exact proposed action and expire or re-open if that action changes.
- **Computer broker:** isolated cloud workspaces with controlled browser sessions, live video/frames, user takeover, secrets kept outside previews, session recording/evidence, reconnection, and resource limits.
- **Observability:** append-only execution events, searchable activity, evidence references, traces, errors, and usage metering. User-facing statuses come from this event stream.

## Phased implementation

| Phase | Build | Exit criterion |
| --- | --- | --- |
| **0 — Product and technical baseline** | Resolve the eleven role/avatar mappings; define end-to-end acceptance journeys; classify actions and approval modes; choose deployment, identity, workflow, and computer providers; create data and event schemas; inspect the real BUILD GROWTH repositories/environments and document identity, tenant, API, schema, event, record-ownership, and embedded-extension contracts. | Architecture and acceptance criteria are reviewable, with unresolved decisions explicitly recorded and no BUILD GROWTH interface invented from the pitch deck. |
| **1 — SaaS foundation and interface** | Initialize the monorepo, Next.js/FastAPI/PostgreSQL, organization auth, roles, subscription model skeleton, responsive app shell, themes, official brand, eleven seeded employee profiles, and genuine empty states. | A new organization can sign in and see its own correctly branded workforce; no fake work appears. |
| **2 — Working agent vertical slice** | Implement CHIEF chat, individual manager chat, task/run/event records, model/tool router, delegation, group handoff, artifacts, and real status streaming. Begin with one safe research task. | A user asks CHIEF for work; CHIEF delegates; a manager completes it; the owner sees the handoff, status, source/evidence, and result after reload. |
| **3 — Permissions, integrations, approvals** | Add scoped connector grants (begin with one email/calendar or business-data integration), secret handling, action policies, review previews, approve/reject/request changes, audit history, and revocation. | Authorized reads work; a sensitive write pauses on its exact approval request; unrelated work continues; revocation prevents further actions. |
| **4 — Cloud computer execution** | Provision isolated browser/computer environments; add live viewer, activity timeline, screenshots, pause/resume/stop, takeover/return control, recovery, and resource controls. | A manager completes a browser task in an isolated workspace while the owner watches and can interrupt; the result links to recorded evidence. |
| **5 — Autonomous operating cycle** | Build Sunday mission planning, Monday–Saturday dispatch, dependencies, routines, timezone-aware scheduling, morning/afternoon/evening reports, notifications, and weekly review. | A mission survives process restarts, executes on schedule, handles blockers, and produces reports sourced from actual task records. |
| **6 — Full workforce and launch readiness** | Complete all ten manager tool packs; custom employee builder/testing; voice with CHIEF; production BUILD GROWTH embedded/API/event integration; BUILD BID adapter boundaries; subscription metering; accessibility, security, load, recovery, and tenant-isolation validation. | The eleven built-in roles and custom agents function within their scopes, the opportunity-to-cash journey works across BUILD GROWTH and BUILD BOT, and launch journeys pass end to end under production-like conditions. |

The first functional demonstration should be a complete vertical slice, rather than eleven static pages: owner asks CHIEF for a task; CHIEF delegates to one manager; the manager uses an authorized tool; the owner sees live progress; and the result includes evidence. Subsequent phases extend that reliable path to sensitive actions, browser work, schedules, and the complete workforce.

## Decisions to settle before implementation reaches them

1. Final role-to-color and primary portrait selection for each of the eleven employees. The ZIP names colors and poses but not business roles.
2. The first BUILD GROWTH environment and integration contract available for inspection. Until it exists, use only a clearly labeled fixture adapter.
3. Cloud computer hosting and region/data-residency needs, which influence cost and architecture.
4. Approval defaults and limits by action category, including email sending, purchases, quotations, tender submissions, and record deletion.
5. Voice, notification, subscription, BUILD GROWTH deployment/identity/event providers, and launch scope.

No application code was changed while preparing this assessment.
