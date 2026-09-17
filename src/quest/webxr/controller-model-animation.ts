import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ControllerAnimation { update(gamepad: Gamepad | undefined): void; channels: number }
type Kind = "trigger" | "grip" | "primary" | "secondary" | "menu" | "stick";
const names: [string, Kind][] = [["trigger_front", "trigger"], ["trigger_grip", "grip"], ["button_a", "primary"], ["button_x", "primary"], ["button_b", "secondary"], ["button_y", "secondary"], ["button_oculus", "menu"], ["thumbstick", "stick"]];
const buttonIndex = { trigger: 0, grip: 1, primary: 4, secondary: 5, menu: 6, stick: 3 };
// Meta runtime GLBs also support the legacy 41-pose layout documented by the
// SDK's OVRGLTFAnimatinonNode. These are pose indices, not animation timestamps.
const fullPoseIndex = { primary: 5, secondary: 8, menu: 24, trigger: 16, grip: 21, stick: 0 };
const stickPoses = [29, 39, 34, 40, 31, 36, 32, 37]; // N, NE, E, SE, S, SW, W, NW.
const directions = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const axis = (value: number | undefined) => THREE.MathUtils.clamp(finite(value), -1, 1);
const button = (pad: Gamepad | undefined, index: number) => THREE.MathUtils.clamp(finite(pad?.buttons[index]?.value, pad?.buttons[index]?.pressed ? 1 : 0), 0, 1);

export function stickBlend(x: number, y: number): { a: number; b: number; wa: number; wb: number } {
  x = axis(x); y = axis(y);
  if (Math.hypot(x, y) < 0.005) return { a: 0, b: 1, wa: 0, wb: 0 };
  const angle = (Math.atan2(x, y) + Math.PI * 2) % (Math.PI * 2);
  const a = Math.floor(angle / (Math.PI / 4)) % 8, b = (a + 1) % 8;
  const [ax, ay] = directions[a], [bx, by] = directions[b], det = ax * by - ay * bx;
  return { a, b, wa: Math.max(0, (x * by - y * bx) / det), wb: Math.max(0, (ax * y - ay * x) / det) };
}

type Binding = { node: THREE.Object3D; kind: Kind; path: string; values: number[]; width: number; poses: number; additive: number | null; base: number[]; targets: THREE.Mesh[] };
export async function runtimeControllerAnimation(gltf: GLTF): Promise<ControllerAnimation> {
  const json = gltf.parser.json, bindings: Binding[] = [];
  for (const animation of json.animations ?? []) for (const channel of animation.channels ?? []) {
    const definition = json.nodes?.[channel.target.node];
    const kind = names.find(([name]) => String(definition?.name).toLowerCase().includes(name))?.[1];
    if (!kind) continue;
    const sampler = animation.samplers[channel.sampler];
    const input = await gltf.parser.getDependency("accessor", sampler.input) as THREE.BufferAttribute;
    const output = await gltf.parser.getDependency("accessor", sampler.output) as THREE.BufferAttribute;
    if (sampler.interpolation === "CUBICSPLINE") throw new Error("Unsupported cubic controller pose channel");
    const node = await gltf.parser.getDependency("node", channel.target.node) as THREE.Object3D;
    const path = channel.target.path as string;
    if (!["translation", "rotation", "scale", "weights"].includes(path)) continue;
    const width = path === "rotation" ? 4 : path === "weights" ? output.count * output.itemSize / input.count : 3;
    if (!Number.isInteger(width) || width < 1 || input.count < 2) throw new Error("Invalid controller pose channel");
    if (kind === "stick" && input.count !== 9 && input.count < 41) throw new Error("Unsupported runtime thumbstick poses");
    const values: number[] = [];
    for (let i = 0; i < output.count; i++) for (let c = 0; c < output.itemSize; c++) values.push(output.getComponent(i, c));
    if (values.length !== input.count * width) throw new Error("Invalid controller pose dimensions");
    if (!values.every(Number.isFinite)) throw new Error("Non-finite controller pose");
    const targets: THREE.Mesh[] = [];
    node.traverse(child => { if ((child as THREE.Mesh).morphTargetInfluences) targets.push(child as THREE.Mesh); });
    const base = path === "rotation" ? node.quaternion.toArray() : path === "translation" ? node.position.toArray() : path === "scale" ? node.scale.toArray() : [...(targets[0]?.morphTargetInfluences ?? Array(width).fill(0))];
    bindings.push({ node, kind, path, values, width, poses: input.count, additive: Number.isInteger(channel.extras?.additiveWeightIndex) ? channel.extras.additiveWeightIndex : null, base, targets });
  }
  if (!bindings.length) throw new Error("Runtime model has no supported controller animations");
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  let previous = "";
  return { channels: bindings.length, update(pad) {
    const snapshot = JSON.stringify([pad?.buttons.map(b => [b.value, b.pressed, b.touched]), pad?.axes]);
    if (snapshot === previous) return; previous = snapshot;
    const morphs = new Map<THREE.Mesh, number[]>();
    for (const binding of bindings) {
      const { node, path, values, width, poses, kind, base } = binding;
      const t = button(pad, buttonIndex[kind]);
      let result: number[];
      if (kind === "stick" && path === "rotation") {
        const blend = stickBlend(pad?.axes[2] ?? pad?.axes[0] ?? 0, -(pad?.axes[3] ?? pad?.axes[1] ?? 0));
        const indices = poses >= 41 ? stickPoses : [1, 2, 3, 4, 5, 6, 7, 8];
        const total = blend.wa + blend.wb;
        q0.fromArray(base); q1.fromArray(values, indices[blend.a] * 4); q2.fromArray(values, indices[blend.b] * 4);
        if (total > 0) q0.slerp(q1.slerp(q2, blend.wb / total), Math.min(1, total));
        result = q0.toArray();
      } else {
        const index = poses >= 41 ? fullPoseIndex[kind] : poses - 1;
        const neutral = poses >= 41 ? base : values.slice(0, width);
        if (path === "rotation") result = q0.fromArray(neutral).slerp(q1.fromArray(values, index * width), t).toArray();
        else result = neutral.map((v, i) => v + (values[index * width + i] - v) * t);
      }
      if (path === "translation") node.position.fromArray(result);
      else if (path === "rotation") node.quaternion.fromArray(result);
      else if (path === "scale") node.scale.fromArray(result);
      else if (path === "weights") for (const target of binding.targets) {
        let weights = morphs.get(target);
        if (!weights) { weights = [...base]; morphs.set(target, weights); }
        if (binding.additive !== null) weights[binding.additive] = result[binding.additive];
        else result.forEach((v, i) => { weights![i] = v; });
      }
    }
    for (const [target, weights] of morphs) weights.forEach((v, i) => { target.morphTargetInfluences![i] = v; });
  } };
}

