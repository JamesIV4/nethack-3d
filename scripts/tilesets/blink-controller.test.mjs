import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlinkController } from '../../tools/pixelhack-reference/blink-controller.mjs';

function fixture(random = () => .5) {
  const mesh = { morphTargetDictionary: { Smile: 0, Blink: 1 }, morphTargetInfluences: [.7, 0] };
  const model = { traverse: (visit) => visit(mesh) };
  return { mesh, controller: createBlinkController(model, { random }) };
}
function advance(controller, seconds) {
  for (let t = 0; t < seconds - 1e-8; t += .005) controller.update(Math.min(.005, seconds - t));
}

test('blink closes, holds and reopens while leaving other morphs alone', () => {
  const { mesh, controller } = fixture();
  advance(controller, 4.1);
  assert.ok(mesh.morphTargetInfluences[1] < .001);
  advance(controller, .04);
  assert.ok(mesh.morphTargetInfluences[1] > .4 && mesh.morphTargetInfluences[1] < .8);
  advance(controller, .05);
  assert.equal(mesh.morphTargetInfluences[1], 1);
  advance(controller, .20);
  assert.equal(mesh.morphTargetInfluences[1], 0);
  assert.equal(mesh.morphTargetInfluences[0], .7);
});

test('separate characters receive independent random schedules', () => {
  const a = fixture(() => 0), b = fixture(() => 1);
  advance(a.controller, 2.29);
  advance(b.controller, 2.29);
  assert.equal(a.mesh.morphTargetInfluences[1], 1);
  assert.equal(b.mesh.morphTargetInfluences[1], 0);
});

test('a double blink is followed by a normal randomized interval', () => {
  const { mesh, controller } = fixture(() => 0);
  advance(controller, 2.29);
  assert.equal(mesh.morphTargetInfluences[1], 1);
  advance(controller, .37);
  assert.equal(mesh.morphTargetInfluences[1], 1);
  advance(controller, .5);
  assert.equal(mesh.morphTargetInfluences[1], 0);
});

test('disposal and long frame gaps cannot leave the eyes closed', () => {
  const { mesh, controller } = fixture(() => 0);
  advance(controller, 2.29);
  controller.update(30);
  assert.equal(mesh.morphTargetInfluences[1], 0);
  advance(controller, 2.29);
  controller.dispose();
  controller.update(.08);
  assert.equal(mesh.morphTargetInfluences[1], 0);
});

test('models without eyelids are a no-op', () => {
  const controller = createBlinkController({ traverse: (visit) => visit({}) });
  assert.equal(controller.supported, false);
  controller.update(.1);
  controller.dispose();
});
