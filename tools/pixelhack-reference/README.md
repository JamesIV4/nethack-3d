# PixelHack 3D modeling reference

This is a preparation workbench for building a 3D tileset from the checked-in
`public/assets/5.0/PixelHack.png`. It does not change game rendering.

## Open the catalog

Run `npm.cmd run pixelhack:reference` in the repository, then open
<http://127.0.0.1:5175/tools/pixelhack-reference/>. Search by name or zero-based
tile ID. The enlarged original, masked previews on light and dark neutral
backgrounds, and an optional Blender render appear side by side. Drop a render
image into the right panel.
Each tile has a stable URL such as
<http://127.0.0.1:5175/tools/pixelhack-reference/#tile=0>.

`catalog.json` covers all **2,320** atlas cells. It is generated from the
NetHack 5.0 `monsters.txt`, `objects.txt`, and `other.txt` tile comment lines
in the local WASM source, in atlas order. The 789 monster images begin at 0,
483 objects at 789, 243 dungeon/effect tiles at 1272, and 789 matching
statue images at 1515. The game glyph catalog confirms the first indices of
those groups. Cells 2304–2307 are generated utility cells; 2308–2319 have no
verified source label, so the catalog calls them unmapped. Tile 2304 is the
game's background reference tile.

To regenerate after the NetHack 5 source changes:

```powershell
npm.cmd run pixelhack:reference:generate
npm.cmd run pixelhack:reference:check
```

The generator's default source path is the local WSL NetHack 5 checkout. On a
different machine, pass `--source-dir` with a NetHack 5 `win/share` folder:

```powershell
node scripts/tilesets/generate-pixelhack-reference.mjs --source-dir <path-to-win-share>
```

The checked-in catalog and viewer work without access to that source checkout.
The catalog stores hashes for the atlas and the three source files so a future
refresh can be reviewed. Tile names are source labels; a slash can mean an
appearance/identity pair, an alias, or a generic class. Do not infer an item's
game effect from its visible appearance. NetHack randomizes many potion, ring,
amulet, wand, scroll, spellbook, and armor appearances between games; see the
[NetHack Wiki's randomized appearance page](https://nethackwiki.com/wiki/Randomized_appearance).
The searchable object-class hint comes from the NetHack 5 glyph catalog; it
lets searches such as "ruby potion" find a source label like "ruby / gain
ability" without treating gain ability as the tile's fixed appearance.
The randomized-appearance hint is limited to the relevant item classes and
the specific shuffled helmets, cloaks, gloves, and boots. Fixed appearances
such as water, blank paper, the Book of the Dead, and the Amulet of Yendor
are marked separately. The [NetHack Wiki appearance list](https://nethackwiki.com/wiki/Randomized_appearance)
is the reference for this distinction.

`art-analysis.json` records which adjacent male/female tiles actually have
identical pixels. Of 394 monster image pairs, 373 are pixel-identical and 21
are visibly different; the source labels alone do not imply different models.
Refresh it with `npm.cmd run pixelhack:reference:analyze` after
changing the atlas or catalog.

## Research and modeling record

`research-queue.json` assigns the 392 monster subjects and 483 object tiles
to 74 small batches of at most 12. Give different subagents different batch
IDs. Each agent writes a separate JSON file under `research-packs/` with its
own `subjects` and optional `tiles` notes, then run
`npm.cmd run pixelhack:research:compile` to refresh the viewer's generated
`research.json` and queue status. The compiler rejects duplicate keys,
unknown subjects, and briefs without source URLs. A male/female pair and its
two statue tiles share one `category:subject` brief; `tiles` holds per-image
differences. The viewer marks missing briefs and offers a **Needs brief**
filter. For each subject, add:

- `visualDescription`: what the PixelHack pixels actually show, including
  silhouette, pose, colors, and defining details;
- `wikiDescription`: source-supported anatomy/material/identity, with no
  assumed colors or pose from a general article;
- `modelBrief`: the concrete 3D requirements and variant decisions;
- `wikiTitle` and `sources`: the exact pages used. Use the
  [NetHack Wiki tile-order module](https://nethackwiki.com/index.php?title=Module:Tileset&oldid=207639)
  as an independent mapping check and individual articles for context.

The [PixelHack creator](https://pixelhack.blogspot.com/) says the sheet was
made for NetHack 5.0 and includes female variants. Preserve both source tile
IDs even when the underlying mesh can be shared. Check version-specific wiki
claims against the local NetHack 5 source.

## Style checks for the first model

PixelHack is a 32×32 pixel sheet with compact silhouettes, limited colors,
strong dark edges, and mostly side or three-quarter poses. At gameplay size,
recognition depends on the main silhouette and one or two features more than
fine surface detail. Start with simple forms and a small material palette;
check the rendered model at tile size as well as in the enlarged comparison.
Do not turn the blue-gray patterned backdrop or baked ground shadow into model
geometry. Keep a statue's shape related to its monster source, then compare
its distinct stone treatment separately. These are starting checks; the first
in-game prototype will determine the final model scale and shading rules.

The viewer's **Copy tile brief** button produces a handoff with source ID,
crop coordinates, current notes, and comparison instructions. A brief marked
"needs research" is a task to complete before modeling, not a generated
visual description. The queue's `researched` values show current coverage.

## Images for an agent or Blender session

Export an exact crop, enlarged with nearest-neighbor sampling:

```powershell
py scripts/tilesets/export-pixelhack-reference.py --tile 0
```

The printed PNG path can be opened with `view_image`, loaded as a Blender
reference image, or passed to a Blender MCP tool when one is connected. To
compare a Blender render on the same sheet:

```powershell
py scripts/tilesets/export-pixelhack-reference.py --tile 0 --render <render.png>
```

The exporter requires Pillow (`py -m pip install pillow` if absent). Generated
review sheets go into the ignored `tools/pixelhack-reference/exports/` folder
unless `--output` is supplied. The original crop is always shown beside the
same masked pixels on light and dark backgrounds. Pattern fragments and
tile-specific scenery such as water can remain after masking, so the original crop is the authority for
model appearance. No shadow or outline is added to the pixels.

The current session has no callable Blender MCP server. Blender 5.1 is
installed at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`,
which can be used headlessly until MCP is connected. The review script renders
front, side, and three-quarter views with repeatable lighting, orthographic
projection, and automatic framing. For a `.blend` model:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' -b <model.blend> --python scripts/tilesets/pixelhack-blender-review.py -- --out-dir tools/pixelhack-reference/exports --prefix tile-0000
```

For `.glb`, omit the `.blend` argument and add `--model <model.glb>` after
`--`. Compare the view that matches the tile's pose with both tile
previews. Check silhouette first, then palette, major forms, distinctive
features, and the male/female or statue variant. Record uncertain details in
the brief rather than treating an inferred wiki illustration as PixelHack art.

The modeling phase still needs an asset format, scale/orientation contract,
and runtime loader. Those choices belong with the first model prototype; the
reference catalog and source mapping are ready independently of them.
