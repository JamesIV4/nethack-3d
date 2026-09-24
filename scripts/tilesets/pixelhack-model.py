"""Run in Blender: construct one registered asset, export, and render reviews."""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import pixelhack_blender as ph


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tile", type=int, default=0)
    parser.add_argument("--out-dir", type=Path)
    parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--views", default="hero,side,front,top")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    registry = json.loads((ROOT / "tools/pixelhack-reference/models.json").read_text())
    catalog = json.loads((ROOT / "tools/pixelhack-reference/catalog.json").read_text())
    entry = next((m for m in registry["models"] if args.tile in m["tileIds"]), None)
    if entry is None:
        raise ValueError(f"No model script registered for tile {args.tile}")
    if not 32 <= args.resolution <= 4096:
        raise ValueError("Resolution must be between 32 and 4096")
    views = [v for v in args.views.split(",") if v]
    if set(views) - ph.VIEWS.keys():
        raise ValueError("Unsupported review view")
    out = args.out_dir or ROOT / entry["directory"]
    out.mkdir(parents=True, exist_ok=True)
    atlas_hash = hashlib.sha256((ROOT / "public" / catalog["atlas"].lstrip("/")).read_bytes()).hexdigest()
    if atlas_hash != catalog["atlasSha256"]:
        raise ValueError("Atlas changed; regenerate and review the reference catalog before modeling")
    ph.clean_scene()
    spec = importlib.util.spec_from_file_location("subject", ROOT / entry["script"])
    subject = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(subject)
    subject.build()
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    footprint = entry.get("footprint", .92)
    ground_clearance = entry.get("groundClearance", 0)
    transform = ph.normalize(objects, footprint=footprint, ground_clearance=ground_clearance)
    rig = subject.rig_model(objects, transform) if hasattr(subject, "rig_model") else None
    stats = ph.inspect(objects)
    if stats["triangles"] > entry["triangleBudget"]:
        raise ValueError("Model exceeds the registered triangle budget")
    ph.export_glb(objects, out / "model.glb", entry["id"], rig, entry["tileIds"])
    ph.render_views(objects, out, views, args.resolution)
    if not views:
        center, span = ph.setup_review(objects, args.resolution)
        ph.aim_view(objects, "hero", center, span)
    bpy.context.scene["pixelhack_tile_ids"] = entry["tileIds"]
    bpy.context.scene["pixelhack_contract"] = "1 tile = 1 unit; Z up / -Y forward in Blender; ground origin"
    # Save a useful material-colored authoring view as well as the review camera.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.shading.type = "MATERIAL"
    bpy.context.preferences.filepaths.save_version = 0
    if rig and bpy.data.actions.get("Idle"):
        rig.animation_data.action = bpy.data.actions["Idle"]
        bpy.context.scene.frame_start = 0
        bpy.context.scene.frame_end = int(bpy.data.actions["Idle"].frame_range[1])
        bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str((out / "model.blend").resolve()))
    result = {"schemaVersion": 1, "id": entry["id"], "title": entry["title"], "tileIds": entry["tileIds"],
              "sourceAtlasSha256": atlas_hash,
              "sourceScript": entry["script"],
              "blenderVersion": bpy.app.version_string, **stats,
              "glbBytes": (out / "model.glb").stat().st_size,
              "bones": len(rig.data.bones) if rig else 0,
              "animations": [a.name for a in bpy.data.actions],
              "animationContract": entry.get("animations", {}),
              "footprint": footprint, "groundClearance": ground_clearance,
              "views": views, "resolution": args.resolution,
              "directory": out.resolve().relative_to(ROOT).as_posix() if out.resolve().is_relative_to(ROOT) else str(out.resolve()),
              "palette": ph.PALETTE, "status": "baseline-candidate"}
    (out / "model.json").write_text(json.dumps(result, indent=2) + "\n")
    print("PIXELHACK_RESULT=" + json.dumps(result))


if __name__ == "__main__":
    main()
