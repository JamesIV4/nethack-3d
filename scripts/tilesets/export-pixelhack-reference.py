"""Export a PixelHack tile and an optional render comparison for image review."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "tools/pixelhack-reference/catalog.json"
ATLAS_PATH = ROOT / "public/assets/5.0/PixelHack.png"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tile", type=int, required=True, help="Zero-based PixelHack tile ID")
    parser.add_argument("--output", type=Path, help="Output PNG; defaults to tools/pixelhack-reference/exports/tile-NNNN.png")
    parser.add_argument("--render", type=Path, help="Optional Blender render PNG/JPEG to include beside the tile")
    parser.add_argument("--scale", type=int, default=16, help="Nearest-neighbor tile scale (default 16)")
    args = parser.parse_args()
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf8"))
    if args.tile < 0 or args.tile >= len(catalog["tiles"]):
        parser.error(f"--tile must be in 0..{len(catalog['tiles']) - 1}")
    if args.scale < 1:
        parser.error("--scale must be positive")
    tile_size = catalog["tileSize"]
    atlas = Image.open(ATLAS_PATH).convert("RGBA")
    if atlas.size != (catalog["columns"] * tile_size, catalog["rows"] * tile_size):
        raise ValueError("Atlas dimensions do not match the catalog")

    def crop(tile_id):
        x, y = tile_id % catalog["columns"] * tile_size, tile_id // catalog["columns"] * tile_size
        return atlas.crop((x, y, x + tile_size, y + tile_size))

    raw = crop(args.tile)
    reference = crop(2304)
    isolated = raw.copy()
    isolated.putdata([(r, g, b, 0) if (r, g, b) == ref[:3] or (r, g, b) == (131, 171, 162)
                      else (r, g, b, a)
                      for (r, g, b, a), ref in zip(raw.get_flattened_data(), reference.get_flattened_data())])
    size = tile_size * args.scale
    enlarged = isolated.resize((size, size), Image.Resampling.NEAREST)

    def on_background(color):
        backdrop = Image.new("RGBA", (size, size), color)
        return Image.alpha_composite(backdrop, enlarged).convert("RGB")

    panels = [("Original tile", raw.resize((size, size), Image.Resampling.NEAREST)),
              ("Masked on light", on_background("#ded9c6")),
              ("Masked on dark", on_background("#1d282b"))]
    if args.render:
        with Image.open(args.render) as render_file:
            render = render_file.convert("RGBA")
        render.thumbnail((size, size), Image.Resampling.LANCZOS)
        panel = Image.new("RGBA", (size, size), (36, 48, 49, 255))
        panel.alpha_composite(render, ((size - render.width) // 2, (size - render.height) // 2))
        panels.append(("Blender render", panel))
    margin, label_height = 12, 36
    sheet = Image.new("RGB", (len(panels) * (size + margin) + margin, size + label_height + margin * 2), "#182426")
    draw = ImageDraw.Draw(sheet)
    for index, (label, panel) in enumerate(panels):
        x = margin + index * (size + margin)
        draw.text((x, 7), label, fill="#edf5ed")
        sheet.paste(panel, (x, label_height), panel if panel.mode == "RGBA" else None)
    out = args.output or ROOT / "tools/pixelhack-reference/exports" / f"tile-{args.tile:04d}.png"
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    main()
