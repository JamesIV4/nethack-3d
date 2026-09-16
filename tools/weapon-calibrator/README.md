# Quest weapon calibrator

From the repository root run:

```sh
npm run weapon:calibrate
```

This starts a separate local utility and opens `http://127.0.0.1:5174/tools/weapon-calibrator/` in your browser. No game session or headset is required. Stop the server with Ctrl+C.

1. Choose a bundled atlas tileset, then click a sprite in the atlas page or enter its tile ID. Previous/next buttons or the **Left/Right arrow keys** step through sprites one at a time. Arrow navigation stops at the first/last sprite and leaves unsaved edits intact. When an input, slider or dropdown is focused, arrow keys retain their normal editing behavior.
2. Under **Flat FPS sprite base**, use **Flip X**, **Flip Y** and **Diagonal** to correct the selected sprite's image orientation. Diagonal swaps X/Y before the other flips. The flat thumbnail and 3D preview update immediately. These corrections apply to the same sprite in flat FPS and VR. **Use built-in flips** restores the original defaults; **Revert flips to saved** discards unsaved flip changes.
3. Orbit, pan and zoom the 3D view, or choose front, side or top. The cyan point is the attachment / laser origin and the yellow point is the visible sprite center. New sprites are automatically centered with zero tilt before any authored defaults are applied.
4. Adjust **Attachment point** to move where the weapon attaches to the laser origin. Values are pixel offsets from the center of the visible weapon after flips: X right, Y up, Z out of the sprite. Zero attaches at the center. Double-clicking a pixel in the preview selects that pixel as the attachment point.
5. Choose a **Rotation applies to** scope: **All tilesets**, **This tileset**, or **This sprite**. Their X/Y/Z values add together, in 15-degree increments, and the preview shows the combined rotation. All rotation pivots around the sprite's attachment point. Flat FPS supplies sprite flips and diagonal orientation corrections; its held-weapon position and tilt are not applied.
6. **Center this sprite's attachment** resets only its attachment offset. **Reset selected rotation to zero** clears only the selected rotation scope. Revert restores that scope's saved values.
7. Use **Save all changes** or Ctrl+S. Pose edits go to `src/quest/webxr/weapon-pose-defaults.ts`; shared flat FPS flips go to `src/game/engine/rendering/held-weapon-flip-defaults.ts`. Unsaved edits are retained when switching sprites, tilesets and scopes. The next desktop or Quest build includes the applicable defaults.

The preview and runtime both use target-ray space: origin `(0, 0, 0)`, forward `-Z`, with a 0.4 m weapon height. The beam's preview length is 1.5 m; the in-game beam ends at the pointed-at surface. Pixel depth, sprite flips and background removal use the game's implementation. If you changed the game's background-removal settings, match them in the utility's **Background removal** section. Those controls affect the preview, not the saved pose.

The sprite browser currently covers bundled atlas tilesets; Vulture's translated individual images are not atlas entries. The saved library contains `globalRotationDeg`, `tilesetRotationDeg` keyed by tileset path, and `sprites` keyed by tileset path and sprite tile ID. Each sprite stores `attachmentOffsetPixels` from the center of its visible pixels and a `rotationDeg` adjustment. Glyph IDs are reserved for translated sprite keys in the source table.

For an existing browser or a different port:

```sh
npm run weapon:calibrate -- --no-open --port 5180
```

The tool uses port 5174 by default and writes only the two fixed pose and flip source files. It does not build or package the game.
