# Product and UX specification

## Product model

The human owner is the ultimate orchestrator. CHIEF converts the owner's objectives into missions, delegates bounded tasks to specialist managers, watches execution, resolves routine problems, and escalates decisions that require human judgment or policy approval.

BUILD BOT has two first-class product surfaces backed by the same control plane:

- A standalone workforce command center for configuring agents, missions, computers, integrations, policies, reports, and cross-business work.
- A native embedded BUILD GROWTH experience where users invoke the same agents from construction opportunities, companies, people, outreach, pipeline, quote/BOQ, invoice, payment, and tender contexts.

The embedded surface must not create shadow copies of agents, conversations, permissions, or task state. A run started from BUILD GROWTH remains visible in BUILD BOT, and its authorized business-record effects remain visible in BUILD GROWTH.

Each built-in or custom bot has:

- Stable identity, avatar, role, instructions, reporting relationship, and status.
- Private conversation plus participation in selected group conversations.
- Scoped memory and approved knowledge sources.
- Tool and connector grants.
- Its own persistent Linux computer.
- Autonomy rules, budgets, communication limits, and approval gates.
- Missions, routines, execution history, artifacts, and reports.

Built-in bot status values are `idle`, `planning`, `working`, `awaiting_approval`, `paused`, `completed`, `failed`, `offline`, and `disabled`. Status must be computed from current execution records.

## Default workforce and proposed color mapping

The supplied color archive is ordered into eleven groups. Use this mapping as the build default, pending owner approval:

| Employee | Color group | Default visual character |
| --- | --- | --- |
| CHIEF | Royal Blue | Confident executive/welcome pose |
| Operations Manager | Cyan Blue | Dashboard or coordinating pose |
| Finance Manager | Emerald Green | Analytical/data pose |
| Sales Manager | Purple/Violet | Confident conversational pose |
| Outbound Manager | Crimson Red | Active outreach/waving pose |
| Intelligence Manager | Gold/Amber | Analytical/research pose |
| CRM Manager | Orange | Friendly relationship pose |
| Marketing Manager | Magenta/Pink | Expressive presentation pose |
| Technology Manager | Teal | Technical/dashboard pose |
| Tender & Bid Manager | Silver/Graphite | Formal analytical pose |
| Estimating & Commercial Manager | Lime/Neon Green | Data/presentation pose |

Preserve the official BUILD BOT logo and wordmark as product branding. Keep avatar assignment in data/configuration rather than hard-coding image imports into page components.

## Information architecture

The primary interface is the Grok-style chat-first workforce shell specified in `11_GROK_BOT_UX_FUNCTIONAL_PARITY.md`. Do not replace it with a conventional dashboard-first SaaS sidebar. On desktop, the permanent left pane is the searchable agent/conversation roster, the center pane is the active conversation, and the contextual right pane contains the live computer, routines, task evidence, approvals, or record context. On mobile, the roster becomes the home screen and the conversation/context panels become full-screen drill-ins.

The following product destinations remain available through the launcher, profile/settings menu, contextual panels, and deep links rather than occupying the primary roster pane:

1. Chief
2. AI Workforce
3. Conversations
4. Missions & Routines
5. Activity & Computers
6. Approvals
7. Reports
8. Integrations
9. Settings

Desktop uses a collapsible sidebar. Mobile uses a compact header plus bottom navigation for the highest-frequency destinations and a drawer for the complete list.

## Core screens

### Chief

Default command center with chat history, text/voice composer, attachments, current mission context, plan cards, delegations, approvals, live activity, and executive briefings. The user can inspect or interrupt work without leaving the conversation.

### AI Workforce

CHIEF appears first, then the ten managers, followed by custom bots. Each card shows identity, role, truthful current status, current task, last verified activity, and quick actions. Search and filter by status/role. Selecting a bot opens its workspace.

### Individual bot workspace

Dedicated conversation plus current mission, tasks, memory summary, authorized tools, and Linux computer access. Active runs expose pause, resume, stop, view computer, artifacts, and execution details.

### Group conversations

