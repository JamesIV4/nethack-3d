"""Compose unaltered source pixels and Blender renders for asset review."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]


def font(size):
    for path in ["C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--tile", type=int, default=0)
    args = parser.parse_args()
    directory = args.directory.resolve()
    stats = json.loads((directory / "model.json").read_text())
    atlas = Image.open(ROOT / "public/assets/5.0/PixelHack.png").convert("RGBA")
    def crop(index):
        x, y = index % 40 * 32, index // 40 * 32
        return atlas.crop((x, y, x + 32, y + 32))
    raw, background = crop(args.tile), crop(2304)
    masked = raw.copy()
    masked.putdata([(*p[:3], 0) if p[:3] == bg[:3] or p[:3] == (131, 171, 162) else p
                    for p, bg in zip(raw.get_flattened_data(), background.get_flattened_data())])
    sheet = Image.new("RGB", (1440, 1110), "#182126")
    draw = ImageDraw.Draw(sheet)
    draw.text((28, 20), "PIXELHACK / " + stats["title"].upper(), font=font(29), fill="#e7ede8")
    tiles = ' + '.join(map(str, stats['tileIds']))
    clips = ' + '.join(stats['animations'])
    draw.text((28, 62), f"Tiles {tiles}  |  {stats['triangles']:,} triangles  |  {stats['bones']} bones  |  {clips}", font=font(17), fill="#a9bbb3")
    def panel(image, x, y, size, label, color="#ded9c6", pixel=False):
        board = Image.new("RGBA", (size, size), color)
        image = image.convert("RGBA").resize((size, size), Image.Resampling.NEAREST if pixel else Image.Resampling.LANCZOS)
        board.alpha_composite(image)
        sheet.paste(board.convert("RGB"), (x, y))
        draw.text((x, y + size + 7), label, fill="#bbc9c3", font=font(15))
    panel(masked, 28, 108, 256, "Source · light", pixel=True)
    panel(masked, 28, 407, 256, "Source · dark", color="#1d282b", pixel=True)
    if "hero" in stats["views"] and (directory / "hero.png").exists():
        panel(Image.open(directory / "hero.png"), 314, 108, 554, "Three-quarter · rigged model")
    if "side" in stats["views"] and (directory / "side.png").exists():
        panel(Image.open(directory / "side.png"), 898, 108, 512, "Side · silhouette and palette")
    for index, view in enumerate(["front", "top"]):
        if view in stats["views"] and (directory / f"{view}.png").exists():
            panel(Image.open(directory / f"{view}.png"), 28 + index * 282, 718, 256, view.title())
    draw.text((604, 721), "GAME-SIZE READABILITY", fill="#bbc9c3", font=font(17))
    small_view = stats.get("reviewSmallView", "side")
    if small_view in stats["views"] and (directory / f"{small_view}.png").exists():
        source_render = Image.open(directory / f"{small_view}.png").convert("RGBA")
        for index, size in enumerate([32, 64, 128]):
            small = source_render.resize((size, size), Image.Resampling.LANCZOS)
            panel(small, 604 + index * 212, 760, 180, f"{size} px · enlarged", pixel=True)
    note = ({
        "killer-bee": "Hovering body, pale raised wings, dark face and legs, visible rear stinger: the killer bee silhouette.",
        "soldier-ant": "Broad olive gaster, tan highlights, long dark legs, red eyes, hooked jaws: the soldier ant silhouette.",
        "dwarf-male": "Blue-gray horned helmet, ivory beard, raised curved pick, red tunic and shield: the male dwarf silhouette.",
    }).get(stats["id"],
           "Smooth carapace, red eyes, spread jaws, lifted forelegs: an attack-ready pose based on the source tile.")
    draw.text((28, 1033), note, font=font(17), fill="#e1e8e1")
    draw.text((28, 1063), "Source shadow excluded. Blender: -Y forward / Z up; GLB: +Z forward / Y up.", font=font(15), fill="#9bb0a6")
    sheet.save(directory / "review.png")
    print(directory / "review.png")


if __name__ == "__main__":
    main()
