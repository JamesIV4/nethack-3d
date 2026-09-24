# Instructions for a research subagent

Claim one `id` from `../research-queue.json` (for example `M-002`). Work only
on that batch and write `M-002.json` here. Other agents can work on different
files at the same time. Do not edit `../research.json`; it is compiled from
these packs.

For each `researchKey` in the batch:

1. Open `http://127.0.0.1:5175/tools/pixelhack-reference/#tile=<firstTileId>`
   or export the exact crop with `py scripts/tilesets/export-pixelhack-reference.py
   --tile <firstTileId>` and inspect it with `view_image`.
2. Check `../art-analysis.json` for a distinct male/female image. Inspect both
   when they differ. Source sex labels can also be placeholders for female-only
   or genderless monsters.
3. Read the relevant NetHack Wiki article. Use its anatomy and game identity
   as context; derive colors, pose, and clothing from the PixelHack crop.
4. For objects, model `appearance` and `objectClass` from `../catalog.json`.
   `sourceAssociation` may change with randomized item appearances.
5. Write an original short paragraph each for `visualDescription`,
   `wikiDescription`, and `modelBrief`, with direct source links. Add per-tile
   `variantNote` entries only where they help.

Use this shape, replacing the example subject and URL with the actual source:

```json
{
  "schemaVersion": 1,
  "subjects": {
    "monster:chickatrice": {
      "wikiTitle": "Chickatrice",
      "visualDescription": "Describe only the visible PixelHack crop.",
      "wikiDescription": "Summarize source-supported form and identity.",
      "modelBrief": "State the specific 3D forms, palette, and variant decisions.",
      "sources": [
        { "label": "NetHack Wiki: chickatrice", "url": "https://nethackwiki.com/wiki/Chickatrice" }
      ]
    }
  },
  "tiles": {}
}
```

After the agent files are reviewed, run `npm.cmd run pixelhack:research:compile`
once to merge them, then `npm.cmd run pixelhack:reference:check`. The compiler
rejects duplicate keys and unknown tile IDs.
