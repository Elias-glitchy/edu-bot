# Agent orchestration and per-bot Linux computers

## Agent execution loop

Every delegated task follows a controlled loop:

1. **Understand:** resolve the objective, expected output, deadline, dependencies, and current organization context.
2. **Plan:** create bounded steps with required tools, data, computer access, and verification.
3. **Authorize:** evaluate each proposed capability/action against agent grants and organization policy.
4. **Execute:** call a connector or acquire the bot's computer lease and perform one recoverable step at a time.
5. **Observe:** persist outcome, evidence, cost, and errors.
6. **Recover or escalate:** retry only classified transient failures; request input or approval when required.
7. **Verify:** test the result against task acceptance criteria.
8. **Report:** deliver the outcome, provenance, limitations, and next action.

CHIEF owns mission-level coordination. Managers own domain work. Custom agents operate according to their configured reporting line. Agents may delegate only capabilities and authority they possess, and delegated work receives its own task record.

## Model routing

Route by task class, risk, context size, modality, latency, and budget. Use stronger reasoning for mission plans, policy-sensitive decisions, and failure recovery; use efficient models for extraction, classification, and summaries. Store the route decision, model identifier, prompt-template version, token usage, latency, and cost with each run. Never place raw credentials in model context.

Require structured model outputs for plans, tool calls, action proposals, verification, and report sections. Validate against schemas and reject unknown fields.

## Memory

Separate memory types:

- Conversation context: recent thread messages and referenced artifacts.
- Task state: authoritative workflow state in PostgreSQL/Temporal.
- Organization knowledge: approved documents and connected sources with provenance.
- Agent memory: scoped facts/preferences with source, confidence, sensitivity, retention, and last validation.
- Episodic summaries: compact summaries of completed work, linked to source events.

Retrieval must filter by organization, agent access, source permission, and retention. Users can inspect, correct, export, and delete eligible memories. Never treat model-generated summaries as stronger evidence than their sources.

## One Linux computer per bot

Each agent owns exactly one logical computer record and encrypted persistent home volume. The compute instance can stop or suspend while idle, but the bot always returns to the same authorized workspace, browser profile, files, and application state unless an administrator resets it.

### Workspace composition

- Hardened Linux image with a minimal desktop, Chromium, file manager, document utilities, and approved runtime tools.
- Automation sidecar for Playwright/CDP browser control plus an accessibility-based desktop adapter for non-browser apps.
- Streaming server for low-latency view/control through the BUILD BOT gateway.
- Encrypted persistent volume mounted as the bot home directory.
- Ephemeral scratch volume for temporary downloads and task working files.
- Agent-specific service identity and short-lived execution grant.
- Egress proxy enforcing organization and connector policy.
- Read-only base image, non-root user, seccomp/AppArmor, resource quota, and sandboxed runtime.

### Isolation model

- Separate workspace and volume per bot; never share a desktop session between bots.
- Separate tenant network policies and service identities.
- Default-deny inbound traffic and controlled outbound destinations.
- Clipboard, upload, download, microphone, and file transfer governed by policy.
- No direct access to the control-plane database or secrets vault.
- Connector credentials are used by a credential proxy or injected as short-lived tokens; they do not appear in the bot filesystem or screen.
- Redact known sensitive regions and secret fields from screenshots and recordings.

### Lifecycle

1. Create the agent, then asynchronously provision its computer and encrypted volume.
2. Keep it `stopped` when unused.
3. Start on a computer-required task; wait for health and policy checks.
4. Acquire an exclusive automation lease. Queue other computer tasks for that bot unless the user explicitly takes control.
5. Stream frames and verified activity events to authorized viewers.
6. Pause automation when the user takes control. Resume only after control is returned and the state is re-observed.
7. Snapshot at safe checkpoints and stop after the configured idle period.
8. Quarantine on suspected compromise; do not auto-resume.

API-only connector tasks can run without starting the computer and may execute concurrently when policy allows. UI automation is serial per computer by default.

### Local and production providers

Define a `ComputerProvider` interface for provision, start, stop, snapshot, reset, health, stream token, and destroy. The local adapter uses Docker with a persistent named volume and a browser/desktop image. Production uses Kubernetes with persistent volumes and a hardened sandbox runtime. Provider identifiers never become business-facing ids.

## Live viewing and human control

The computer gateway issues short-lived audience-bound stream tokens. The viewer shows bot, task, current step, session state, elapsed time, and control owner. All control transitions are audited.

- View only does not disturb automation.
- Take control pauses the automation lease at a safe boundary.
- Return control forces a fresh observation and plan check.
- Pause stops future actions while preserving state.
- Stop cancels the active workflow and releases the lease.
- Emergency revoke disables the bot's computer and integration grants.

## Evidence

Capture evidence at meaningful state transitions and task completion, not as an uncontrolled high-frequency screenshot stream. Store redacted screenshots, downloaded artifacts, source URLs, connector record ids, hashes, timestamps, and action outcomes. Let organization policy configure recording and retention.

## Scheduling and capacity

One computer per bot is a logical ownership guarantee, not a requirement to keep eleven VMs running. Maintain a warm pool for startup speed, then bind isolated runtime capacity to the bot's persistent volume. Apply organization quotas, fair scheduling, maximum execution time, idle shutdown, and cost metering.

