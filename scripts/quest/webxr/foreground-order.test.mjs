import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { patchForeground } from './patch-foreground.mjs';

for (const prepared of [false, true]) test(`foreground covers pointers in ${prepared ? 'prepared' : 'fresh'} checkouts`, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nh3d-pointer-order-'));
  try {
    const dir = path.join(root, 'app/src/main/cpp'); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'ExternalBlitter.h'), '// aForegroundOnly');
    writeFileSync(path.join(dir, 'ExternalBlitter.cpp'), '// NH3D frame-local foreground');
    const file = path.join(dir, 'BrowserWorld.cpp');
    writeFileSync(file, `void\nBrowserWorld::DrawImmersive(device::Eye aEye) {\n  drawNativeUi();\n${prepared ? '  // NH3D redraw tracked foreground after every native HTML/keyboard surface.\n  m.blitter->Draw(aEye, true);\n' : ''}  m.DrawGamePointers(*camera);\n}\nvoid\nBrowserWorld::TickWebXRInterstitial() {}\n`);
    if (prepared) writeFileSync(file, readFileSync(file,'utf8').replace('  m.DrawGamePointers(*camera);', '  drawNativeControllers();\n  m.DrawGamePointers(*camera);'));
    patchForeground(root);
    const result = readFileSync(file, 'utf8');
    assert.ok(result.indexOf('drawNativeUi();') < result.indexOf('m.DrawGamePointers(*camera);'));
    assert.ok(result.indexOf('m.DrawGamePointers(*camera);') < result.indexOf('m.blitter->Draw(aEye, true);'));
    assert.equal(result.match(/m\.blitter->Draw\(aEye, true\)/g)?.length, 1);
    patchForeground(root); assert.equal(readFileSync(file, 'utf8'), result);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.match(path.basename(root), /^nh3d-pointer-order-/);
    rmSync(root, { recursive: true, force: true });
  }
});
