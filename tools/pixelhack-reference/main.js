const $ = (id) => document.getElementById(id);
const [catalog, research, artAnalysis] = await Promise.all([
  fetch('/tools/pixelhack-reference/catalog.json').then(checkResponse).then((response) => response.json()),
  fetch('/tools/pixelhack-reference/research.json').then(checkResponse).then((response) => response.json()),
  fetch('/tools/pixelhack-reference/art-analysis.json').then(checkResponse).then((response) => response.json()),
]);
const atlas = new Image();
atlas.src = catalog.atlas;
await atlas.decode();
if (atlas.width !== catalog.columns * catalog.tileSize || atlas.height !== catalog.rows * catalog.tileSize) {
  throw new Error('The PixelHack atlas and reference catalog have different dimensions.');
}

const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlas.width;
atlasCanvas.height = atlas.height;
const atlasContext = atlasCanvas.getContext('2d', { willReadFrequently: true });
atlasContext.drawImage(atlas, 0, 0);
const background = readTile(2304);
const variantPairs = new Map();
for (const pair of artAnalysis.variantPairs) {
  variantPairs.set(pair.maleTileId, pair);
  variantPairs.set(pair.femaleTileId, pair);
}
const pageSize = 100;
let matches = catalog.tiles;
let page = 0;
let selectedId = Number(new URLSearchParams(location.hash.slice(1)).get('tile')) || 0;
let renderUrl = null;

function checkResponse(response) {
  if (!response.ok) throw new Error(`Could not load ${response.url}: ${response.status}`);
  return response;
}

function readTile(id) {
  const x = (id % catalog.columns) * catalog.tileSize;
  const y = Math.floor(id / catalog.columns) * catalog.tileSize;
  return atlasContext.getImageData(x, y, catalog.tileSize, catalog.tileSize);
}

function drawTile(canvas, id, isolated = false) {
  const tile = readTile(id);
  if (isolated) {
    for (let offset = 0; offset < tile.data.length; offset += 4) {
      if (tile.data[offset] === background.data[offset] &&
          tile.data[offset + 1] === background.data[offset + 1] &&
          tile.data[offset + 2] === background.data[offset + 2] ||
          tile.data[offset] === 131 && tile.data[offset + 1] === 171 && tile.data[offset + 2] === 162) {
        tile.data[offset + 3] = 0;
      }
    }
  }
  const source = document.createElement('canvas');
  source.width = source.height = catalog.tileSize;
  source.getContext('2d').putImageData(tile, 0, 0);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
}

function notesFor(tile) {
  return { subject: tile.researchKey ? research.subjects[tile.researchKey] : null,
    tile: research.tiles[String(tile.id)] };
}

function filterTiles() {
  const query = $('search').value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const category = $('category').value;
  const state = $('research-filter').value;
  matches = catalog.tiles.filter((tile) => {
    const hasBrief = Boolean(notesFor(tile).subject?.modelBrief);
    const searchText = `${tile.id} ${tile.label} ${tile.objectClass ?? ''}`.toLowerCase();
    return (!category || tile.category === category) &&
      (!state || (state === 'ready' ? hasBrief : !hasBrief)) &&
      terms.every((term) => searchText.includes(term));
  });
  page = Math.max(0, Math.floor(Math.max(0, matches.findIndex((tile) => tile.id === selectedId)) / pageSize));
  drawResults();
}

function drawResults() {
  $('count').textContent = `${matches.length} of ${catalog.tiles.length} cells`;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(page, pageCount - 1);
  $('page').textContent = `Page ${page + 1} of ${pageCount}`;
  $('previous-page').disabled = page === 0;
  $('next-page').disabled = page >= pageCount - 1;
  const fragment = document.createDocumentFragment();
  for (const tile of matches.slice(page * pageSize, (page + 1) * pageSize)) {
    const button = document.createElement('button');
    button.className = `tile-card${tile.id === selectedId ? ' selected' : ''}`;
    button.type = 'button';
    button.setAttribute('aria-label', `Tile ${tile.id}: ${tile.label}`);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    drawTile(canvas, tile.id);
    button.append(canvas);
    const text = document.createElement('span');
    text.textContent = `${tile.id} ${tile.label}`;
    button.append(text);
    button.addEventListener('click', () => selectTile(tile.id));
    fragment.append(button);
  }
  $('grid').replaceChildren(fragment);
}

function addSourceLinks(sources) {
  const container = $('source-links');
  container.replaceChildren();
  for (const source of sources ?? []) {
    if (source.url === $('wiki-link').href) continue;
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.label;
    container.append(link);
  }
}

function clearRender() {
  if (renderUrl) URL.revokeObjectURL(renderUrl);
  renderUrl = null;
  $('model-image').removeAttribute('src');
  $('model-image').style.display = 'none';
  $('model-placeholder').style.display = '';
  $('render-file').value = '';
}

