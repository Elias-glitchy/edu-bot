# Asset and final ZIP packaging manifest

The eventual Astra build ZIP should contain the planning pack and approved source assets without duplicate archives.

## Source archives already inspected

- `BUILD_BOT_Complete_Design_Kit.zip` — brand files, robot gallery, and UI prompt documents.
- `BUILD_BOT_44_Individual_UI_Images.zip` — 44 static screen references.
- `BUILD_BOT_ALL_11_COLOR_GROUPS_ROBOT_IMAGES (1).zip` — 67 robot PNGs across eleven color groups.

Numbered duplicate copies of the Complete Design Kit are byte-identical. The two eleven-color robot ZIPs are also byte-identical. Include only one copy of each source set.

## Final ZIP structure

```text
BUILD_BOT_ASTRA_6_BUILD_KIT/
  README.md
  planning/
    00_ASTRA_6_MASTER_BUILD_PROMPT.md
    01_PRODUCT_AND_UX_SPEC.md
    02_SYSTEM_ARCHITECTURE.md
    03_DATA_MODEL_AND_API.md
    04_AGENT_AND_LINUX_RUNTIME.md
    05_SECURITY_APPROVALS_AND_AUDIT.md
    06_DELIVERY_ROADMAP.md
    07_ACCEPTANCE_TESTS.md
    08_ASSET_PACKAGING_MANIFEST.md
    09_CUSTOM_AGENT_VISUAL_SYSTEM.md
    10_BUILD_GROWTH_INTEGRATION.md
    11_GROK_BOT_UX_FUNCTIONAL_PARITY.md
  assets/
    brand/
      official-logo-dark.png
      official-logo-light.png
      app-icon-dark.png
      app-icon-light.png
      official-wordmark-white.png
      official-wordmark-black.png
    agents/
      chief/
      operations-manager/
      finance-manager/
      sales-manager/
      outbound-manager/
      intelligence-manager/
      crm-manager/
      marketing-manager/
      technology-manager/
      tender-bid-manager/
      estimating-commercial-manager/
    design-reference/
      desktop/
      mobile/
  manifests/
    assets.json
    checksums.sha256
    provenance.md
  reference/
    build-growth/
      BUILD_Pitch_Deck_MANCOSA_Hackathon_2026_compressed.pdf
    grok-bot-ui/
      1786889381857.png
```

## Packaging rules

1. Copy original images; do not recompress or rename without preserving an original-to-packaged mapping.
2. Select and document one primary avatar per employee plus optional greeting, working/dashboard, success, and portrait variants where the archive provides them.
3. Do not invent missing poses. Not every color group contains the same count.
4. Record width, height, color mode, SHA-256, source archive path, packaged path, role, color group, pose, and intended UI use in `assets.json`.
5. Preserve the official product wordmark and logo. Use the colorful robots as workforce identities.
6. The source robots have opaque dark backgrounds. Keep them unchanged in the source pack. If production derivatives are created, store them separately and record the transformation.
7. Include the 44 UI images under design reference, clearly labeled as nonfunctional mockups.
8. Exclude the Grok tutorial video from the build ZIP unless the owner explicitly requests it; the plan already records the observed behavior and the video is third-party reference media.
9. Generate `checksums.sha256` after packaging and test the ZIP before delivery.
10. Include the supplied BUILD GROWTH pitch deck as product-context reference. Treat it as product intent, not proof of implemented APIs or features.
11. Include the supplied Grok Bot screenshot as a visual/interaction reference. Do not reuse Grok names, trademarks, example data, or proprietary assets in the BUILD BOT product.

## Proposed avatar selection workflow

1. Use the default role/color mapping in `01_PRODUCT_AND_UX_SPEC.md`.
2. Produce a review sheet with the proposed primary and supporting poses.
3. Obtain owner approval or revisions.
4. Create the organized asset folders and manifest.
5. Package the approved plan and assets into the final ZIP.

