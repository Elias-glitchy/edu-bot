# Grok Bot UX and functional parity specification

## Binding design direction

BUILD BOT must feel and behave like the supplied Grok Bot reference: a fast, calm, chat-first workforce product in which agents appear like an intelligent team inbox rather than a conventional analytics dashboard. Match the observable layout, hierarchy, interaction model, responsive behavior, and functional flows as closely as practical while using BUILD BOT branding, the eleven supplied robot identities, original code, and governed BUILD BOT data.

Do not copy Grok names, logos, marketing copy, example companies, fonts without an appropriate license, or other proprietary assets. The reference demonstrates the desired user experience; it does not disclose or authorize copying proprietary source code or internal architecture.

## Desktop application shell

At desktop widths, use a three-panel layout with full-height dividers and minimal chrome:

### Left pane — workforce inbox

- Approximate width: 280–320 px, resizable within sensible limits.
- Top bar contains window/product identity where appropriate and one prominent create/add button.
- Search field filters built-in bots, custom bots, direct conversations, group conversations, and message text.
- CHIEF is first, followed by the ten managers, then custom bots and group conversations according to recency and pinning.
- Each row contains avatar, employee/conversation name, last activity time, one-line result/status preview, unread indicator, and truthful active/approval/error state.
- Selecting a row updates the center and contextual right panels without a full-page navigation flash.
- The bottom area provides Integrations/Connections and the signed-in user/workspace menu.
- Do not put a generic SaaS navigation menu in this pane. Missions, activity, approvals, reports, settings, and workforce configuration open through contextual actions, launcher/search, profile menus, and deep links.

### Center pane — active conversation

- Flexible main pane, with a practical minimum near 420 px.
- Header shows the selected bot/group avatar, name, presence/status, and a computer/context toggle.
- Messages use compact bubbles: the user's messages are high-contrast dark/brand surfaces; bot messages are restrained neutral surfaces. Speaker identity is explicit in groups.
- Messages may contain structured plan cards, delegated-task cards, progress events, approvals, attachments, evidence, citations, record previews, and final results without breaking conversational flow.
- The composer is anchored to the bottom and includes add/attach, multiline text, send, and microphone controls. It supports drag/drop, paste, keyboard shortcuts, cancellation, and clear upload/transcription progress.
- Streaming output, reconnect, retry, edit-and-resend, stop generation/run, unread positioning, and durable message history must use real persisted state.
- When launched from BUILD GROWTH, a compact context chip/card identifies the selected opportunity, company, person, tender, quote, invoice, or payment record and its version; the full conversation remains usable.

### Right pane — computer and work context

- Approximate width: 320–400 px, resizable and collapsible.
- Default active-run view begins with the selected bot's live computer preview, current action, connection state, and view/take-control control.
- Below the computer, show active and upcoming routines with name, cadence/next occurrence, and state.
- Context tabs or stacked sections may reveal plan steps, delegated tasks, artifacts, evidence, approvals, BUILD GROWTH record context, and execution details.
- The pane updates with the selected bot/conversation and never shows a different employee's screen by accident.
- Closing the pane gives the chat more room; reopening restores its last contextual section.

### Desktop responsive behavior

- Wide: all three panes visible.
- Medium: left roster plus center chat visible; right pane opens as an overlay/drawer.
- Narrow/tablet portrait: one primary pane at a time with preserved selection and explicit back navigation.
- Dividers, pane widths, scroll positions, and collapse state persist per user/device where appropriate.

## Mobile application shell

The mobile home screen mirrors the compact workforce inbox in the reference:

- Top row: user/workspace avatar, search, and create/add.
- Horizontal pinned/recent employee strip with large robot avatars, names, truthful presence/state, and optional small notification badges.
- Recency-sorted workforce/conversation list using avatar, name, last-result preview, time, unread state, and approval/error indicator.
- Tapping a bot opens a full-screen conversation with a compact back header and the same composer capabilities as desktop.
- Computer, routines, approvals, artifacts, and context open as full-screen sheets/pages from the conversation, not as unreadable squeezed columns.
- Mobile navigation preserves draft messages, attachment uploads, live run status, scroll position, and computer-session continuity.

## Required functional parity

### Workforce and bot creation

- Create a custom bot conversationally or through the structured configuration wizard.
- Choose identity, color, role, instructions, knowledge, tools, BUILD GROWTH access, Linux-computer permissions, routines, reporting relationship, autonomy, and approvals.
- Test the bot in a sandbox, deploy it, and have it appear in the same roster as the built-in workforce.

