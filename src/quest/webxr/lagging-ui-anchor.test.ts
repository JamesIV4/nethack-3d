import * as THREE from "three";
import { expect, it } from "vitest";
import { LaggingUiAnchor } from "./lagging-ui-anchor";
const position = new THREE.Vector3(0, 1.6, 0);
it("holds position and yaw inside the deadzone and never follows height", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position, 0, 0);
  for (let t = 10; t <= 1000; t += 10) ui.update(new THREE.Vector3(.1, 3, .1), .2, t);
  expect(ui.yaw).toBe(0); expect(ui.position).toEqual(position);
});
it("starts gently, catches up exponentially, and settles without overshoot", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position, 0, 0);
  ui.update(position, 2, 10); const first = ui.yaw;
  ui.update(position, 2, 20); expect(ui.yaw - first).toBeGreaterThan(first);
  let previous = ui.yaw;
  for (let t = 30; t <= 2000; t += 10) { ui.update(position, 2, t); expect(ui.yaw).toBeGreaterThanOrEqual(previous); expect(ui.yaw).toBeLessThanOrEqual(2); previous = ui.yaw; }
  expect(ui.yaw).toBe(2);
});
it("follows horizontal movement while keeping the original height", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position, 0, 0);
  for (let t = 10; t <= 2000; t += 10) ui.update(new THREE.Vector3(1, .7, -1), 0, t);
  expect(ui.position).toEqual(new THREE.Vector3(1, 1.6, -1));
});
it("snap recenter immediately clears lag without changing height", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position, 0, 0); ui.update(position, 1, 50);
  ui.reset(new THREE.Vector3(.5, .8, .7), -.6, 60, true);
  expect(ui.yaw).toBe(-.6); expect(ui.position).toEqual(new THREE.Vector3(.5, 1.6, .7));
  ui.update(new THREE.Vector3(.5, .8, .7), -.6, 70); expect(ui.yaw).toBe(-.6);
});
it("takes the short route across the angle boundary and is frame-rate independent", () => {
  const run = (hz: number) => { const ui = new LaggingUiAnchor(); ui.reset(position, 1.5, 0);
    for (let i = 1; i <= hz; i++) ui.update(position, -2.8, i * 1000 / hz); return ui.yaw; };
  expect(run(60)).toBeCloseTo(run(90), 8);
  expect(run(60)).toBeCloseTo(-2.8, 2);
});
it("finishes at the latched target while the headset keeps making small movements", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position,0,0);
  ui.update(new THREE.Vector3(.4,1.6,0),2,10);
  for(let t=20;t<=2500;t+=10) ui.update(new THREE.Vector3(.4+.05*Math.sin(t),1.6,0),2+.15*Math.sin(t),t);
  expect(ui.yaw).toBe(2); expect(ui.position.x).toBe(.4);
});
it("evaluates the next deadzone from the new target even during catch-up", () => {
  const ui = new LaggingUiAnchor(); ui.reset(position,0,0); ui.update(position,1.7,10);
  for(let t=20;t<=2500;t+=10) ui.update(position,2.8,t);
  expect(ui.yaw).toBe(1.7);
  ui.update(position,-2.7,2510);
  for(let t=2520;t<=5000;t+=10) ui.update(position,-2.7,t);
  expect(ui.yaw).toBe(-2.7);
});
