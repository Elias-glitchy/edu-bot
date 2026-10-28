# BUILD BOT — Astra 6 build pack

This folder is the implementation source of truth for building BUILD BOT from an empty repository.

Read the documents in this order:

1. `00_ASTRA_6_MASTER_BUILD_PROMPT.md`
2. `01_PRODUCT_AND_UX_SPEC.md`
3. `02_SYSTEM_ARCHITECTURE.md`
4. `03_DATA_MODEL_AND_API.md`
5. `04_AGENT_AND_LINUX_RUNTIME.md`
6. `05_SECURITY_APPROVALS_AND_AUDIT.md`
7. `06_DELIVERY_ROADMAP.md`
8. `07_ACCEPTANCE_TESTS.md`
9. `08_ASSET_PACKAGING_MANIFEST.md`
10. `09_CUSTOM_AGENT_VISUAL_SYSTEM.md`
11. `10_BUILD_GROWTH_INTEGRATION.md`
12. `11_GROK_BOT_UX_FUNCTIONAL_PARITY.md`

The repository was empty when this pack was prepared. Static mockups, brand files, robot images, and the Grok Bot recording are reference material. They do not prove any feature has been implemented.

## Product outcome

BUILD BOT is a multi-tenant autonomous AI workforce SaaS with two first-class surfaces: its standalone command center and its native embedded experience inside BUILD GROWTH. Both surfaces use the same workforce, permissions, missions, approvals, execution history, evidence, and per-bot Linux computers. CHIEF and ten specialist managers operate the construction growth journey from opportunity discovery through pursuit, tendering, quoting, invoicing, and payment follow-up; organizations may also create custom agents.

## Working rule

Build vertical slices that are real from UI to database to workflow to execution. Never present seeded examples, timers, animations, or mocked responses as live agent work. Development fixtures must be visibly labeled.

