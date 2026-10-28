from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
ROBOT_ZIP = DOWNLOADS / "BUILD_BOT_ALL_11_COLOR_GROUPS_ROBOT_IMAGES (1).zip"
DESIGN_ZIP = DOWNLOADS / "BUILD_BOT_Complete_Design_Kit.zip"
UI_ZIP = DOWNLOADS / "BUILD_BOT_44_Individual_UI_Images.zip"
GROWTH_DECK = DOWNLOADS / "BUILD_Pitch_Deck_MANCOSA_Hackathon_2026_compressed.pdf"
GROK_UI_REFERENCE = DOWNLOADS / "1786889381857.png"
STAGE = ROOT / "BUILD_BOT_ASTRA_6_BUILD_KIT"
OUTPUT_ZIP = ROOT / "BUILD_BOT_ASTRA_6_BUILD_KIT.zip"


AGENTS = [
    {
        "order": 1,
        "slug": "chief",
        "name": "CHIEF",
        "role": "AI Executive Orchestrator",
        "group": "01_Royal_Blue",
        "uses": {
            "primary": "02_futuristic_blue_glow_robot_mascot.png",
            "working": "05_neon_analytics_robot_assistant.png",
            "greeting": "07_waving_neon_blue_robot_mascot.png",
            "success": "04_glossy_blue_eyed_robot_mascot.png",
            "portrait": "01_cheerful_neon_blue_sci_fi_robot.png",
        },
    },
    {
        "order": 2,
        "slug": "operations-manager",
        "name": "Operations Manager",
        "role": "Business operations and execution",
        "group": "02_Cyan_Blue",
        "uses": {
            "primary": "03_friendly_cyan_robot_mascot.png",
            "working": "02_cute_cyan_robot_with_holographic_dashboard.png",
            "greeting": "04_friendly_neon_robot_mascot.png",
            "success": "05_glossy_cyan_robot_thumbs_up.png",
            "portrait": "06_heroic_neon_cyan_robot_mascot.png",
        },
    },
    {
        "order": 3,
        "slug": "finance-manager",
        "name": "Finance Manager",
        "role": "Financial monitoring and authorized finance workflows",
        "group": "03_Emerald_Green",
        "uses": {
            "primary": "02_emerald_neon_robot_portrait.png",
            "working": "01_cheerful_robot_analyzing_holographic_data.png",
            "greeting": "06_glossy_green_robot_waving_cheerfully.png",
            "success": "05_glossy_emerald_robot_thumbs_up.png",
            "portrait": "08_smiling_emerald_robot_welcome.png",
        },
    },
    {
        "order": 4,
        "slug": "sales-manager",
        "name": "Sales Manager",
        "role": "Pipeline, proposals, opportunities, and sales performance",
        "group": "04_Purple_Violet",
        "uses": {
            "primary": "08_glossy_purple_robot_portrait.png",
            "working": "03_friendly_purple_robot_analytics_dashboard.png",
            "greeting": "07_glossy_purple_robot_mascot_waving.png",
            "success": "06_glossy_purple_robot_mascot_thumbs_up.png",
            "portrait": "02_friendly_purple_ai_assistant_robot.png",
        },
    },
    {
        "order": 5,
        "slug": "outbound-manager",
        "name": "Outbound Manager",
        "role": "Prospecting, outreach, and authorized follow-up",
        "group": "05_Crimson_Red",
        "uses": {
            "primary": "03_crimson_wink_robot_portrait.png",
            "working": "02_crimson_robot_analyzing_holographic_dashboard.png",
            "greeting": "06_glossy_crimson_robot_waving.png",
            "success": "05_glossy_crimson_robot_thumbs_up.png",
            "portrait": "08_welcoming_crimson_robot_mascot.png",
        },
    },
    {
        "order": 6,
        "slug": "intelligence-manager",
        "name": "Intelligence Manager",
        "role": "Market research and competitive intelligence",
        "group": "06_Gold_Amber",
        "uses": {
            "primary": "05_golden_robot_with_crescent_eyes.png",
            "working": "02_golden_robot_analytics_mascot.png",
            "greeting": "03_golden_robot_mascot_waving.png",
            "success": "04_golden_robot_thumbs_up_mascot.png",
            "portrait": "01_glossy_gold_hovering_robot_mascot.png",
        },
    },
    {
        "order": 7,
        "slug": "crm-manager",
        "name": "CRM Manager",
        "role": "Customer records, relationships, and follow-ups",
        "group": "07_Orange",
        "uses": {
            "primary": "03_glossy_orange_robot_mascot_portrait.png",
            "working": "01_futuristic_orange_robot_analytics_assistant.png",
            "greeting": "04_glossy_orange_robot_mascot_waving.png",
            "success": "05_glossy_orange_robot_thumbs_up.png",
            "portrait": "02_glossy_orange_robot_mascot.png",
        },
    },
    {
        "order": 8,
        "slug": "marketing-manager",
        "name": "Marketing Manager",
        "role": "Campaigns, content, promotion, and performance",
        "group": "08_Magenta_Pink",
        "uses": {
            "primary": "02_glossy_pink_robot_mascot_portrait.png",
            "working": "05_neon_pink_robot_analytics_mascot.png",
            "greeting": "03_glossy_pink_robot_mascot_waving.png",
            "success": "04_glossy_pink_robot_thumbs_up.png",
            "portrait": "01_cheerful_pink_robot_stride.png",
        },
    },
    {
        "order": 9,
        "slug": "technology-manager",
        "name": "Technology Manager",
        "role": "Integrations, technical tasks, and computer operations",
        "group": "09_Teal",
        "uses": {
            "primary": "04_glossy_teal_robot_mascot_with_crescent_eyes.png",
            "working": "03_futuristic_robot_analytics_mascot.png",
            "greeting": "02_friendly_teal_robot_mascot_waving.png",
            "success": "05_glossy_teal_robot_thumbs_up.png",
            "portrait": "01_cheerful_teal_robot_mascot_wave.png",
        },
    },
    {
        "order": 10,
        "slug": "tender-bid-manager",
        "name": "Tender & Bid Manager",
        "role": "Tender discovery, eligibility, preparation, and deadlines",
        "group": "10_Silver_Graphite",
        "uses": {
            "primary": "05_futuristic_friendly_robot_portrait.png",
            "working": "04_friendly_robot_analytics_dashboard.png",
            "greeting": "03_friendly_futuristic_robot_waving.png",
            "success": "02_friendly_futuristic_robot_thumbs_up.png",
            "portrait": "01_friendly_futuristic_robot_mascot.png",
        },
    },
    {
        "order": 11,
        "slug": "estimating-commercial-manager",
        "name": "Estimating & Commercial Manager",
        "role": "Quotations, BOQs, estimates, pricing, and commercial review",
        "group": "11_Lime_Neon_Green",
        "uses": {
            "primary": "02_neon_green_friendly_robot_mascot.png",
            "working": "01_cheerful_robot_presenting_neon_analytics.png",
            "greeting": "05_neon_green_robot_mascot_waving.png",
            "success": "04_neon_green_robot_mascot_thumbs_up.png",
            "portrait": "03_neon_green_optimist_robot_portrait.png",
        },
    },
]