function selectTile(id) {
  if (!Number.isInteger(id) || id < 0 || id >= catalog.tiles.length) return;
  if (id !== selectedId) clearRender();
  selectedId = id;
  location.hash = `tile=${id}`;
  const tile = catalog.tiles[id];
  const notes = notesFor(tile);
  $('tile-title').textContent = `${id}: ${tile.label}`;
  $('tile-meta').textContent = `${tile.category}${tile.objectClass ? ` / ${tile.objectClass}` : ''} · atlas row ${Math.floor(id / catalog.columns)}, column ${id % catalog.columns} · source ${tile.sourceFile}${tile.sourceIndex === null ? '' : ` #${tile.sourceIndex}`}${tile.baseTileId === undefined ? '' : ` · base monster tile ${tile.baseTileId}`}${tile.sourceAssociation ? ` · source association: ${tile.sourceAssociation}` : ''}${tile.appearanceMayShuffle ? ' · randomized appearance' : ''}`;
  drawTile($('raw-tile'), id);
  drawTile($('isolated-light'), id, true);
  drawTile($('isolated-dark'), id, true);
  $('brief-status').textContent = notes.subject?.modelBrief ? 'researched' : 'needs research';
  $('visual-note').textContent = notes.subject?.visualDescription ? `Visible tile: ${notes.subject.visualDescription}` : 'Visible tile: inspect the enlarged source pixels and record silhouette, pose, palette, and distinctive details.';
  $('wiki-note').textContent = notes.subject?.wikiDescription ? `Wiki context: ${notes.subject.wikiDescription}` : 'Wiki context: research the subject and record only source-supported anatomy, materials, or gameplay identity.';
  $('model-brief').textContent = notes.subject?.modelBrief ? `Model brief: ${notes.subject.modelBrief}` : 'Model brief: pending. Confirm the appearance and identity before modeling.';
  const pair = variantPairs.get(id);
  const pixelRelation = pair ? `Pixel comparison: this ${tile.category} tile is ${pair.identicalPixels ? 'identical to' : 'visibly different from'} its paired ${tile.variant === 'male' ? 'female-labeled' : 'male-labeled'} tile ${tile.variant === 'male' ? pair.femaleTileId : pair.maleTileId}.` : '';
  $('variant-note').textContent = [pixelRelation, notes.tile?.variantNote || (tile.category === 'statue' ? 'Use the linked monster as the form reference; sculpt the material and pose as a statue.' : '')].filter(Boolean).join(' ');
  const title = notes.subject?.wikiTitle;
  const wikiQuery = tile.objectClass ? `${tile.appearance} ${tile.objectClass}` : tile.subject;
  $('wiki-link').href = title ? `https://nethackwiki.com/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}` :
    `https://nethackwiki.com/wiki/Special:Search?search=${encodeURIComponent(wikiQuery)}`;
  $('wiki-link').textContent = title ? `NetHack Wiki: ${title}` : 'Search NetHack Wiki';
  addSourceLinks(notes.subject?.sources);
  $('previous-tile').disabled = id === 0;
  $('next-tile').disabled = id === catalog.tiles.length - 1;
  if (matches.some((entry) => entry.id === id)) page = Math.floor(matches.findIndex((entry) => entry.id === id) / pageSize);
  drawResults();
}

function showRender(file) {
  if (!file?.type.startsWith('image/')) return;
  clearRender();
  renderUrl = URL.createObjectURL(file);
  $('model-image').src = renderUrl;
  $('model-image').style.display = 'block';
  $('model-placeholder').style.display = 'none';
}

for (const category of [...new Set(catalog.tiles.map((tile) => tile.category))]) {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  $('category').append(option);
}
for (const id of ['search', 'category', 'research-filter']) $(id).addEventListener('input', filterTiles);
$('previous-page').addEventListener('click', () => { page -= 1; drawResults(); });
$('next-page').addEventListener('click', () => { page += 1; drawResults(); });
$('previous-tile').addEventListener('click', () => selectTile(selectedId - 1));
$('next-tile').addEventListener('click', () => selectTile(selectedId + 1));
$('render-file').addEventListener('change', (event) => showRender(event.target.files?.[0]));
const drop = $('model-drop');
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); showRender(event.dataTransfer.files?.[0]); });
$('copy-brief').addEventListener('click', async () => {
  const tile = catalog.tiles[selectedId];
  const notes = notesFor(tile);
  const brief = [`PixelHack tile ${tile.id}: ${tile.label}`, `Atlas: public${catalog.atlas}; 32x32 crop at x=${tile.id % 40 * 32}, y=${Math.floor(tile.id / 40) * 32}.`,
    `Source: NetHack 5.0 ${tile.sourceFile}${tile.sourceIndex === null ? '' : ` tile ${tile.sourceIndex}`}.`,
    ...(tile.objectClass ? [`Object appearance: ${tile.appearance} (${tile.objectClass}).${tile.sourceAssociation ? ` Source association: ${tile.sourceAssociation}.` : ''}${tile.appearanceMayShuffle ? ' Its gameplay identity may shuffle; model the visible appearance.' : ''}`] : []),
    `Visible details: ${notes.subject?.visualDescription ?? 'Inspect the tile and record details before modeling.'}`,
    `Wiki context: ${notes.subject?.wikiDescription ?? 'Research the subject before modeling.'}`,
    `Model brief: ${notes.subject?.modelBrief ?? 'Write a source-grounded brief before modeling.'}`,
    `Variant: ${$('variant-note').textContent || tile.variant || 'none'}`,
    `Wiki: ${$('wiki-link').href}`, 'Render front, side, and three-quarter views. Compare silhouette, pose, palette, and key details with the unaltered PixelHack tile.'];
  await navigator.clipboard.writeText(brief.join('\n'));
  $('copy-brief').textContent = 'Copied';
  setTimeout(() => { $('copy-brief').textContent = 'Copy tile brief'; }, 1500);
});
window.addEventListener('hashchange', () => {
  const id = Number(new URLSearchParams(location.hash.slice(1)).get('tile'));
  if (Number.isInteger(id) && id !== selectedId) selectTile(id);
});
selectTile(selectedId);