Human, CHIEF, managers, and selected custom bots work in one thread. Messages identify the speaker. Delegations appear as task handoff cards with owner, objective, state, due date, and result. CHIEF closes the loop with a consolidated decision or next action.

### Missions & Routines

Mission list, calendar/timeline, reusable routines, dependencies, goals, assigned bots, approval rules, scheduled reports, blockers, and evidence. Sunday planning is a first-class workflow with draft, review, approve, and activate states.

### Activity & Computers

Verified event timeline plus bot computer inventory. A computer session view shows the live desktop, current action, elapsed time, plan steps, tool calls, files, screenshots, errors, recovery attempts, and pending approvals. Controls include view only, take control, return control, pause, resume, and stop, governed by permissions.

### Approvals

Pending, approved, rejected, expired, and all. Each request shows the exact action, actor, destination, content/amount, policy reason, risk context, supporting preview, expiration, and approve/reject/request changes controls. Decisions are recorded in the audit trail.

### Reports

Morning, afternoon, evening, weekly, mission, and manager reports. Reports compare goals with verified outcomes and link every claim to tasks, events, records, or artifacts. Missing and estimated data are labeled.

### Bot configuration

Wizard and edit view for identity, role, instructions, knowledge, memory, tools, computer permissions, autonomy, approvals, missions/routines, collaboration, reporting, sandbox test, and deployment. Built-in managers have protected system responsibilities with organization-level customization layered above them.

### Integrations and settings

Connections, organization/users/roles, appearance, workforce defaults, approval policy, cloud-computer policy, voice, notifications, billing, security, retention, export, and account deletion.

### Embedded BUILD GROWTH surfaces

- Global **Ask CHIEF** entry point that carries the current BUILD GROWTH workspace and selected-record context.
- Opportunity actions to analyze fit, research the project/company, identify decision-makers, propose pursuit, create tasks, and draft outreach.
- Company and person actions for research, contact verification, CRM enrichment, relationship summaries, and governed follow-up.
- Pipeline actions for next-best action, quote/BOQ preparation, invoice preparation, payment follow-up, and risk escalation.
- Contextual approvals and a compact live-computer/activity view without forcing the user to leave BUILD GROWTH.
- Deep links in both directions so users can move from a BUILD GROWTH record to the full BUILD BOT run, evidence, approval, or computer session and back.

## Visual and interaction system

- Light mode: white foundation, near-black text, restrained grays.
- Dark mode: true-black foundation, white text, charcoal surfaces.
- Accent colors belong primarily to bot identity and semantic state.
- Use readable spacing, subtle borders, modest radii, and minimal motion.
- Match the supplied mockups' simplicity while adding the states and controls required here.
- Support keyboard operation, focus visibility, reduced motion, screen readers, and WCAG AA contrast.
- Render loading, empty, offline, unauthorized, disconnected, failed, retrying, and partial-result states.
- Never show fabricated tasks or business metrics as real. Demo fixtures require a visible `Demo` label.

## Recurring operating cycle

### Sunday planning

At the organization's configured time, CHIEF reviews owner goals, incomplete work, reports, approvals, connected data, capacity, and policy. CHIEF drafts a weekly mission with measurable outcomes, dependencies, assigned managers, proposed tool use, approval expectations, and report schedule. Owner policy determines whether activation needs explicit approval.

### Monday–Saturday execution

Durable workflows release eligible tasks, acquire the appropriate bot/computer/tool lease, apply policy, execute, verify, and record results. Failures use bounded retries and recovery. A blocked task does not halt unrelated authorized work.

### Daily reports

- Morning: plan, priorities, overnight results, blockers, approvals, risks.
- Afternoon: progress versus plan, completed work, deviations, decisions needed.
- Evening: outcomes, remaining work, failures, evidence, next-day actions.

## Voice

Voice with CHIEF includes push-to-talk/voice notes first, then optional live full-duplex sessions. Persist the transcript and resulting commands according to organization retention policy. Require the same policy and approval checks as text requests. Make recording state and microphone use clear.

