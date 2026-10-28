"""Create small labeled review sheets from sampled video frames."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tmp" / "video_review_20261011_181512"
FRAMES = sorted(SOURCE.glob("sample_*.jpg"))
COLS, ROWS = 4, 5
WIDTH, HEIGHT, LABEL = 455, 256, 26


def stamp(index: int) -> str:
    seconds = (index - 1) * 5
    return f"{seconds // 60:02}:{seconds % 60:02}"


font = ImageFont.load_default()
for offset in range(0, len(FRAMES), COLS * ROWS):
    subset = FRAMES[offset : offset + COLS * ROWS]
    sheet = Image.new("RGB", (COLS * WIDTH, ROWS * (HEIGHT + LABEL)), "#f2f2f2")
    draw = ImageDraw.Draw(sheet)
    for cell, path in enumerate(subset):
        index = offset + cell + 1
        x, y = (cell % COLS) * WIDTH, (cell // COLS) * (HEIGHT + LABEL)
        with Image.open(path) as frame:
            sheet.paste(frame.convert("RGB"), (x, y + LABEL))
        draw.text((x + 8, y + 5), f"#{index:03}  {stamp(index)}", fill="#111111", font=font)
    output = SOURCE / f"sheet_{offset // (COLS * ROWS) + 1:02}.jpg"
    sheet.save(output, quality=83)
    print(output)
