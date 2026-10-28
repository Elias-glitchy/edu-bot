"""Losslessly split the three supplied 5×5 character sheets into 75 WebP files.

This is mechanical cropping only: no generation, recolouring, compositing, or
resizing. Run again whenever the supplied source sheets are replaced.
"""

from pathlib import Path
from sys import argv
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCES = (
    Path(r"C:\Users\elias\Downloads\ChatGPT Image Oct 13, 2026, 10_11_57 AM.png"),
    Path(r"C:\Users\elias\Downloads\ChatGPT Image Oct 13, 2026, 10_11_43 AM.png"),
    Path(r"C:\Users\elias\Downloads\ChatGPT Image Oct 13, 2026, 10_11_29 AM.png"),
)
OUTPUT = ROOT / "apps" / "web" / "assets" / "bot-avatars"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for sheet_index, source in enumerate(SOURCES):
        with Image.open(source) as sheet:
            width, height = sheet.size
            if (width, height) != (1254, 1254):
                raise ValueError(f"Unexpected sheet dimensions: {source}: {sheet.size}")
            for row in range(5):
                for col in range(5):
                    number = sheet_index * 25 + row * 5 + col + 1
                    bounds = (
                        round(col * width / 5),
                        round(row * height / 5),
                        round((col + 1) * width / 5),
                        round((row + 1) * height / 5),
                    )
                    portrait = sheet.crop(bounds)
                    portrait.save(
                        OUTPUT / f"bot-avatar-{number:03d}.webp",
                        format="WEBP",
                        lossless=True,
                        method=6,
                    )
    print(f"Extracted 75 unchanged character cells to {OUTPUT}")


def verify() -> None:
    checked = 0
    for sheet_index, source in enumerate(SOURCES):
        with Image.open(source) as sheet:
            width, height = sheet.size
            for row in range(5):
                for col in range(5):
                    number = sheet_index * 25 + row * 5 + col + 1
                    bounds = (
                        round(col * width / 5),
                        round(row * height / 5),
                        round((col + 1) * width / 5),
                        round((row + 1) * height / 5),
                    )
                    original = sheet.crop(bounds).convert("RGBA")
                    with Image.open(OUTPUT / f"bot-avatar-{number:03d}.webp") as saved:
                        restored = saved.convert("RGBA")
                    if original.size != restored.size or original.tobytes() != restored.tobytes():
                        raise ValueError(f"Avatar {number:03d} does not match its source cell")
                    checked += 1
    print(f"Verified {checked} lossless avatar crops against the supplied sheets")


if __name__ == "__main__":
    if "--verify-only" not in argv:
        main()
    verify()
