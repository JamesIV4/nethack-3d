import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.resolve(root, process.argv[2] ?? 'tools/pixelhack-reference/models/0000-giant-ant');
const metadata = JSON.parse(readFileSync(path.join(directory, 'model.json'), 'utf8'));
const bytes = readFileSync(path.join(directory, 'model.glb'));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.equal(document.meshes.length, 1, 'One combined export mesh');
assert.equal(document.meshes[0].primitives.length, 1, 'One material draw per ant');
assert.equal(document.skins.length, 1, 'One skeleton');
assert.equal(document.images?.length ?? 0, 0, 'Palette requires no external textures');
for (const name of ['Idle', 'Walk', 'Attack']) {
  assert.ok(document.animations.some((clip) => clip.name === name), `Required clip: ${name}`);
  assert.equal(typeof metadata.animationContract[name]?.loop, 'boolean', `${name} specifies its playback mode`);
}
assert.equal(metadata.animationContract.Attack.loop, false, 'Attack plays once');
assert.equal(metadata.animationContract.Idle.loop, true);
assert.equal(metadata.animationContract.Walk.loop, true);
const primitive = document.meshes[0].primitives[0];
for (const name of ['POSITION', 'NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) assert.ok(name in primitive.attributes, name);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const model = gltf.scene;
let mesh;
model.traverse((obj) => { if (obj.isSkinnedMesh) mesh = obj; });
assert.ok(mesh, 'Three.js imports a skinned mesh');
const weights = mesh.geometry.attributes.skinWeight;
for (let i = 0; i < weights.count; i += 1) {
  const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
  assert.ok(Math.abs(sum - 1) < 1e-4, `Vertex ${i} has normalized rig weights`);
}
function points() {
  model.updateMatrixWorld(true);
  mesh.skeleton.update();
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => {
    const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    assert.ok(p.toArray().every(Number.isFinite));
    return p;
  });
}
const rest = points();
const boneName = (bone) => bone.userData.name ?? bone.name;
const connectedJoints = mesh.skeleton.bones.filter((bone) => /^Leg\.[LR][1-3]\.(lower|foot)$/.test(boneName(bone)))
  .map((bone) => ({ bone, restPosition: bone.position.clone() }));
if (metadata.id === 'giant-ant') assert.equal(connectedJoints.length, 12, 'All ant knee/ankle connections are checked');
const restMinY = Math.min(...rest.map((p) => p.y));
assert.ok(Math.abs(restMinY) < .0001, 'Rest pose stands on the ground');
const report = { meshCount: 1, materialCount: 1, triangles: mesh.geometry.index.count / 3,
  bones: mesh.skeleton.bones.length, allVerticesWeighted: true, clips: {} };
const poses = new Map();
for (const clip of gltf.animations) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(0);
  const first = points();
  let minY = Infinity, maxDisplacement = 0;
  const samples = [];
  for (let step = 0; step <= 60; step += 1) {
    mixer.setTime(clip.duration * step / 60);
    const sample = points();
    for (const { bone, restPosition } of connectedJoints) {
      assert.ok(bone.position.distanceTo(restPosition) < .0001,
        `${clip.name}: ${bone.name} remains attached to its parent segment`);
    }
    minY = Math.min(minY, ...sample.map((p) => p.y));
    maxDisplacement = Math.max(maxDisplacement, ...sample.map((p, i) => p.distanceTo(first[i])));
    samples.push(sample);
  }
  const seam = Math.max(...samples.at(-1).map((p, i) => p.distanceTo(first[i])));
  const contract = metadata.animationContract[clip.name];
  if (contract?.loop) assert.ok(seam < .0001, `${clip.name} has a continuous loop seam (${seam})`);
  assert.ok(maxDisplacement > .002, `${clip.name} visibly moves vertices`);
  assert.ok(minY > -.008, `${clip.name} avoids penetrating the floor (${minY})`);
  assert.ok(maxDisplacement < (contract?.maxDisplacement ?? .2), `${clip.name} stays within its allowed animation displacement`);
  report.clips[clip.name] = { duration: clip.duration, sampledFrames: samples.length,
    loop: contract?.loop ?? false, minimumY: minY, maximumDisplacement: maxDisplacement,
    ...(contract?.loop ? { loopSeamError: seam } : { endpointDifference: seam }) };
  poses.set(clip.name, { first, last: samples.at(-1) });
  mixer.stopAllAction();
  mesh.skeleton.pose();
}
const idle = poses.get('Idle').first;
const attack = poses.get('Attack');
for (const endpoint of ['first', 'last']) {
  const error = Math.max(...attack[endpoint].map((p, i) => p.distanceTo(idle[i])));
  assert.ok(error < .0001, `Attack ${endpoint} pose returns to the idle stance (${error})`);
}
const hitTime = metadata.animationContract.Attack.hitTime;
assert.ok(Number.isFinite(hitTime) && hitTime > 0 && hitTime < report.clips.Attack.duration, 'Attack records an in-range impact time');
report.clips.Attack.hitTime = hitTime;
report.clips.Attack.matchesIdleEndpoints = true;
report.connectedJointsChecked = connectedJoints.length;
if (metadata.id === 'giant-ant') {
  const body = mesh.skeleton.bones.find((bone) => boneName(bone) === 'Body');
  const jaws = ['Jaw.L', 'Jaw.R'].map((name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name));
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === 'Attack')).play();
  mixer.setTime(0);
  model.updateMatrixWorld(true);
  const origin = body.getWorldPosition(new THREE.Vector3());
  mixer.setTime(1 / 30);
  model.updateMatrixWorld(true);
  const earlyMotion = body.getWorldPosition(new THREE.Vector3()).distanceTo(origin);
  const openJaws = jaws.map((bone) => bone.quaternion.clone());
  mixer.setTime(hitTime);
  model.updateMatrixWorld(true);
  const impactMotion = body.getWorldPosition(new THREE.Vector3()).sub(origin);
  const jawSnap = jaws.map((bone, i) => bone.quaternion.angleTo(openJaws[i]));
  assert.ok(earlyMotion > .05, 'Attack clearly starts in its first frame');
  assert.ok(impactMotion.y > .08 && impactMotion.z > .13, 'Attack lunges upward and forward toward a taller target');
  assert.ok(jawSnap.every((angle) => angle > .5), 'Both jaws snap visibly from open to closed');
  Object.assign(report.clips.Attack, { firstFrameBodyMotion: earlyMotion,
    bodyMotionAtImpact: impactMotion.toArray(), jawSnapRadians: jawSnap });
  mixer.stopAllAction();
}
writeFileSync(path.join(directory, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
