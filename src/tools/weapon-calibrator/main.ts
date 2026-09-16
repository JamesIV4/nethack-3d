import './style.css';
import { getNh3dTilesetCatalog } from '../../game/tilesets';
import { DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET } from '../../game/engine/shared/constants';
import { createWeaponPoseLibrary, normalizeWeaponPose, resolveWeaponPose, weaponPoseKey,
  type WeaponPose, type WeaponRotation } from '../../quest/webxr/weapon-pose';
import { WeaponPreview } from './preview';
import { loadAtlas, type Atlas } from './sprites';
import { resolveHeldWeaponTileFlips } from '../../game/engine/rendering/held-weapon-flips';
import type { FpsHeldWeaponTileFlipOverride, FpsHeldWeaponTileFlipOverridesByTileset } from '../../game/engine/shared/types';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><h1>Quest weapon calibrator</h1><p>Author each sprite's pose, then bake it into Quest.</p></div>
    <button id="save" class="primary" disabled>Save all changes</button></header>
  <main><aside>
    <label>Tileset<select id="tileset"></select></label>
    <div class="tile-navigation"><button id="previous" title="Previous sprite">←</button>
      <label>Sprite tile ID<input id="tile" type="number" min="0" step="1" value="0"></label>
      <button id="next" title="Next sprite">→</button></div>
    <div class="sheet-heading"><span id="sheet-range"></span><button id="page-back">−100</button><button id="page-next">+100</button></div>
    <canvas id="sheet" width="400" height="400" aria-label="Sprite atlas page"></canvas>
    <details><summary>Background removal</summary><p>Use the same background settings as your game.</p>
      <label>Mode<select id="background"><option value="none">None</option><option value="tile">Reference tile</option><option value="solid">Solid color</option></select></label>
      <label>Reference tile<input id="background-tile" type="number" min="0" step="1"></label>
      <label>Solid color<input id="background-color" type="color"></label>
    </details>
  </aside><section class="preview-area">
    <nav aria-label="Preview camera"><button data-view="perspective">Perspective</button><button data-view="front">Front</button>
      <button data-view="side">Side</button><button data-view="top">Top</button></nav>
    <div id="preview"></div>
    <div class="legend"><span class="cyan">● Attachment / laser origin</span><span class="yellow">● Sprite center</span><span>Red X · Green Y · Blue Z</span></div>
    <p class="hint">Drag to orbit · Right-drag to pan · Scroll to zoom · Double-click a pixel to attach there<br>Left / Right arrows: previous / next sprite (outside input controls)<br>The laser starts at (0, 0, 0) and points along −Z, exactly as in VR. Grid squares are 10 cm.</p>
  </section><aside class="pose-controls">
    <h2>Sprite pose</h2><p id="selection"></p>
    <fieldset><legend>Flat FPS sprite base</legend>
      <div class="flip-preview"><canvas id="base-sprite" width="128" height="128" aria-label="Corrected flat held-weapon sprite"></canvas>
        <div><label><input id="flip-x" type="checkbox">Flip X</label><label><input id="flip-y" type="checkbox">Flip Y</label>
          <label><input id="flip-diagonal" type="checkbox">Diagonal</label></div></div>
      <p>For this sprite in this tileset. Shared by flat FPS and VR. Diagonal swaps X and Y before the other flips.</p>
      <button id="builtin-flips">Use built-in flips</button> <button id="revert-flips">Revert flips to saved</button>
    </fieldset>
    <div id="attachment-fields"></div>
    <label>Rotation applies to<select id="rotation-scope"><option value="global">All tilesets</option><option value="tileset">This tileset</option><option value="sprite" selected>This sprite</option></select></label>
    <div id="rotation-fields"></div>
    <p id="effective-rotation"></p>
    <button id="center">Center this sprite's attachment</button>
    <button id="zero-rotation">Reset selected rotation to zero</button>
    <button id="reset">Revert this sprite to saved pose</button>
    <p>Sprites start upright, attached at the center of their visible pixels. Move the attachment point using pixel offsets: X right, Y up, Z out of the sprite. You can also double-click a pixel in the preview. Rotation pivots around the attachment and snaps to 15°.</p>
    <p>Flat FPS sprite flips and diagonal orientation corrections are applied automatically.</p>
    <p>Rotations add together on each axis: all tilesets + this tileset + this sprite. Changing a broad default affects every sprite that uses it. Attachment offsets always belong to the selected sprite.</p>
    <p>Save writes poses to <code>weapon-pose-defaults.ts</code> and shared sprite flips to <code>held-weapon-flip-defaults.ts</code>. The next build includes these defaults.</p>
  </aside></main><footer id="status" role="status">Loading…</footer>`;

const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const tileset = element<HTMLSelectElement>('tileset'), tileInput = element<HTMLInputElement>('tile');
const sheet = element<HTMLCanvasElement>('sheet'), sheetContext = sheet.getContext('2d')!;
const catalog = getNh3dTilesetCatalog().filter(entry => entry.source === 'builtin');
for (const entry of catalog) {
  const option = document.createElement('option'); option.value = entry.path;
  option.textContent = `${entry.label} (${entry.tileLayoutVersion})`; tileset.append(option);
}
tileset.value = catalog.find(entry => entry.path === 'assets/5.0/PixelHack.png')?.path ?? catalog[0].path;
let saved = createWeaponPoseLibrary(), atlas: Atlas | null = null, tile = 0, page = 0, loading = 0, saving = false;
const drafts = new Map<string, WeaponPose>();
let savedFlips: FpsHeldWeaponTileFlipOverridesByTileset = {};
const flipDrafts = new Map<string, FpsHeldWeaponTileFlipOverride>();
const flipInputs = {
  flipX: element<HTMLInputElement>('flip-x'), flipY: element<HTMLInputElement>('flip-y'), flipDiagonal: element<HTMLInputElement>('flip-diagonal'),
};
const baseSprite = element<HTMLCanvasElement>('base-sprite'), baseContext = baseSprite.getContext('2d')!;
const tilesetDrafts = new Map<string, WeaponRotation>();
let globalDraft: WeaponRotation | null = null;
const rotationScope = element<HTMLSelectElement>('rotation-scope');
const editCount = (): number => drafts.size + flipDrafts.size + tilesetDrafts.size + (globalDraft ? 1 : 0);
const status = (text: string, error = false): void => {
  element('status').textContent = text; element('status').classList.toggle('error', error);
};
const key = (): string => weaponPoseKey(tileset.value, tile, null);
const pose = (): WeaponPose => drafts.get(key()) ?? saved.sprites[key()] ?? normalizeWeaponPose({});
const currentFlips = (): FpsHeldWeaponTileFlipOverride => flipDrafts.get(key()) ?? resolveHeldWeaponTileFlips(tileset.value, tile, savedFlips);
const selectedRotation = (): WeaponRotation => rotationScope.value === 'global' ? globalDraft ?? saved.globalRotationDeg :
  rotationScope.value === 'tileset' ? tilesetDrafts.get(tileset.value) ?? saved.tilesetRotationDeg[tileset.value] ?? { x: 0, y: 0, z: 0 } : pose().rotationDeg;
function setSelectedRotation(rotationDeg: WeaponRotation): void {
  const normalized = normalizeWeaponPose({ rotationDeg }).rotationDeg;
  if (rotationScope.value === 'global') globalDraft = normalized;
  else if (rotationScope.value === 'tileset') tilesetDrafts.set(tileset.value, normalized);
  else drafts.set(key(), { ...pose(), rotationDeg: normalized });
  syncPose();
}
let preview: WeaponPreview;
try { preview = new WeaponPreview(element('preview')); }
catch (error) { status(`Cannot create the 3D preview: ${String(error)}`, true); throw error; }

const controls = new Map<string, { number: HTMLInputElement; range: HTMLInputElement }>();
for (const [group, label] of [['attachmentOffsetPixels', 'Attachment point (pixels from center)'], ['rotationDeg', 'Rotation from upright (degrees)']] as const) {
  const section = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label; section.append(legend);
  for (const axis of ['x', 'y', 'z'] as const) {
    const row = document.createElement('label'); row.className = 'axis'; row.append(axis.toUpperCase());
    const range = document.createElement('input'), number = document.createElement('input');
    for (const input of [range, number]) {
      input.type = input === range ? 'range' : 'number'; input.min = group === 'attachmentOffsetPixels' ? '-4096' : '-180';
      input.max = group === 'attachmentOffsetPixels' ? '4096' : '180';
      input.step = group === 'rotationDeg' ? '15' : '.5'; input.setAttribute('aria-label', `${label} ${axis}`);
    }
    const commit = (value: number): void => {
      if (!Number.isFinite(value)) return;
      if (group === 'rotationDeg') { setSelectedRotation({ ...selectedRotation(), [axis]: value }); return; }
      const current = pose();
      drafts.set(key(), normalizeWeaponPose({ ...current, [group]: { ...current[group], [axis]: value } }));
      syncPose();
    };
    range.addEventListener('input', () => commit(range.valueAsNumber));
    number.addEventListener('change', () => commit(number.valueAsNumber));
    number.addEventListener('keydown', event => { if (event.key === 'Enter') { commit(number.valueAsNumber); number.blur(); } });
    row.append(range, number); section.append(row); controls.set(`${group}.${axis}`, { range, number });
  }
  element(group === 'attachmentOffsetPixels' ? 'attachment-fields' : 'rotation-fields').append(section);
}
preview.onPickAttachment = attachmentOffsetPixels => {
  drafts.set(key(), { ...pose(), attachmentOffsetPixels }); syncPose();
};
function syncPose(): void {
  const current = pose();
  const flips = currentFlips();
  for (const name of ['flipX', 'flipY', 'flipDiagonal'] as const) flipInputs[name].checked = flips[name];
  const rotation = selectedRotation();
  for (const [name, inputs] of controls) {
    const [group, axis] = name.split('.');
    const value = (group === 'rotationDeg' ? rotation : current.attachmentOffsetPixels)[axis as 'x' | 'y' | 'z'];
    inputs.range.value = inputs.number.value = String(value);
  }
  const effective = resolveWeaponPose({ globalRotationDeg: globalDraft ?? saved.globalRotationDeg,
    tilesetRotationDeg: { [tileset.value]: tilesetDrafts.get(tileset.value) ?? saved.tilesetRotationDeg[tileset.value] ?? { x: 0, y: 0, z: 0 } },
    sprites: { [key()]: current } }, tileset.value, key());
  preview.setPose(effective);
  element('effective-rotation').textContent = `Combined rotation: X ${effective.rotationDeg.x}°, Y ${effective.rotationDeg.y}°, Z ${effective.rotationDeg.z}°`;
  element('selection').textContent = `Tile ${tile} · ${drafts.has(key()) || flipDrafts.has(key()) ? 'unsaved sprite edits' : saved.sprites[key()] ? 'saved sprite pose' : 'default centered attachment'}`;
  element('reset').textContent = rotationScope.value === 'global' ? 'Revert all-tilesets rotation to saved' :
    rotationScope.value === 'tileset' ? 'Revert this tileset rotation to saved' : 'Revert this sprite to saved pose';
  const button = element<HTMLButtonElement>('save'); button.disabled = !editCount() || saving;
  button.textContent = saving ? 'Saving…' : `Save all changes${editCount() ? ` (${editCount()})` : ''}`;
}
function drawSheet(): void {
  if (!atlas) return;
  sheetContext.fillStyle = '#111823'; sheetContext.fillRect(0, 0, 400, 400); sheetContext.imageSmoothingEnabled = false;
  const start = page * 100;
  for (let i = 0; i < 100 && start + i < atlas.count; i++) {
    const id = start + i, x = i % 10 * 40, y = Math.floor(i / 10) * 40;
    sheetContext.drawImage(atlas.image, id % atlas.columns * atlas.width, Math.floor(id / atlas.columns) * atlas.height,
      atlas.width, atlas.height, x + 2, y + 2, 36, 36);
    sheetContext.strokeStyle = id === tile ? '#78d5ff' : '#283347'; sheetContext.lineWidth = id === tile ? 3 : 1;
    sheetContext.strokeRect(x + 1, y + 1, 38, 38);
  }
  element('sheet-range').textContent = `${start}–${Math.min(start + 99, atlas.count - 1)}`;
}
function selectTile(next: number): void {
  if (!atlas || !Number.isFinite(next)) return;
  tile = Math.max(0, Math.min(atlas.count - 1, Math.trunc(next))); tileInput.value = String(tile); page = Math.floor(tile / 100);
  try {
    const texture = atlas.texture(tile, currentFlips());
    try {
      baseContext.imageSmoothingEnabled = false;
      for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
        baseContext.fillStyle = (x / 8 + y / 8) % 2 ? '#243247' : '#152031'; baseContext.fillRect(x, y, 8, 8);
      }
      const scale = Math.min(112 / texture.image.width, 112 / texture.image.height);
      const width = texture.image.width * scale, height = texture.image.height * scale;
      baseContext.drawImage(texture.image, (128 - width) / 2, (128 - height) / 2, width, height);
      const size = preview.setSprite(texture);
      for (const [axis, extent] of [['x', size.pixelWidth / 2], ['y', size.pixelHeight / 2], ['z', .5]] as const) {
        const input = controls.get(`attachmentOffsetPixels.${axis}`)!.range;
        input.min = String(-extent); input.max = String(extent);
      }
    } finally { texture.dispose(); }
    drawSheet(); syncPose(); status(`Tile ${tile} loaded. ${editCount()} unsaved edit(s).`);
  } catch (error) { status(`Could not preview tile ${tile}: ${String(error)}`, true); }
}
async function selectAtlas(): Promise<void> {
  const revision = ++loading; atlas = null; status('Loading tileset…');
  document.querySelector<HTMLElement>('.pose-controls')!.inert = true; tileInput.disabled = true;
  try {
    const entry = catalog.find(entry => entry.path === tileset.value)!;
    const loaded = await loadAtlas(entry);
    if (revision !== loading) return;
    atlas = loaded;
    element<HTMLSelectElement>('background').value = atlas.options.tilesetBackgroundRemovalMode;
    element<HTMLInputElement>('background-tile').value = String(atlas.options.tilesetBackgroundTileId);
    element<HTMLInputElement>('background-color').value = atlas.options.tilesetSolidChromaKeyColorHex;
    const first = Number(Object.keys(DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET[entry.path] ?? {})[0] ?? atlas.suggestedTile);
    selectTile(first);
  } catch (error) { status(`Could not load tileset: ${String(error)}`, true); }
  finally { if (revision === loading) { document.querySelector<HTMLElement>('.pose-controls')!.inert = !atlas; tileInput.disabled = !atlas; } }
}
tileset.addEventListener('change', () => { void selectAtlas(); });
for (const name of ['flipX', 'flipY', 'flipDiagonal'] as const) flipInputs[name].onchange = () => {
  if (!atlas) return;
  flipDrafts.set(key(), { ...currentFlips(), [name]: flipInputs[name].checked }); selectTile(tile);
};
element('builtin-flips').onclick = () => { flipDrafts.set(key(), resolveHeldWeaponTileFlips(tileset.value, tile, {})); selectTile(tile); };
element('revert-flips').onclick = () => { flipDrafts.delete(key()); selectTile(tile); };
tileInput.addEventListener('change', () => selectTile(tileInput.valueAsNumber));
element('previous').onclick = () => selectTile(tile - 1); element('next').onclick = () => selectTile(tile + 1);
element('page-back').onclick = () => { page = Math.max(0, page - 1); drawSheet(); };
element('page-next').onclick = () => { if (atlas) page = Math.min(Math.floor((atlas.count - 1) / 100), page + 1); drawSheet(); };
sheet.onclick = event => {
  const rect = sheet.getBoundingClientRect();
  selectTile(page * 100 + Math.floor((event.clientX - rect.left) / rect.width * 10) + Math.floor((event.clientY - rect.top) / rect.height * 10) * 10);
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.onclick = () => preview.view(button.dataset.view!);
element('center').onclick = () => {
  drafts.set(key(), { ...pose(), attachmentOffsetPixels: { x: 0, y: 0, z: 0 } }); syncPose();
};
element('zero-rotation').onclick = () => setSelectedRotation({ x: 0, y: 0, z: 0 });
rotationScope.onchange = () => syncPose();
element('reset').onclick = () => {
  if (rotationScope.value === 'global') globalDraft = null;
  else if (rotationScope.value === 'tileset') tilesetDrafts.delete(tileset.value);
  else drafts.delete(key());
  syncPose();
};
for (const id of ['background', 'background-tile', 'background-color']) element(id).addEventListener('change', () => {
  if (!atlas) return;
  atlas.options.tilesetBackgroundRemovalMode = element<HTMLSelectElement>('background').value as 'none' | 'tile' | 'solid';
  atlas.options.tilesetBackgroundTileId = Math.max(0, element<HTMLInputElement>('background-tile').valueAsNumber || 0);
  atlas.options.tilesetSolidChromaKeyColorHex = element<HTMLInputElement>('background-color').value;
  selectTile(tile);
});
async function save(): Promise<void> {
  if (saving) return;
  saving = true; syncPose();
  try {
    const send = async (edit: unknown): Promise<void> => {
      const response = await fetch('/api/weapon-poses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
    };
    for (const [spriteKey, value] of [...flipDrafts]) {
      await send({ scope: 'flips', key: spriteKey, flips: value });
      const [tilesetKey, tileKey] = spriteKey.split('|');
      savedFlips[tilesetKey] = { ...savedFlips[tilesetKey], [tileKey]: value };
      if (flipDrafts.get(spriteKey) === value) flipDrafts.delete(spriteKey);
    }
    if (globalDraft) {
      const value = globalDraft;
      await send({ scope: 'global', rotationDeg: value });
      saved.globalRotationDeg = value;
      if (globalDraft === value) globalDraft = null;
    }
    for (const [tilesetKey, value] of [...tilesetDrafts]) {
      await send({ scope: 'tileset', key: tilesetKey, rotationDeg: value });
      saved.tilesetRotationDeg[tilesetKey] = value;
      if (tilesetDrafts.get(tilesetKey) === value) tilesetDrafts.delete(tilesetKey);
    }
    for (const [spriteKey, value] of [...drafts]) {
      await send({ scope: 'sprite', key: spriteKey, pose: value });
      saved.sprites[spriteKey] = value;
      if (drafts.get(spriteKey) === value) drafts.delete(spriteKey);
    }
    status('Saved. Poses and shared flat FPS sprite flips will be included in the next build.');
  } catch (error) { status(`Save failed: ${String(error)}. Your edits are still available.`, true); }
  finally { saving = false; syncPose(); }
}
element('save').onclick = () => { void save(); };
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void save(); return; }
  if (!atlas || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.closest('input, textarea, select') || target.isContentEditable)) return;
  event.preventDefault();
  const next = Math.max(0, Math.min(atlas.count - 1, tile + (event.key === 'ArrowLeft' ? -1 : 1)));
  if (next !== tile) selectTile(next);
});
window.addEventListener('beforeunload', event => { if (editCount()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => preview.dispose());
try {
  const [response, flipsResponse] = await Promise.all([fetch('/api/weapon-poses'), fetch('/api/weapon-flips')]);
  if (!response.ok || !flipsResponse.ok || !flipsResponse.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not read saved defaults. Restart the calibration utility.');
  }
  saved = await response.json(); savedFlips = await flipsResponse.json(); await selectAtlas();
} catch (error) { status(String(error), true); }
