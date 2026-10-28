# Inbox redesign verification — 13 October 2026

The supplied screenshot was used as a layout reference, not as a source of product claims or permissions. The additional archive named `BUILD_BOT_ASTRA_6_BUILD_KIT_yes` contains the same 154 entries and CRC/size values as the original kit archive; no replacement assets were needed.

The BUILD BOT browser UI now uses a three-pane inbox layout on desktop (bot list, active conversation, workspace context) and an inbox-to-thread layout on mobile. It retains the supplied BUILD BOT portraits and all existing sections. The right pane shows real saved routines and a clearly labeled unavailable computer state instead of a fictional live screen.

Checks: `node --check apps/web/app.js` passed; `npm test` passed all seven API journeys. A temporary in-memory browser instance was checked at 1440×900 and 390×844 CSS pixels. The bot list and conversation fit without horizontal overflow at mobile width; selecting Finance Manager and sending a fixture research request showed the cited result in the redesigned thread. Browser screenshot capture was unavailable in this environment, so visual verification relied on the rendered accessibility tree and DOM layout measurements.
