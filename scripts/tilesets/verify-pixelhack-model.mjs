import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBlinkController } from '../../tools/pixelhack-reference/blink-controller.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.resolve(root, process.argv[2] ?? 'tools/pixelhack-reference/models/0000-giant-ant');
const metadata = JSON.parse(readFileSync(path.join(directory, 'model.json'), 'utf8'));
const bytes = readFileSync(path.join(directory, 'model.glb'));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.equal(document.meshes.length, 1, 'One combined export mesh');
assert.equal(document.meshes[0].primitives.length, 1, 'One material draw per creature');
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
let blinkReport;
if (metadata.humanoid) {
  const blinkIndex = mesh.morphTargetDictionary?.Blink;
  assert.ok(Number.isInteger(blinkIndex), 'Humanoid exports the shared Blink morph');
  assert.equal(mesh.morphTargetInfluences[blinkIndex], 0, 'Humanoid loads with its eyes open');
  for (const clip of gltf.animations) assert.ok(clip.tracks.every((track) => !track.name.includes('morphTargetInfluences')),
    `${clip.name} does not own or reset procedural facial motion`);
  mesh.morphTargetInfluences[blinkIndex] = 1;
  const closed = points();
  const changed = closed.filter((point, i) => point.distanceTo(rest[i]) > .00001).length;
  assert.ok(changed >= 40 && changed < rest.length * .15, 'Blink moves the eyelids without deforming the body');
  mesh.morphTargetInfluences[blinkIndex] = 0;
  const blink = createBlinkController(model, { random: () => 0 });
  const bodyMixer = new THREE.AnimationMixer(model);
  for (const name of ['Idle', 'Walk', 'Attack']) {
    bodyMixer.stopAllAction();
    bodyMixer.clipAction(gltf.animations.find((clip) => clip.name === name)).play();
    bodyMixer.update(.03);
    // Repeated clip transitions must not reset the facial scheduler.
    for (let frame = 0; frame < 45; frame += 1) blink.update(1 / 60);
  }
  assert.ok(mesh.morphTargetInfluences[blinkIndex] > .5, 'Blink continues across all body-clip transitions');
  bodyMixer.timeScale = 0;
  for (let frame = 0; frame < 20; frame += 1) {
    bodyMixer.update(1 / 60);
    blink.update(1 / 60);
  }
  assert.ok(mesh.morphTargetInfluences[blinkIndex] < .01, 'Blink reopens independently of paused body playback');
  blink.dispose();
  bodyMixer.stopAllAction();
  mesh.skeleton.pose();
  blinkReport = { morphTarget: 'Blink', eyelidVertices: changed, independentOfClips: true };
}
const boneName = (bone) => bone.userData.name ?? bone.name;
const jointPattern = metadata.id === 'killer-bee' ? /^Leg\.[LR][1-3]\.lower$/
  : metadata.id === 'dwarf-male' || metadata.id === 'water-nymph-female'
    ? /^(Leg\.[LR]\.lower|Foot\.[LR])$/
    : /^Leg\.[LR][1-3]\.(lower|foot)$/;
const connectedJoints = mesh.skeleton.bones.filter((bone) => jointPattern.test(boneName(bone)))
  .map((bone) => ({ bone, restPosition: bone.position.clone() }));
if (metadata.id === 'giant-ant' || metadata.id === 'soldier-ant')
  assert.equal(connectedJoints.length, 12, 'All ant knee/ankle connections are checked');
if (metadata.id === 'killer-bee') assert.equal(connectedJoints.length, 6, 'All bee knee connections are checked');
if (metadata.id === 'dwarf-male') assert.equal(connectedJoints.length, 4, 'Both dwarf knees and ankles are checked');
if (metadata.id === 'water-nymph-female')
  assert.equal(connectedJoints.length, 4, 'Both nymph knees and ankles are checked');
const restMinY = Math.min(...rest.map((p) => p.y));
const groundClearance = metadata.groundClearance ?? 0;
assert.ok(Math.abs(restMinY - groundClearance) < .0001,
  `Rest pose has its registered ground clearance (${restMinY} vs ${groundClearance})`);
