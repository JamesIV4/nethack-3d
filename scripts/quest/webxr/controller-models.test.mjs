import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stageControllerModels } from "./stage-controller-models.mjs";
import { patchWeaponControls } from "./patch-weapon-controls.mjs";

const assets = fileURLToPath(new URL("../../../quest/webxr/controllers/meta-touch-plus/", import.meta.url));
function cleanup(checkout) {
  const resolved = path.resolve(checkout);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.match(path.basename(resolved), /^nh3d-model-(stage|depth)-/);
  rmSync(resolved, { recursive: true, force: true });
}
for (const hand of ["left", "right"]) test(`Meta ${hand} controller has valid meter-scale geometry and an opaque texture`, () => {
  const stem = `vr_controller_metaquest3_${hand}`;
  const lines = readFileSync(path.join(assets, "native", stem + ".obj"), "utf8").split("\n");
  const vertices = lines.filter(line => line.startsWith("v ")).map(line => line.split(/\s+/).slice(1).map(Number));
  const normals = lines.filter(line => line.startsWith("vn ")).map(line => line.split(/\s+/).slice(1).map(Number));
  const faces = lines.filter(line => line.startsWith("f "));
  assert.equal(faces.length, 5609); assert.equal(vertices.length, 16827);
  assert.equal(normals.length, vertices.length); assert.ok(vertices.length < 65536);
  assert.ok(vertices.flat().every(Number.isFinite));
  assert.ok(normals.every(n => Math.abs(Math.hypot(...n) - 1) < 0.00001));
  for (const face of faces) {
    const indices = face.split(/\s+/).slice(1); assert.equal(indices.length, 3);
    for (const index of indices) assert.ok(index.split("/").every(v => Number(v) >= 1 && Number(v) <= vertices.length));
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = vertices.map(v => v[axis]), extent = Math.max(...values) - Math.min(...values);
    assert.ok(extent > 0.05 && extent < 0.15, `physical size: ${extent}`);
  }
  const png = readFileSync(path.join(assets, "native", stem + ".png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
  assert.equal(png[25], 2, "RGB only: roughness must not become opacity");
  const ktx = readFileSync(path.join(assets, "native", stem + ".ktx"));
  assert.equal(ktx.readUInt32LE(28), 0x1908); // GL_RGBA: native uncompressed upload.
  assert.equal(ktx.readUInt32LE(36), 512); assert.equal(ktx.readUInt32LE(40), 512);
  assert.equal(ktx.readUInt32LE(56), 1); assert.equal(ktx.readUInt32LE(64), 512*512*4);
  assert.equal(ktx.length, 68+512*512*4);
  for(let index=71;index<ktx.length;index+=4) assert.equal(ktx[index],255);
  assert.match(readFileSync(path.join(assets, "native", stem + ".mtl"), "utf8"), new RegExp(`map_Kd ${stem}\\.ktx`));
});

test("stages both model pairs and notices reproducibly in the Oculus host", () => {
  const checkout = mkdtempSync(path.join(tmpdir(), "nh3d-model-stage-"));
  try {
    stageControllerModels(checkout); stageControllerModels(checkout);
    for (const hand of ["left", "right"]) for (const extension of ["obj", "mtl", "ktx"]) {
      const name = `vr_controller_metaquest3_${hand}.${extension}`;
      assert.deepEqual(readFileSync(path.join(checkout, "app/src/oculusvr/assets", name)), readFileSync(path.join(assets, "native", name)));
    }
    assert.match(readFileSync(path.join(checkout, "app/src/oculusvr/assets/licenses/meta-touch-plus-LICENSE.txt"), "utf8"), /Meta Platforms/);
  } finally { cleanup(checkout); }
});

test("controller foreground rendering restores depth state and patches idempotently", () => {
  const checkout = mkdtempSync(path.join(tmpdir(), "nh3d-model-depth-"));
  const cpp = path.join(checkout, "app/src/main/cpp"); mkdirSync(cpp, { recursive: true });
  try {
    writeFileSync(path.join(cpp, "ExternalVR.cpp"), "");
    writeFileSync(path.join(cpp, "BrowserWorld.cpp"), "  m.DrawGamePointers(*camera);\n");
    patchWeaponControls(checkout);
    const first = readFileSync(path.join(cpp, "BrowserWorld.cpp"), "utf8");
    patchWeaponControls(checkout);
    assert.equal(readFileSync(path.join(cpp, "BrowserWorld.cpp"), "utf8"), first);
    assert.ok(first.indexOf("glDepthMask(GL_TRUE)") < first.indexOf("glClear(GL_DEPTH_BUFFER_BIT)"));
    assert.ok(first.indexOf("glEnable(GL_DEPTH_TEST)") < first.indexOf("m.rootController->Cull"));
    assert.ok(first.indexOf("glDepthFunc(GL_LEQUAL)") < first.indexOf("m.rootController->Cull"));
    assert.ok(first.indexOf("glClearDepthf(1.0f)") < first.indexOf("glClear(GL_DEPTH_BUFFER_BIT)"));
  } finally { cleanup(checkout); }
});