### Individual and group chat

- Persistent direct chat with every employee.
- Create group conversations with the user, CHIEF, selected managers, and custom bots.
- Mention employees, delegate bounded tasks, view handoff cards, and receive a consolidated outcome.
- Prevent endless agent-to-agent chatter by requiring objective, ownership, stop conditions, and completion state.

### Connected applications

- Integrations entry point matches the simple, discoverable placement in the reference.
- Connect BUILD GROWTH and other supported services using secure authorization, account/workspace selection, scopes, connection test, health, renewal, and revoke.
- Chat actions surface which connection will be used before a consequential operation.

### Routines and scheduled work

- Create routines in natural language or form view.
- Display routine name, schedule, next run, assigned employee, scope, state, and last outcome in the contextual pane.
- Pause, resume, edit, run now, and delete with authorization and audit history.
- Sunday mission planning and morning/afternoon/evening reports use the same routine presentation rather than a separate disconnected scheduler UI.

### Live computer

- Every employee has its own persistent isolated Linux computer.
- Start/open the computer from the conversation header or contextual pane.
- Show live view, current action, elapsed time, plan step, input ownership, connection quality, and evidence capture.
- Support view only, take control, return control, pause, resume, stop, reconnect, and safe recovery.
- Keep credentials outside the visible desktop, screenshots, recordings, messages, and downloadable artifacts.

### Voice, files, and evidence

- Microphone supports voice notes first and governed live voice with CHIEF when enabled.
- Attachments support upload, preview, download, malware scanning, processing state, retention rules, and task linkage.
- Results contain citations, BUILD GROWTH deep links, downloadable artifacts, or redacted screenshots as appropriate.

### Approvals without workflow disruption

- Approval requests appear inside the relevant conversation and in the contextual pane, with a central approval inbox available through launcher/deep link.
- The user sees the exact action, destination, content/amount, record version, reason, evidence, expiry, and approve/reject/request-changes controls.
- Approved actions execute once; material mutation requires new approval.

## BUILD BOT visual translation

- Preserve the reference's white/light-neutral simplicity and true-black dark mode, fine dividers, restrained shadows, compact spacing, and high information density.
- Use BUILD BOT logo/wordmark and the supplied eleven detailed robot images. Use agent color mainly for avatar frames, presence glow, small badges, selected states, and subtle context accents.
- Custom bots use the approved 18-color palette while maintaining accessible contrast and clear identity distinction.
- Prefer system or properly licensed typography with metrics chosen to preserve the reference's compact rhythm.
- Motion is quick and subtle: pane transitions, streaming cursor, status changes, drawer/sheet movement, and avatar activity only. Respect reduced motion.
- Do not copy the blue promotional background, device mockup, Grok example employees, or demo business content into the product UI.

## State and truthfulness requirements

Every visible status must come from persisted execution state. Required states include loading, empty, unread, composing, uploading, transcribing, queued, planning, working, waiting for approval, paused, disconnected, reconnecting, completed, partial, failed, cancelled, permission denied, connection expired, offline computer, and quota/limit reached.

Never animate a bot as “working” based on a client timer. The roster preview, message timeline, right-pane computer state, routines, approvals, and BUILD GROWTH record state must reconcile after refresh, reconnect, and worker restart.

## Implementation constraints

- Build the shell as reusable responsive layout primitives, not eleven separate page copies.
- Use virtualized lists where roster/message history warrants it and preserve accessible DOM semantics.
- Persist pane and selection state in URLs so direct links and browser history work.
- Keep interactive controls keyboard operable with visible focus and WCAG AA contrast.
- Use component, integration, accessibility, responsive, and visual-regression tests.
- Seeded screenshots and fixtures must show a visible `Demo` label; production views use real organization data only.

## Visual acceptance breakpoints

Capture and approve BUILD BOT baselines for at least:

- 1440×900 desktop: three panes.
- 1280×800 desktop: three panes with compact widths.
- 1024×768 tablet landscape: roster/chat with contextual drawer.
- 768×1024 tablet portrait: single/dual pane according to space.
- 390×844 mobile and 430×932 mobile: workforce home, conversation, computer, routines, and approval sheet.

Functional parity is not accepted from screenshots alone. Each referenced control must execute through the real API, workflow, policy, database, event stream, and computer/integration path specified elsewhere in this plan.