type Response = { componentProperty: "button" | "xAxis" | "yAxis" | "state"; states: string[]; valueNodeProperty: "transform" | "visibility"; valueNodeName: string; minNodeName?: string; maxNodeName?: string };
export interface ControllerProfile { layouts: Record<string, { components: Record<string, { gamepadIndices: { button?: number; xAxis?: number; yAxis?: number }; visualResponses: Record<string, Response> }> }> }
export function profileControllerAnimation(scene: THREE.Object3D, profile: ControllerProfile, hand: string): ControllerAnimation {
  const bindings = Object.values(profile.layouts[hand].components).flatMap(component => Object.values(component.visualResponses).map(response => {
    const value = scene.getObjectByName(response.valueNodeName), min = scene.getObjectByName(response.minNodeName ?? ""), max = scene.getObjectByName(response.maxNodeName ?? "");
    if (!value || (response.valueNodeProperty === "transform" && (!min || !max))) return null;
    return { component, response, value, min, max };
  })).filter(binding => binding !== null);
  if (!bindings.length) throw new Error("Controller profile has no matching animation nodes");
  return { channels: bindings.length, update(pad) {
    for (const { component, response, value, min, max } of bindings) {
      const indices = component.gamepadIndices, b = pad?.buttons[indices.button ?? -1];
      const moved = Math.abs(axis(pad?.axes[indices.xAxis ?? -1])) > 0.05 || Math.abs(axis(pad?.axes[indices.yAxis ?? -1])) > 0.05;
      const state = b?.pressed || b?.value === 1 ? "pressed" : b?.touched || (b?.value ?? 0) > 0 || moved ? "touched" : "default";
      const enabled = response.states.includes(state);
      if (response.valueNodeProperty === "visibility") { value.visible = enabled; continue; }
      const t = !enabled ? (response.componentProperty.endsWith("Axis") ? 0.5 : 0) : response.componentProperty === "button" ? button(pad, indices.button ?? -1)
        : response.componentProperty === "xAxis" ? (axis(pad?.axes[indices.xAxis ?? -1]) + 1) / 2
        : response.componentProperty === "yAxis" ? (axis(pad?.axes[indices.yAxis ?? -1]) + 1) / 2 : 1;
      value.position.lerpVectors(min!.position, max!.position, t);
      value.quaternion.slerpQuaternions(min!.quaternion, max!.quaternion, t);
      value.scale.lerpVectors(min!.scale, max!.scale, t);
    }
  } };
}
