import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createPortReservation } from 'node:net';
import { startCalibrator, parsePoseSource, serializePoses, validatePose, parseFlipSource, serializeFlips } from './server.mjs';

const pose = { attachmentOffsetPixels: { x: 2, y: -3.5, z: .5 }, rotationDeg: { x: 29, y: 0, z: -17 } };
test('saves concurrent sprite edits to source while preserving existing poses', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'weapon-calibrator-'));
  const file = path.join(dir, 'weapon-pose-defaults.ts');
  const flipFile = path.join(dir, 'held-weapon-flip-defaults.ts');
  const originalFlips = { 'assets/other.png': { '10': { flipX: true, flipY: false, flipDiagonal: false } } };
  await writeFile(flipFile, serializeFlips(originalFlips));
  const original = { globalRotationDeg: { x: 0, y: 0, z: 0 }, tilesetRotationDeg: {},
    sprites: { 'assets/test.png|1|-1': validatePose(pose) } };
  await writeFile(file, serializePoses(original));
  const reservation = createPortReservation();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = await startCalibrator({ port, open: false, file, flipFile });
  try {
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const save = (key, value = pose, requestOrigin = origin) => fetch(origin + '/api/weapon-poses', {
      method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'sprite', key, pose: value }),
    });
    const results = await Promise.all([save('assets/test.png|2|-1'), save('assets/test.png|3|-1')]);
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    const table = parsePoseSource(await readFile(file, 'utf8'));
    assert.equal(Object.keys(table.sprites).length, 3);
    assert.deepEqual(table.sprites['assets/test.png|1|-1'], original.sprites['assets/test.png|1|-1']);
    assert.equal(table.sprites['assets/test.png|2|-1'].rotationDeg.x, 30);
    assert.deepEqual(table.sprites['assets/test.png|2|-1'].attachmentOffsetPixels, pose.attachmentOffsetPixels);
    assert.equal(table.sprites['assets/test.png|3|-1'].rotationDeg.z, -15);
    assert.equal((await save('assets/test.png|4|-1', pose, 'https://example.com')).status, 403);
    assert.equal((await save('../../other-file.ts', pose)).status, 400);
    assert.equal((await save('assets/test.png|4|-1', { ...pose, attachmentOffsetPixels: { x: 5000, y: 0, z: 0 } })).status, 400);
    assert.deepEqual(await (await fetch(origin + '/api/weapon-poses')).json(), table);
    const defaults = await Promise.all([
      { scope: 'global', rotationDeg: { x: 14, y: 30, z: 0 } },
      { scope: 'tileset', key: 'assets/test.png', rotationDeg: { x: 0, y: -30, z: 89 } },
    ].map(edit => fetch(origin + '/api/weapon-poses', { method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(edit) })));
    assert.deepEqual(defaults.map(result => result.status), [200, 200]);
    const updated = parsePoseSource(await readFile(file, 'utf8'));
    assert.deepEqual(updated.sprites, table.sprites);
    assert.deepEqual(updated.globalRotationDeg, { x: 15, y: 30, z: 0 });
    assert.deepEqual(updated.tilesetRotationDeg['assets/test.png'], { x: 0, y: -30, z: 90 });
    assert.deepEqual(await (await fetch(origin + '/api/weapon-poses')).json(), updated);
    const poseSource = await readFile(file, 'utf8');
    const saveFlips = (key, flips) => fetch(origin + '/api/weapon-poses', { method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'flips', key, flips }) });
    const flipUpdates = await Promise.all([
      saveFlips('assets/test.png|2|-1', { flipX: false, flipY: true, flipDiagonal: true }),
      saveFlips('assets/test.png|3|-1', { flipX: false, flipY: false, flipDiagonal: false }),
    ]);
    assert.deepEqual(flipUpdates.map(result => result.status), [200, 200]);
    const flipTable = parseFlipSource(await readFile(flipFile, 'utf8'));
    assert.deepEqual(flipTable['assets/other.png'], originalFlips['assets/other.png']);
    assert.deepEqual(flipTable['assets/test.png']['2'], { flipX: false, flipY: true, flipDiagonal: true });
    assert.deepEqual(flipTable['assets/test.png']['3'], { flipX: false, flipY: false, flipDiagonal: false });
    assert.deepEqual(await (await fetch(origin + '/api/weapon-flips')).json(), flipTable);
    assert.equal(await readFile(file, 'utf8'), poseSource);
    assert.equal((await saveFlips('assets/test.png|-1|7', { flipX: false, flipY: false, flipDiagonal: false })).status, 400);
    assert.equal((await saveFlips('assets/test.png|4|-1', { flipX: 'false', flipY: false, flipDiagonal: false })).status, 400);
  } finally {
    await server.close();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});
