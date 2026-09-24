"""Record which adjacent male/female PixelHack tiles are pixel-identical."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "tools/pixelhack-reference"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    catalog = json.loads((REFERENCE / "catalog.json").read_text(encoding="utf8"))
    atlas = Image.open(ROOT / "public/assets/5.0/PixelHack.png").convert("RGBA")
    size = catalog["tileSize"]
    hashes = []
    for tile in catalog["tiles"]:
        index = tile["id"]
        x, y = index % catalog["columns"] * size, index // catalog["columns"] * size
        hashes.append(hashlib.sha256(atlas.crop((x, y, x + size, y + size)).tobytes()).hexdigest())
    pairs = []
    for tile in catalog["tiles"]:
        next_id = tile["id"] + 1
        if tile.get("variant") != "male" or next_id >= len(hashes):
            continue
        sibling = catalog["tiles"][next_id]
        if sibling.get("variant") != "female" or sibling["subject"] != tile["subject"] or sibling["category"] != tile["category"]:
            continue
        pairs.append({"maleTileId": tile["id"], "femaleTileId": next_id,
                      "identicalPixels": hashes[tile["id"]] == hashes[next_id]})
    result = {"schemaVersion": 1, "atlasSha256": catalog["atlasSha256"],
              "uniqueTileImages": len(set(hashes)), "variantPairs": pairs}
    serialized = json.dumps(result, indent=2) + "\n"
    output = REFERENCE / "art-analysis.json"
    if args.check:
        if output.read_text(encoding="utf8") != serialized:
            raise ValueError("PixelHack art analysis is stale")
        print("PixelHack art analysis is current")
    else:
        output.write_text(serialized, encoding="utf8")
        print(f"Wrote {len(pairs)} variant comparisons to {output}")


if __name__ == "__main__":
    main()