const report = { meshCount: 1, materialCount: 1, triangles: mesh.geometry.index.count / 3,
  bones: mesh.skeleton.bones.length, allVerticesWeighted: true,
  restMinimumY: restMinY, groundClearance, clips: {}, ...(blinkReport ? { blink: blinkReport } : {}) };
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
  const floorLimit = metadata.id === 'killer-bee' && clip.name === 'Attack'
    ? .015 : Math.max(-.008, groundClearance - .04);
  assert.ok(minY > floorLimit,
    `${clip.name} retains floor clearance (${minY})`);
  assert.ok(maxDisplacement < (contract?.maxDisplacement ?? .2),
    `${clip.name} stays within its allowed animation displacement (${maxDisplacement})`);
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
  const bodyAtImpact = body.getWorldPosition(new THREE.Vector3());
  const impactMotion = bodyAtImpact.clone().sub(origin);
  const jawSnap = jaws.map((bone, i) => bone.quaternion.angleTo(openJaws[i]));
  assert.ok(earlyMotion > .05, 'Attack clearly starts in its first frame');
  assert.ok(impactMotion.y > .08 && impactMotion.z > .13, 'Attack lunges upward and forward toward a taller target');
  assert.ok(jawSnap.every((angle) => angle > .5), 'Both jaws snap visibly from open to closed');
  Object.assign(report.clips.Attack, { firstFrameBodyMotion: earlyMotion,
    bodyMotionAtImpact: impactMotion.toArray(), jawSnapRadians: jawSnap });
  mixer.stopAllAction();
  mesh.skeleton.pose();
  const walkClip = gltf.animations.find((clip) => clip.name === 'Walk');
  const walkContract = metadata.animationContract.Walk;
  assert.ok(Math.abs(walkClip.duration - .5) < .0001 && walkContract.travelSpeedTilesPerSecond === 2
    && walkContract.strideCycles === 2, 'Giant ant Walk crosses one tile in half a second with two strides');
  assert.ok(report.clips.Walk.maximumDisplacement > .18, 'Giant ant legs have a broad walking sweep');
  const frontFoot = mesh.skeleton.bones.find((bone) => boneName(bone) === 'Leg.L1.foot');
  assert.ok(frontFoot, 'Front walking foot is rigged');
  const walkMixer = new THREE.AnimationMixer(model);
  walkMixer.clipAction(walkClip).play();
  walkMixer.setTime(0);
  model.updateMatrixWorld(true);
  const stanceStart = frontFoot.getWorldPosition(new THREE.Vector3());
  walkMixer.setTime(.125);
  model.updateMatrixWorld(true);
  const stanceEnd = frontFoot.getWorldPosition(new THREE.Vector3());
  const stanceFootSpeed = Math.abs(stanceEnd.z - stanceStart.z) / .125;
  assert.ok(stanceFootSpeed > 1.6 && stanceFootSpeed < 2.3,
    `Giant ant stance-foot sweep suits two tiles per second (${stanceFootSpeed})`);
  Object.assign(report.clips.Walk, { travelSpeedTilesPerSecond: 2, strideCycles: 2,
    stanceFootSpeed });
  walkMixer.stopAllAction();
}
if (metadata.id === 'killer-bee') {
  const findBone = (name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name);
  const body = findBone('Body');
  const abdomen = findBone('Abdomen');
  const stinger = findBone('Stinger');
  const wings = ['Wing.L.fore', 'Wing.R.fore', 'Wing.L.hind', 'Wing.R.hind'].map(findBone);
  assert.ok(body && abdomen && stinger && wings.every(Boolean), 'Bee sting and both pairs of wings are rigged');
  const stingerIndex = mesh.skeleton.bones.indexOf(stinger);
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const stingerVertices = Array.from({ length: skinIndex.count }, (_, i) => i)
    .filter((i) => skinIndex.getX(i) === stingerIndex && weights.getX(i) > .99);
  assert.ok(stingerVertices.length >= 20, 'Stinger geometry is bound to its own bone');
  const tipVertex = stingerVertices.reduce((best, i) => rest[i].z < rest[best].z ? i : best);
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === 'Attack')).play();
  mixer.setTime(0);
  model.updateMatrixWorld(true);
  const origin = body.getWorldPosition(new THREE.Vector3());
  mixer.setTime(1 / 30);
  model.updateMatrixWorld(true);
  const earlyMotion = body.getWorldPosition(new THREE.Vector3()).distanceTo(origin);
  mixer.setTime(2 / 30);
  model.updateMatrixWorld(true);
  const beforeSting = stinger.quaternion.clone();
  mixer.setTime(hitTime);
  model.updateMatrixWorld(true);
  mesh.skeleton.update();
  const bodyAtImpact = body.getWorldPosition(new THREE.Vector3());
  const impactMotion = bodyAtImpact.clone().sub(origin);
  const abdomenCurl = abdomen.quaternion.angleTo(new THREE.Quaternion());
  const stingSnap = stinger.quaternion.angleTo(beforeSting);
  const impactTip = mesh.getVertexPosition(tipVertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const tipMotion = impactTip.clone().sub(rest[tipVertex]);
  assert.ok(earlyMotion > .07, 'Bee attack clearly starts in its first frame');
  assert.ok(impactMotion.y > .04 && impactMotion.z > .13,
    'Bee lunges upward and forward toward a taller target');
  assert.ok(abdomenCurl > 1.8, 'Abdomen curls forward to present the stinger');
  assert.ok(stingSnap > .3, 'Stinger thrusts distinctly at impact');
  assert.ok(tipMotion.z > .4 && impactTip.y < bodyAtImpact.y - .12,
    'Stinger tip reaches forward from beneath the bee at impact');
  Object.assign(report.clips.Attack, { firstFrameBodyMotion: earlyMotion,
    bodyMotionAtImpact: impactMotion.toArray(), abdomenCurlRadians: abdomenCurl,
    stingerSnapRadians: stingSnap, stingerTipMotionAtImpact: tipMotion.toArray() });
  report.stingerVerticesChecked = stingerVertices.length;
  report.wingsChecked = wings.length;
  mixer.stopAllAction();
}
if (metadata.id === 'soldier-ant') {
  const findBone = (name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name);
  const body = findBone('Body');
  const head = findBone('Head');
  const abdomen = findBone('Abdomen');
  const stinger = findBone('Stinger');
  const jaws = ['Jaw.L', 'Jaw.R'].map(findBone);
  const antennae = ['Antenna.L.base', 'Antenna.L.tip', 'Antenna.R.base', 'Antenna.R.tip'].map(findBone);
  assert.equal(mesh.skeleton.bones.length, 29, 'Soldier ant retains every planned joint');
  assert.ok(body && head && abdomen && stinger && jaws.every(Boolean) && antennae.every(Boolean),
    'Bite, sting, and both antennae are independently rigged');
  const stingerIndex = mesh.skeleton.bones.indexOf(stinger);
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const bodyIndex = mesh.skeleton.bones.indexOf(body);
  const headIndex = mesh.skeleton.bones.indexOf(head);
  let neckBridgeVertices = 0;
  for (let i = 0; i < skinIndex.count; i += 1) {
    const joints = [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)];
    const values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
    const bodyWeight = values.reduce((sum, value, channel) => sum + (joints[channel] === bodyIndex ? value : 0), 0);
    const headWeight = values.reduce((sum, value, channel) => sum + (joints[channel] === headIndex ? value : 0), 0);
    if (bodyWeight > .1 && headWeight > .1) neckBridgeVertices += 1;
  }
  assert.ok(neckBridgeVertices >= 20, 'Flexible neck is skinned between body and head');
  const stingerVertices = Array.from({ length: skinIndex.count }, (_, i) => i)
    .filter((i) => skinIndex.getX(i) === stingerIndex && weights.getX(i) > .99);
  assert.ok(stingerVertices.length >= 20, 'Visible stinger geometry follows its own bone');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === 'Attack')).play();
  mixer.setTime(0);
  model.updateMatrixWorld(true);
  const origin = body.getWorldPosition(new THREE.Vector3());
  const headOrigin = head.getWorldPosition(new THREE.Vector3());
  mixer.setTime(1 / 30);
  model.updateMatrixWorld(true);
  const earlyMotion = body.getWorldPosition(new THREE.Vector3()).distanceTo(origin);
  const earlyHeadMotion = head.getWorldPosition(new THREE.Vector3()).distanceTo(headOrigin);
  mixer.setTime(2 / 30);
  model.updateMatrixWorld(true);
  const openJaws = jaws.map((bone) => bone.quaternion.clone());
  const stingBeforeImpact = stinger.quaternion.clone();
  const abdomenBeforeImpact = abdomen.quaternion.clone();
  mixer.setTime(hitTime);
  model.updateMatrixWorld(true);
  const impactMotion = body.getWorldPosition(new THREE.Vector3()).sub(origin);
  const headImpactMotion = head.getWorldPosition(new THREE.Vector3()).sub(headOrigin);
  const jawSnap = jaws.map((bone, i) => bone.quaternion.angleTo(openJaws[i]));
  const stingerThrust = stinger.quaternion.angleTo(stingBeforeImpact);
  const abdomenPitch = abdomen.quaternion.angleTo(abdomenBeforeImpact);
  assert.ok(earlyMotion > .04 && earlyHeadMotion > .06,
    'Body and head both move in the first attack frame');
  assert.ok(impactMotion.y > .05 && impactMotion.z > .07
    && headImpactMotion.y > .08 && headImpactMotion.z > .13,
  'Bite reaches upward and forward while the hind legs brace');
  assert.ok(jawSnap.every((angle) => angle > .6), 'Both mandibles snap between opening and impact');
  assert.ok(stingerThrust > .2 && abdomenPitch > .1,
    'Stinger flick and abdominal pitch have distinct impact motion');
  const footIndices = (name) => {
    const index = mesh.skeleton.bones.indexOf(findBone(name));
    assert.ok(index >= 0, `${name} exists`);
    const vertices = Array.from({ length: skinIndex.count }, (_, i) => i)
      .filter((i) => skinIndex.getX(i) === index && weights.getX(i) > .99);
    assert.ok(vertices.length >= 10, `${name} has visible foot geometry`);
    return vertices;
  };
  const rearFeet = ['Leg.L3.foot', 'Leg.R3.foot'].map(footIndices);
  const frontFeet = ['Leg.L1.foot', 'Leg.R1.foot'].map(footIndices);
  const middleFeet = ['Leg.L2.foot', 'Leg.R2.foot'].map(footIndices);
  const minHeights = (sample, feet) => feet.map((indices) => Math.min(...indices.map((i) => sample[i].y)));
  let highestRearFoot = -Infinity;
  let frontFootHeightAtImpact = [];
  let middleFootHeightAtImpact = [];
  for (let step = 0; step <= 60; step += 1) {
    mixer.setTime(report.clips.Attack.duration * step / 60);
    const sample = points();
    const rearHeights = minHeights(sample, rearFeet);
    highestRearFoot = Math.max(highestRearFoot, ...rearHeights);
    assert.ok(rearHeights.every((height) => height >= -.008 && height <= .008),
      `Attack sample ${step}: both rear feet remain on the ground (${rearHeights})`);
    if (step === 12) {
      frontFootHeightAtImpact = minHeights(sample, frontFeet);
      middleFootHeightAtImpact = minHeights(sample, middleFeet);
    }
  }
  assert.ok(frontFootHeightAtImpact.every((height) => height > .04)
    && middleFootHeightAtImpact.every((height) => height > .03),
  'Front and middle feet lift for the bite while the hind pair supports the ant');
  Object.assign(report.clips.Attack, { firstFrameBodyMotion: earlyMotion,
    firstFrameHeadMotion: earlyHeadMotion, bodyMotionAtImpact: impactMotion.toArray(),
    headMotionAtImpact: headImpactMotion.toArray(), jawSnapRadians: jawSnap,
    groundedRearFeet: rearFeet.length, highestRearFoot,
    frontFootHeightAtImpact, middleFootHeightAtImpact,
    stingerThrustRadians: stingerThrust, abdomenPitchRadians: abdomenPitch });
  report.stingerVerticesChecked = stingerVertices.length;
  report.antennaBonesChecked = antennae.length;
  report.neckBridgeVerticesChecked = neckBridgeVertices;
  mixer.stopAllAction();
  mesh.skeleton.pose();
  const walkClip = gltf.animations.find((clip) => clip.name === 'Walk');
  const walkContract = metadata.animationContract.Walk;
  assert.ok(Math.abs(walkClip.duration - .5) < .0001 && walkContract.travelSpeedTilesPerSecond === 2
    && walkContract.strideCycles === 2, 'Walk is timed for one tile in half a second with two strides');
  const walkMixer = new THREE.AnimationMixer(model);
  walkMixer.clipAction(walkClip).play();
  const frontFoot = findBone('Leg.L1.foot');
  walkMixer.setTime(0);
  model.updateMatrixWorld(true);
  const stanceStart = frontFoot.getWorldPosition(new THREE.Vector3());
  walkMixer.setTime(.125);
  model.updateMatrixWorld(true);
  const stanceEnd = frontFoot.getWorldPosition(new THREE.Vector3());
  const stanceFootSpeed = Math.abs(stanceEnd.z - stanceStart.z) / .125;
  walkMixer.setTime(.1875);
  const swingVertices = points();
  const swingFootHeight = Math.min(...footIndices('Leg.L1.foot').map((i) => swingVertices[i].y));
  assert.ok(stanceFootSpeed > 1.6 && stanceFootSpeed < 2.3,
    `Grounded foot sweep suits two tiles per second (${stanceFootSpeed})`);
  assert.ok(swingFootHeight > .03, `Walk has a readable swing-foot lift (${swingFootHeight})`);
  Object.assign(report.clips.Walk, { travelSpeedTilesPerSecond: walkContract.travelSpeedTilesPerSecond,
    strideCycles: walkContract.strideCycles, stanceFootSpeed, swingFootHeight });
  walkMixer.stopAllAction();
}
if (metadata.id === 'dwarf-male') {
  const findBone = (name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name);
  const body = findBone('Body');
  const weapon = findBone('Weapon');
  const shield = findBone('Shield');
  const strikingArm = findBone('Arm.L.upper');
  const feet = ['Foot.L', 'Foot.R'].map(findBone);
  assert.equal(mesh.skeleton.bones.length, 15, 'Male dwarf retains all planned joints');
  assert.ok(body && weapon && shield && strikingArm && feet.every(Boolean),
    'Weapon, shield, striking arm, and both feet are independently rigged');
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const ownedVertices = (bone) => {
    const index = mesh.skeleton.bones.indexOf(bone);
    const indices = Array.from({ length: skinIndex.count }, (_, i) => i)
      .filter((i) => skinIndex.getX(i) === index && weights.getX(i) > .99);
    assert.ok(indices.length >= 10, `${boneName(bone)} owns visible geometry`);
    return indices;
  };
  const pickVertices = ownedVertices(weapon);
  const footVertices = feet.map(ownedVertices);
  const attackClip = gltf.animations.find((clip) => clip.name === 'Attack');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(attackClip).play();
  mixer.setTime(0);
  const ready = points();
  const headVertices = pickVertices.filter((i) => ready[i].y > .60);
  assert.ok(headVertices.length >= 30, 'The pick has a substantial raised metal head');
  const width = Math.max(...headVertices.map((i) => ready[i].x))
    - Math.min(...headVertices.map((i) => ready[i].x));
  const depth = Math.max(...headVertices.map((i) => ready[i].z))
    - Math.min(...headVertices.map((i) => ready[i].z));
  assert.ok(depth > 1.2 * width,
    `Pick head points mainly forward rather than across the body (${depth} vs ${width})`);
  const tipIndex = headVertices.reduce((front, i) => ready[i].z > ready[front].z ? i : front);
  model.updateMatrixWorld(true);
  const bodyOrigin = body.getWorldPosition(new THREE.Vector3());
  const armReady = strikingArm.quaternion.clone();
  const weaponReady = weapon.quaternion.clone();
  mixer.setTime(1 / 60);
  const early = points();
  const earlyPickMotion = early[tipIndex].distanceTo(ready[tipIndex]);
  mixer.setTime(metadata.animationContract.Attack.hitTime);
  const impact = points();
  const bodyImpact = body.getWorldPosition(new THREE.Vector3()).sub(bodyOrigin);
  const armSwing = strikingArm.quaternion.angleTo(armReady);
  const pickSnap = weapon.quaternion.angleTo(weaponReady);
  const tipMotion = impact[tipIndex].clone().sub(ready[tipIndex]);
  const forwardReach = impact[tipIndex].z - (bodyOrigin.z + bodyImpact.z);
  assert.ok(earlyPickMotion > .015, 'The pick starts moving in the first attack frame');
  assert.ok(bodyImpact.z > .04, 'The dwarf drives forward into the target');
  assert.ok(armSwing > .5 && pickSnap > .2, 'Arm chop and pick snap move independently');
  assert.ok(tipMotion.y < -.08 && forwardReach > .12,
    `The forward-pointing pick tip chops down ahead of the body (${tipMotion.toArray()}, reach ${forwardReach})`);
  let highestFoot = -Infinity;
  for (let step = 0; step <= 60; step += 1) {
    mixer.setTime(attackClip.duration * step / 60);
    const sample = points();
    for (const indices of footVertices) {
      const height = Math.min(...indices.map((i) => sample[i].y));
      highestFoot = Math.max(highestFoot, height);
      assert.ok(height >= -.008 && height <= .008,
        `Both boots brace through Attack (sample ${step}, height ${height})`);
    }
  }
  Object.assign(report.clips.Attack, { earlyPickMotion, bodyMotionAtImpact: bodyImpact.toArray(),
    armSwingRadians: armSwing, pickSnapRadians: pickSnap,
    pickTipMotionAtImpact: tipMotion.toArray(), forwardReachAtImpact: forwardReach,
    highestFoot });
  report.weaponVerticesChecked = pickVertices.length;
  report.pickHeadForwardDepth = depth;
  report.pickHeadSideWidth = width;
  report.groundedBootsChecked = footVertices.length;
  mixer.stopAllAction();
  mesh.skeleton.pose();
  const walkClip = gltf.animations.find((clip) => clip.name === 'Walk');
  const walkContract = metadata.animationContract.Walk;
  assert.ok(Math.abs(walkClip.duration - .5) < .0001 && walkContract.travelSpeedTilesPerSecond === 2
    && walkContract.strideCycles === 1, 'Dwarf walks one tile in half a second with one left-right cycle');
  const walkMixer = new THREE.AnimationMixer(model);
  walkMixer.clipAction(walkClip).play();
  walkMixer.setTime(0);
  model.updateMatrixWorld(true);
  const stanceStart = feet[0].getWorldPosition(new THREE.Vector3());
  walkMixer.setTime(.25);
  model.updateMatrixWorld(true);
  const stanceEnd = feet[0].getWorldPosition(new THREE.Vector3());
  const stanceFootSpeed = (stanceStart.z - stanceEnd.z) / .25;
  walkMixer.setTime(.375);
  const swing = points();
  const swingFootHeight = Math.min(...footVertices[0].map((i) => swing[i].y));
  assert.ok(stanceFootSpeed > 1.5 && stanceFootSpeed < 2.3,
    `Planted boot sweeps backward during forward travel at about two tiles per second (${stanceFootSpeed})`);
  assert.ok(swingFootHeight > .04, `Swing boot visibly clears the floor (${swingFootHeight})`);
  Object.assign(report.clips.Walk, { travelSpeedTilesPerSecond: 2, strideCycles: 1,
    stanceFootSpeed, swingFootHeight });
  walkMixer.stopAllAction();
}
if (metadata.id === 'water-nymph-female') {
  const findBone = (name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name);
  const body = findBone('Body');
  const spine = findBone('Spine');
  const arm = findBone('Arm.R.lower');
  const fingers = findBone('Grasp.R');
  const fingertips = findBone('Curl.R');
  const thumb = findBone('Thumb.R');
  const hair = ['Hair.L', 'Hair.R'].map(findBone);
  const skirt = findBone('Skirt.Front');
  const feet = ['Foot.L', 'Foot.R'].map(findBone);
  assert.equal(mesh.skeleton.bones.length, 23, 'Nymph has torso control, two finger bends and thumb opposition');
  assert.ok(body && spine && arm && fingers && fingertips && thumb && hair.every(Boolean) && skirt && feet.every(Boolean),
    'Hair, cloth, grabbing hand, and both feet have independent bones');
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const ownedVertices = (bone) => {
    const index = mesh.skeleton.bones.indexOf(bone);
    const indices = Array.from({ length: skinIndex.count }, (_, i) => i)
      .filter((i) => skinIndex.getX(i) === index && weights.getX(i) > .99);
    assert.ok(indices.length >= 12, `${boneName(bone)} owns visible geometry`);
    return indices;
  };
  const fingerJoints = [fingers, fingertips].map((bone) => mesh.skeleton.bones.indexOf(bone));
  const influence = (i, joint) => [0, 1, 2, 3].reduce((sum, channel) => sum +
    (skinIndex.getComponent(i, channel) === joint ? weights.getComponent(i, channel) : 0), 0);
  const fingerVertices = Array.from({ length: skinIndex.count }, (_, i) => i)
    .filter((i) => fingerJoints.reduce((sum, joint) => sum + influence(i, joint), 0) > .99);
  const distalVertices = fingerVertices.filter((i) => influence(i, fingerJoints[1]) > .9);
  assert.ok(distalVertices.length >= 12, 'The fist check samples the distal finger surface');
  assert.ok(fingerVertices.length >= 24, 'The two finger bends own the finger surface');
  for (const joint of fingerJoints) {
    assert.ok(fingerVertices.filter((i) => influence(i, joint) > .1).length >= 12,
      'Each finger bend influences visible finger geometry');
  }
  const footVertices = feet.map(ownedVertices);
  const bodyIndex = mesh.skeleton.bones.indexOf(spine);
  const armIndex = mesh.skeleton.bones.indexOf(findBone('Arm.R.upper'));
  let softShoulderVertices = 0;
  for (let i = 0; i < skinIndex.count; i += 1) {
    const joints = [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)];
    const values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
    const bodyWeight = values.reduce((sum, value, channel) => sum + (joints[channel] === bodyIndex ? value : 0), 0);
    const armWeight = values.reduce((sum, value, channel) => sum + (joints[channel] === armIndex ? value : 0), 0);
    if (bodyWeight > .1 && armWeight > .1) softShoulderVertices += 1;
  }
  assert.ok(softShoulderVertices >= 8, 'Continuous skin blends through the right shoulder');
  const attackClip = gltf.animations.find((clip) => clip.name === 'Attack');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(attackClip).play();
  mixer.setTime(0);
  const ready = points();
  const tipIndex = fingerVertices.reduce((front, i) => ready[i].z > ready[front].z ? i : front);
  const bodyOrigin = body.getWorldPosition(new THREE.Vector3());
  const armReady = arm.quaternion.clone();
  const thumbReady = thumb.quaternion.clone();
  mixer.setTime(1 / 60);
  const early = points();
  const earlyFingerMotion = early[tipIndex].distanceTo(ready[tipIndex]);
  mixer.setTime(2 / 30);
  const openPose = points();
  const openPalm = findBone('Hand.R').getWorldPosition(new THREE.Vector3());
  const openFingerReach = distalVertices.reduce((sum, i) => sum + openPose[i].distanceTo(openPalm), 0)
    / distalVertices.length;
  const openFingers = fingers.quaternion.clone();
  mixer.setTime(metadata.animationContract.Attack.hitTime);
  const impact = points();
  const bodyMotion = body.getWorldPosition(new THREE.Vector3()).sub(bodyOrigin);
  const armSwing = arm.quaternion.angleTo(armReady);
  const graspSnap = fingers.quaternion.angleTo(openFingers);
  const thumbFold = thumb.quaternion.angleTo(thumbReady);
  const fingerMotion = impact[tipIndex].clone().sub(ready[tipIndex]);
  const closedPalm = findBone('Hand.R').getWorldPosition(new THREE.Vector3());
  const closedFingerReach = distalVertices.reduce((sum, i) => sum + impact[i].distanceTo(closedPalm), 0)
    / distalVertices.length;
  assert.ok(closedFingerReach < openFingerReach * .8,
    'The distal fingers fold into a compact fist close to the palm');
  assert.ok(earlyFingerMotion > .05, 'Grab starts moving in the first attack frame');
  assert.ok(bodyMotion.z > .14 && fingerMotion.z > .17 && fingerMotion.y > .04,
    'Nymph reaches forward into the target');
  assert.ok(armSwing > .80 && graspSnap > .80,
    'Forearm reach and closing fingers are separate attack actions');
  assert.ok(thumbFold > .5, 'The thumb folds across the curled fingers at contact');
  const contactHand = findBone('Hand.R').getWorldPosition(new THREE.Vector3());
  const contactGrip = fingers.quaternion.clone();
  mixer.setTime(11 / 60);
  model.updateMatrixWorld(true);
  const pulledHand = findBone('Hand.R').getWorldPosition(new THREE.Vector3());
  const snatchRetraction = contactHand.z - pulledHand.z;
  assert.ok(snatchRetraction > .12, 'The snatch pulls the hand back promptly after contact');
  assert.ok(fingers.quaternion.angleTo(contactGrip) < .1,
    'The fingers stay closed while pulling the stolen item inward');
  let highestFoot = -Infinity;
  for (let step = 0; step <= 60; step += 1) {
    mixer.setTime(attackClip.duration * step / 60);
    const sample = points();
    for (const indices of footVertices) {
      const height = Math.min(...indices.map((i) => sample[i].y));
      highestFoot = Math.max(highestFoot, height);
      assert.ok(height >= -.008 && height <= .008,
        `Both bare feet brace through Attack (sample ${step}, height ${height})`);
    }
  }
  Object.assign(report.clips.Attack, { earlyFingerMotion,
    bodyMotionAtImpact: bodyMotion.toArray(), fingerMotionAtImpact: fingerMotion.toArray(),
    armSwingRadians: armSwing, graspSnapRadians: graspSnap, thumbFoldRadians: thumbFold,
    snatchRetraction, openFingerReach, closedFingerReach, highestFoot });
  report.fingerVerticesChecked = fingerVertices.length;
  report.softShoulderVerticesChecked = softShoulderVertices;
  report.hairBonesChecked = hair.length;
  report.groundedFeetChecked = footVertices.length;
  mixer.stopAllAction();
  mesh.skeleton.pose();
  const walkClip = gltf.animations.find((clip) => clip.name === 'Walk');
  const walkContract = metadata.animationContract.Walk;
  assert.ok(Math.abs(walkClip.duration - .5) < .0001 && walkContract.travelSpeedTilesPerSecond === 2
    && walkContract.strideCycles === 1, 'Nymph crosses one tile in a half-second left-right gait');
  const walkMixer = new THREE.AnimationMixer(model);
  walkMixer.clipAction(walkClip).play();
  walkMixer.setTime(0);
  model.updateMatrixWorld(true);
  const stanceStart = feet[0].getWorldPosition(new THREE.Vector3());
  walkMixer.setTime(.25);
  model.updateMatrixWorld(true);
  const stanceEnd = feet[0].getWorldPosition(new THREE.Vector3());
  const stanceFootSpeed = (stanceStart.z - stanceEnd.z) / .25;
  walkMixer.setTime(.375);
  const swing = points();
  const swingFootHeight = Math.min(...footVertices[0].map((i) => swing[i].y));
  assert.ok(stanceFootSpeed > 1.5 && stanceFootSpeed < 2.4,
    `Planted foot sweeps backward at travel speed (${stanceFootSpeed})`);
  assert.ok(swingFootHeight > .04, `Swing foot clears the floor (${swingFootHeight})`);
  Object.assign(report.clips.Walk, { travelSpeedTilesPerSecond: 2, strideCycles: 1,
    stanceFootSpeed, swingFootHeight });
  walkMixer.stopAllAction();
}
if (metadata.id === 'water-nymph-female') {
  // Check body mechanics in the exported mesh, including in-between frames.
  mesh.skeleton.pose();
  model.updateMatrixWorld(true);
  const findBone = (name) => mesh.skeleton.bones.find((bone) => boneName(bone) === name);
  const pelvis = findBone('Body'), chest = findBone('Spine');
  const bodyOrigin = pelvis.getWorldPosition(new THREE.Vector3());
  const readyHands = [];
  for (const side of ['L', 'R']) {
    const hand = findBone(`Hand.${side}`).getWorldPosition(new THREE.Vector3());
    const shoulder = findBone(`Arm.${side}.upper`).getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(hand.x - bodyOrigin.x) > .23 && hand.y < shoulder.y - .30
      && hand.y < bodyOrigin.y + .16,
      'The ready hands stay outside the torso at relaxed hip height');
    readyHands.push(hand);
  }
  assert.ok(Math.abs(readyHands[0].y - readyHands[1].y) > .07,
    'The resting hands have visibly different heights');
  assert.ok(Math.abs(Math.abs(readyHands[0].x - bodyOrigin.x)
    - Math.abs(readyHands[1].x - bodyOrigin.x)) > .07,
    'The resting arms have different lateral reaches');
  const feet = ['Foot.L', 'Foot.R'].map(findBone);
  const restPelvis = pelvis.getWorldQuaternion(new THREE.Quaternion());
  const restChest = chest.getWorldQuaternion(new THREE.Quaternion());
  const restFeet = feet.map((foot) => foot.getWorldQuaternion(new THREE.Quaternion()));
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const soleVertices = feet.map((foot) => {
    const joint = mesh.skeleton.bones.indexOf(foot);
    return Array.from({ length: skinIndex.count }, (_, i) => i)
      .filter((i) => skinIndex.getX(i) === joint && weights.getX(i) > .99);
  });
  const clip = gltf.animations.find((item) => item.name === 'Walk');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
  let doubleSupportSamples = 0, maximumFootRoll = 0;
  for (let step = 0; step < 60; step += 1) {
    mixer.setTime(clip.duration * step / 60);
    const sample = points();
    const heights = soleVertices.map((indices) => Math.min(...indices.map((i) => sample[i].y)));
    assert.ok(Math.min(...heights) < .008, 'Walking retains a supporting foot throughout the cycle');
    if (heights.every((height) => height < .008)) doubleSupportSamples += 1;
    for (let side = 0; side < 2; side += 1) {
      maximumFootRoll = Math.max(maximumFootRoll,
        feet[side].getWorldQuaternion(new THREE.Quaternion()).angleTo(restFeet[side]));
      const cycle = (step / 60 + side * .5) % 1;
      if (cycle <= .55 + 1e-6) assert.ok(Math.abs(heights[side]) < .008, 'The stance sole stays grounded while the foot rolls');
    }
  }
  const yawFromRest = (bone, rest) => {
    const delta = bone.getWorldQuaternion(new THREE.Quaternion()).multiply(rest.clone().invert());
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(delta);
    return Math.atan2(forward.x, forward.z);
  };
  const torsoCounterRotation = [];
  for (const phase of [.25, .75]) {
    mixer.setTime(clip.duration * phase);
    model.updateMatrixWorld(true);
    const hipYaw = yawFromRest(pelvis, restPelvis), chestYaw = yawFromRest(chest, restChest);
    assert.ok(hipYaw * chestYaw < -.0002, 'Chest and pelvis counter-rotate during each half of the gait');
    torsoCounterRotation.push({ hipYaw, chestYaw });
  }
  assert.ok(doubleSupportSamples >= 4, 'Walk has a double-support interval instead of switching feet instantly');
  assert.ok(maximumFootRoll > .15, 'Heel contact and toe-off articulate the feet');
  Object.assign(report.clips.Walk, { doubleSupportSamples, maximumFootRoll, torsoCounterRotation });
  mixer.stopAllAction();
}
writeFileSync(path.join(directory, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
