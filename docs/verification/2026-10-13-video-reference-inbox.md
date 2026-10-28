# Video-reference inbox pass — 2026-10-13

The user supplied a 12:58 walkthrough, 25 still references, and a video-derived platform prompt. These are observation references, not product code or permission to impersonate the third-party product.

Implemented in the local alpha:

- Extracted 16 full-resolution video screenshots with timestamps and a labeled overview; delivered separately from the app source.
- Added active custom bots and group conversations to the three-pane inbox.
- Enabled bounded, read-only public research in direct custom-bot conversations.
- Allowed group research to use a selected active bot, preferring Intelligence Manager when present.
- Persisted draft text per conversation on the current device.
- Replaced the decorative computer mock with an explicit unavailable state; no live-computer claim is made.
- Assigned recurring public research to active bots; scheduled results return to that bot's direct conversation. Disabled-bot occurrences are recorded as blocked rather than silently reassigned.
- Added integration tests for custom-bot research, cross-organization access denial, disabled-bot denial, group delegation to Finance Manager, bot-owned routines, and inbox rendering.

Verification: `npm test` with localhost access — 9 passing tests. This pass does not validate hosted identity, actual connectors, billing, computer control, voice, or production deployment. The screenshot references themselves include third-party branding and are not app assets.
