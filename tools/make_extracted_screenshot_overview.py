"""Build a labeled overview of extracted video screenshots."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parent.parent / "video_screenshots_2026-10-11"
shots = sorted(root.glob("[0-9][0-9]_*.png"))
columns, width, height, label_height = 4, 341, 192, 28
rows = (len(shots) + columns - 1) // columns
overview = Image.new("RGB", (columns * width, rows * (height + label_height)), "#eeeeee")
draw = ImageDraw.Draw(overview)
font = ImageFont.load_default()

for index, shot in enumerate(shots):
    x = index % columns * width
    y = index // columns * (height + label_height)
    with Image.open(shot) as source:
        thumbnail = source.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        overview.paste(thumbnail, (x, y + label_height))
    draw.text((x + 7, y + 7), shot.stem.replace("_", " "), font=font, fill="#111111")

output = root / "contact_sheet.jpg"
overview.save(output, quality=90)
print(output)
