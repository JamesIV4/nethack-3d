import { createServer } from 'vite';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const posesFile = path.join(root, 'src/quest/webxr/weapon-pose-defaults.ts');
export const flipsFile = path.join(root, 'src/game/engine/rendering/held-weapon-flip-defaults.ts');

export function validateFlips(value) {
  const result = {};
  for (const key of ['flipX', 'flipY', 'flipDiagonal']) {
    if (typeof value?.[key] !== 'boolean') throw new Error(`Invalid ${key}`);
    result[key] = value[key];
  }
  return result;
}
export function parseFlipSource(source) {
  const match = source.match(/export const authoredHeldWeaponTileFlips[^=]*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error('Cannot read held-weapon-flip-defaults.ts');
  const table = JSON.parse(match[1]);
  if (!table || Array.isArray(table) || typeof table !== 'object') throw new Error('Invalid flip table');
  for (const [tileset, entries] of Object.entries(table)) {
    if (!/^assets\/[^|]+$/.test(tileset) || !entries || Array.isArray(entries) || typeof entries !== 'object') throw new Error('Invalid tileset flips');
    for (const [tile, flip] of Object.entries(entries)) {
      if (!/^\d+$/.test(tile)) throw new Error('Invalid flip tile ID');
      validateFlips(flip);
    }
  }
  return table;
}
export function serializeFlips(table) {
  return 'import type { FpsHeldWeaponTileFlipOverridesByTileset } from "../shared/types";\n\n' +
    '/** Per-sprite corrections authored by npm run weapon:calibrate; shared by flat FPS and VR. */\n' +
    `export const authoredHeldWeaponTileFlips: FpsHeldWeaponTileFlipOverridesByTileset = ${JSON.stringify(table, null, 2)};\n`;
}

export function validatePose(value) {
  const result = {};
  for (const [group, axes, min, max] of [['attachmentOffsetPixels', ['x','y','z'], -4096, 4096], ['rotationDeg', ['x','y','z'], -180, 180]]) {
    result[group] = {};
    for (const axis of axes) {
      const n = value?.[group]?.[axis];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid ${group}.${axis}`);
      result[group][axis] = group === 'rotationDeg' ? Math.round(n / 15) * 15 : n;
    }
  }
  return result;
}
export const validateRotation = rotationDeg => validatePose({ attachmentOffsetPixels: { x: 0, y: 0, z: 0 }, rotationDeg }).rotationDeg;
export function parsePoseSource(source) {
  const match = source.match(/export const defaultWeaponPoses[^=]*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error('Cannot read weapon-pose-defaults.ts; expected the exported pose table.');
  const table = JSON.parse(match[1]);
  if (!table || Array.isArray(table) || typeof table !== 'object') throw new Error('Invalid pose table');
  validateRotation(table.globalRotationDeg);
  for (const name of ['tilesetRotationDeg', 'sprites']) {
    if (!table[name] || typeof table[name] !== 'object' || Array.isArray(table[name])) throw new Error(`Invalid ${name}`);
  }
  for (const rotation of Object.values(table.tilesetRotationDeg)) validateRotation(rotation);
  for (const pose of Object.values(table.sprites)) validatePose(pose);
  return table;
}
export function serializePoses(table) {
  return 'import type { WeaponPoseLibrary } from "./weapon-pose";\n\n' +
    '/** Global, tileset and sprite settings saved by npm run weapon:calibrate. Baked into Quest. */\n' +
    `export const defaultWeaponPoses: WeaponPoseLibrary = ${JSON.stringify(table, null, 2)};\n`;
}

export async function startCalibrator({ port = 5174, open = true, file = posesFile, flipFile = flipsFile } = {}) {
  let writes = Promise.resolve();
  const server = await createServer({ configFile: false, root, publicDir: path.join(root, 'public'),
    server: { host: '127.0.0.1', port, strictPort: true, open: open ? '/tools/weapon-calibrator/' : false,
      watch: { ignored: [file, `${file}.tmp`, flipFile, `${flipFile}.tmp`].map(name => name.replaceAll('\\', '/')) } },
    plugins: [{ name: 'weapon-calibrator-save', configureServer(vite) {
      vite.middlewares.use('/api/weapon-flips', async (req, res) => {
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Use the save endpoint.' })); return; }
        try { await writes; res.end(JSON.stringify(parseFlipSource(await readFile(flipFile, 'utf8')))); }
        catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
      });
      vite.middlewares.use('/api/weapon-poses', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          if (req.method === 'GET') {
            await writes;
            res.end(JSON.stringify(parsePoseSource(await readFile(file, 'utf8')))); return;
          }
          const origin = req.headers.origin;
          const address = vite.httpServer?.address();
          const actualPort = address && typeof address !== 'string' ? address.port : port;
          if (req.method !== 'POST' || origin !== `http://127.0.0.1:${actualPort}` ||
              !req.headers['content-type']?.startsWith('application/json')) {
            res.statusCode = 403; res.end(JSON.stringify({ error: 'Use the local calibration utility to save.' })); return;
          }
          let body = '';
          for await (const chunk of req) { body += chunk; if (body.length > 16384) throw new Error('Save request too large'); }
          const { scope, key, pose, rotationDeg, flips } = JSON.parse(body);
          if (!['sprite', 'tileset', 'global', 'flips'].includes(scope)) throw new Error('Invalid edit scope');
          if (scope !== 'global' && (typeof key !== 'string' || key.length > 1024 ||
            !(scope === 'sprite' || scope === 'flips' ? /^assets\/[^|]+\|-?\d+\|-?\d+$/ : /^assets\/[^|]+$/).test(key))) throw new Error('Invalid sprite or tileset key');
          if (scope === 'flips' && (!Number.isSafeInteger(Number(key.split('|')[1])) || Number(key.split('|')[1]) < 0)) throw new Error('Flip edits require an atlas tile ID');
          const normalized = scope === 'flips' ? validateFlips(flips) : scope === 'sprite' ? validatePose(pose) : validateRotation(rotationDeg);
          const save = writes.then(async () => {
            if (scope === 'flips') {
              const table = parseFlipSource(await readFile(flipFile, 'utf8'));
              const [tileset, tile] = key.split('|');
              table[tileset] = { ...table[tileset], [String(Number(tile))]: normalized };
              await writeFile(`${flipFile}.tmp`, serializeFlips(table), 'utf8');
              await rename(`${flipFile}.tmp`, flipFile);
              return;
            }
            const table = parsePoseSource(await readFile(file, 'utf8'));
            if (scope === 'global') table.globalRotationDeg = normalized;
            else if (scope === 'tileset') table.tilesetRotationDeg[key] = normalized;
            else table.sprites[key] = normalized;
            await writeFile(`${file}.tmp`, serializePoses(table), 'utf8');
            await rename(`${file}.tmp`, file);
          });
          writes = save.catch(() => {});
          await save;
          res.end(JSON.stringify({ scope, saved: key ?? 'global', value: normalized }));
        } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
      });
    } }],
  });
  await server.listen();
  const address = server.httpServer.address();
  console.log(`Weapon calibrator: http://127.0.0.1:${address.port}/tools/weapon-calibrator/`);
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIndex = process.argv.indexOf('--port');
  await startCalibrator({ port: portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 5174,
    open: !process.argv.includes('--no-open') });
}