CUSTOM_PALETTE = {
    "midnight": "#1E293B",
    "indigo": "#4F46E5",
    "sapphire": "#2563EB",
    "azure": "#0284C7",
    "aqua": "#0891B2",
    "mint": "#059669",
    "forest": "#15803D",
    "olive": "#4D7C0F",
    "sunflower": "#CA8A04",
    "amber": "#D97706",
    "coral": "#EA580C",
    "rose": "#E11D48",
    "berry": "#BE185D",
    "orchid": "#C026D3",
    "violet": "#7C3AED",
    "cocoa": "#92400E",
    "slate": "#475569",
    "platinum": "#71717A",
}


BRAND_MAP = {
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/App_Icons/BUILD_BOT_App_Icon_Dark_1024.png": "assets/brand/app-icon-dark.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/App_Icons/BUILD_BOT_App_Icon_Light_1024.png": "assets/brand/app-icon-light.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Logo_Lockups/BUILD_BOT_Horizontal_Dark.png": "assets/brand/official-logo-dark.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Logo_Lockups/BUILD_BOT_Horizontal_Light.png": "assets/brand/official-logo-light.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Source_Assets/BUILD_BOT_Official_Robot_Black.png": "assets/brand/official-robot-black.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Source_Assets/BUILD_BOT_Official_Wordmark_White_On_Black.png": "assets/brand/official-wordmark-white-on-black.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Source_Assets/BUILD_BOT_Wordmark_Black_Transparent.png": "assets/brand/official-wordmark-black.png",
    "BUILD_BOT_Complete_Design_Kit/02_Official_Brand/Source_Assets/BUILD_BOT_Wordmark_White_Transparent.png": "assets/brand/official-wordmark-white.png",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_zip_member(archive: zipfile.ZipFile, member: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with archive.open(member) as source, destination.open("wb") as target:
        shutil.copyfileobj(source, target)


def slug_variant(filename: str) -> str:
    stem = Path(filename).stem
    sequence, description = stem.split("_", 1)
    return f"{sequence}-{description.replace('_', '-')}.png"


def package() -> None:
    for required in (ROBOT_ZIP, DESIGN_ZIP, UI_ZIP, GROWTH_DECK, GROK_UI_REFERENCE):
        if not required.exists():
            raise FileNotFoundError(required)

    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    shutil.copy2(ROOT / "BUILD_BOT_IMPLEMENTATION_PLAN.md", STAGE / "REPOSITORY_ASSESSMENT.md")
    shutil.copytree(ROOT / "planning", STAGE / "planning")

    root_readme = """# BUILD BOT — Astra 6 build kit

Start with `planning/README.md`, then give Astra 6 the instructions in
`planning/00_ASTRA_6_MASTER_BUILD_PROMPT.md`.

This kit contains the complete implementation plan, official brand assets,
all 67 supplied employee robot variants organized by role, 44 static UI
references, original design prompts, an asset manifest, a selected-avatar
preview, the supplied BUILD GROWTH pitch deck, the supplied Grok Bot visual
reference, provenance notes, and SHA-256 checksums.

The UI images are design references. They are not application code or proof
of implemented functionality. The BUILD GROWTH deck documents product intent,
not proof of existing APIs or features. The Grok Bot video is not redistributed
here.
"""
    (STAGE / "README.md").write_text(root_readme, encoding="utf-8")

    assets: list[dict[str, object]] = []
    with zipfile.ZipFile(DESIGN_ZIP) as archive:
        for source, relative in BRAND_MAP.items():
            destination = STAGE / relative
            copy_zip_member(archive, source, destination)
            with Image.open(destination) as image:
                size = list(image.size)
                mode = image.mode
            assets.append(
                {
                    "kind": "brand",
                    "source_archive": DESIGN_ZIP.name,
                    "source_path": source,
                    "packaged_path": relative.replace("\\", "/"),
                    "sha256": sha256(destination),
                    "bytes": destination.stat().st_size,
                    "dimensions": size,
                    "mode": mode,
                }
            )

        for member in archive.namelist():
            if member.startswith("BUILD_BOT_Complete_Design_Kit/01_UX_UI_Prompts/") and member.lower().endswith(".md"):
                destination = STAGE / "reference" / "original-design-prompts" / Path(member).name
                copy_zip_member(archive, member, destination)

    selected_paths: dict[str, dict[str, Path]] = {}
    with zipfile.ZipFile(ROBOT_ZIP) as archive:
        for agent in AGENTS:
            folder = STAGE / "assets" / "agents" / str(agent["slug"])
            folder.mkdir(parents=True, exist_ok=True)
            source_prefix = f"BUILD_BOT_11_GROUPS/{agent['group']}/"
            members = sorted(
                member
                for member in archive.namelist()
                if member.startswith(source_prefix) and member.lower().endswith(".png")
            )
            reverse_uses = {value: key for key, value in dict(agent["uses"]).items()}
            selected_paths[str(agent["slug"])] = {}
            for member in members:
                source_name = Path(member).name
                packaged_name = slug_variant(source_name)
                relative = Path("assets") / "agents" / str(agent["slug"]) / packaged_name
                destination = STAGE / relative
                copy_zip_member(archive, member, destination)
                intended_use = reverse_uses.get(source_name, "alternate")
                if intended_use != "alternate":
                    selected_paths[str(agent["slug"])][intended_use] = destination
                with Image.open(destination) as image:
                    size = list(image.size)
                    mode = image.mode
                assets.append(
                    {
                        "kind": "agent_avatar",
                        "agent_order": agent["order"],
                        "agent_slug": agent["slug"],
                        "agent_name": agent["name"],
                        "role": agent["role"],
                        "color_group": agent["group"],
                        "intended_use": intended_use,
                        "source_archive": ROBOT_ZIP.name,
                        "source_path": member,
                        "packaged_path": relative.as_posix(),
                        "sha256": sha256(destination),
                        "bytes": destination.stat().st_size,
                        "dimensions": size,
                        "mode": mode,
                    }
                )

    with zipfile.ZipFile(UI_ZIP) as archive:
        for member in archive.namelist():
            if not member.lower().endswith(".png"):
                continue
            category = "desktop" if "Desktop" in member else "mobile"
            relative = Path("reference") / "ui-mockups" / category / Path(member).name
            destination = STAGE / relative
            copy_zip_member(archive, member, destination)
            assets.append(
                {
                    "kind": "ui_mockup",
                    "source_archive": UI_ZIP.name,
                    "source_path": member,
                    "packaged_path": relative.as_posix(),
                    "sha256": sha256(destination),
                    "bytes": destination.stat().st_size,
                }
            )

    growth_deck_relative = Path("reference") / "build-growth" / GROWTH_DECK.name
    growth_deck_destination = STAGE / growth_deck_relative
    growth_deck_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(GROWTH_DECK, growth_deck_destination)
    assets.append(
        {
            "kind": "product_reference_pdf",
            "source_file": GROWTH_DECK.name,
            "packaged_path": growth_deck_relative.as_posix(),
            "sha256": sha256(growth_deck_destination),
            "bytes": growth_deck_destination.stat().st_size,
            "pages": 22,
            "purpose": "BUILD GROWTH product context; not implementation evidence",
        }
    )

    grok_reference_relative = Path("reference") / "grok-bot-ui" / GROK_UI_REFERENCE.name
    grok_reference_destination = STAGE / grok_reference_relative
    grok_reference_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(GROK_UI_REFERENCE, grok_reference_destination)
    with Image.open(grok_reference_destination) as image:
        grok_reference_size = list(image.size)
        grok_reference_mode = image.mode
    assets.append(
        {
            "kind": "third_party_ui_reference",
            "source_file": GROK_UI_REFERENCE.name,
            "packaged_path": grok_reference_relative.as_posix(),
            "sha256": sha256(grok_reference_destination),
            "bytes": grok_reference_destination.stat().st_size,
            "dimensions": grok_reference_size,
            "mode": grok_reference_mode,
            "purpose": "Grok Bot observable layout and interaction reference; do not reuse third-party branding",
        }
    )

    preview_dir = STAGE / "preview"
    preview_dir.mkdir(parents=True, exist_ok=True)
    preview_path = preview_dir / "selected-agent-avatars.png"
    cell_width, cell_height = 300, 350
    sheet = Image.new("RGB", (cell_width * 4, cell_height * 3), "#E5E5E5")
    draw = ImageDraw.Draw(sheet)
    for index, agent in enumerate(AGENTS):
        image_path = selected_paths[str(agent["slug"])]["primary"]
        with Image.open(image_path) as image:
            fitted = ImageOps.fit(image.convert("RGB"), (280, 280))
        x = (index % 4) * cell_width + 10
        y = (index // 4) * cell_height + 48
        sheet.paste(fitted, (x, y))
        draw.text((x, y - 36), f"{agent['order']:02d}  {agent['name']}", fill="#111111")
    sheet.save(preview_path)

    manifests = STAGE / "manifests"
    manifests.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product": "BUILD BOT",
        "built_in_agents": AGENTS,
        "custom_agent_palette": CUSTOM_PALETTE,
        "assets": sorted(assets, key=lambda item: str(item["packaged_path"])),
    }
    (manifests / "assets.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (manifests / "custom-bot-palette.json").write_text(json.dumps(CUSTOM_PALETTE, indent=2), encoding="utf-8")

    provenance = f"""# Provenance

Generated from user-supplied local source material on 13 October 2026.

- `{DESIGN_ZIP.name}`: official brand assets and original design prompts.
- `{UI_ZIP.name}`: 44 static UI reference images.
- `{ROBOT_ZIP.name}`: 67 original robot images grouped by color.
- `{GROWTH_DECK.name}`: 22-page BUILD GROWTH product-context deck.
- `{GROK_UI_REFERENCE.name}`: user-supplied Grok Bot visual reference.

No robot images were invented, recolored, cropped, or recompressed in the
packaged agent folders. The preview contact sheet is the only generated image
and exists solely for selection review. Original source paths and hashes are
recorded in `assets.json`.

The Grok Bot tutorial video is not included. It is third-party reference media.
The BUILD GROWTH pitch deck is included as product context and is not evidence
that any described API, workflow, data source, or feature is implemented.
The Grok Bot screenshot is included only as an observable UX reference. Do not
reuse third-party names, logos, example data, assets, or claim access to its
proprietary implementation.
"""
    (manifests / "provenance.md").write_text(provenance, encoding="utf-8")

    checksum_lines = []
    for path in sorted(p for p in STAGE.rglob("*") if p.is_file() and p.name != "checksums.sha256"):
        checksum_lines.append(f"{sha256(path)}  {path.relative_to(STAGE).as_posix()}")
    (manifests / "checksums.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    if OUTPUT_ZIP.exists():
        OUTPUT_ZIP.unlink()
    with zipfile.ZipFile(OUTPUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(p for p in STAGE.rglob("*") if p.is_file()):
            archive.write(path, Path(STAGE.name) / path.relative_to(STAGE))

    with zipfile.ZipFile(OUTPUT_ZIP) as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise RuntimeError(f"ZIP integrity failure: {bad_member}")

    summary = {
        "output_zip": str(OUTPUT_ZIP),
        "zip_bytes": OUTPUT_ZIP.stat().st_size,
        "packaged_files": sum(1 for path in STAGE.rglob("*") if path.is_file()),
        "agent_images": sum(1 for item in assets if item["kind"] == "agent_avatar"),
        "ui_mockups": sum(1 for item in assets if item["kind"] == "ui_mockup"),
        "brand_assets": sum(1 for item in assets if item["kind"] == "brand"),
        "product_reference_pdfs": sum(1 for item in assets if item["kind"] == "product_reference_pdf"),
        "third_party_ui_references": sum(1 for item in assets if item["kind"] == "third_party_ui_reference"),
        "zip_sha256": sha256(OUTPUT_ZIP),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    package()
