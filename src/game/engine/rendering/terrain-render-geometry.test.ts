import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { TerrainRenderGeometry } from "./terrain-render-geometry";

it("omits only downward triangles while preserving original picking geometry and face material indices", () => {
  const owner = new TerrainRenderGeometry(), original = new THREE.BoxGeometry(1, 1, 1);
  const before = Array.from(original.index!.array);
  const result = owner.withoutBottom(original);
  expect(result.index!.count).toBe(30);
  expect(result.groups.map(g => g.materialIndex)).toEqual([0, 1, 2, 3, 4]);
  expect(Array.from(original.index!.array)).toEqual(before);
  expect(Array.from(result.attributes.uv.array)).toEqual(Array.from(original.attributes.uv.array));
  for (const i of result.index!.array) expect(result.attributes.normal.getZ(i)).toBeGreaterThan(-0.9);
  expect(owner.withoutBottom(original)).toBe(result);
  const disposed = vi.fn(); result.addEventListener("dispose", disposed);
  original.dispose(); expect(disposed).toHaveBeenCalledOnce();
  owner.dispose(); expect(disposed).toHaveBeenCalledOnce();
});

it("invalidates copied UVs/attributes and supports nonindexed chamfer geometry", () => {
  const owner = new TerrainRenderGeometry(), original = new THREE.BoxGeometry();
  const first = owner.withoutBottom(original);
  original.attributes.uv.setX(0, 0.25); original.attributes.uv.needsUpdate = true;
  const second = owner.withoutBottom(original);
  expect(second).not.toBe(first); expect(second.attributes.uv.getX(0)).toBe(0.25);
  original.setAttribute("uv", original.attributes.uv.clone());
  expect(owner.withoutBottom(original)).not.toBe(second);
  const shape = new THREE.Shape([new THREE.Vector2(-1, -1), new THREE.Vector2(1, -1), new THREE.Vector2(0, 1)]);
  const chamfer = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  const open = owner.withoutBottom(chamfer);
  expect(open.index!.count).toBeLessThan(chamfer.attributes.position.count);
  for (const i of open.index!.array) expect(open.attributes.normal.getZ(i)).toBeGreaterThan(-0.9);
  owner.dispose();
});

it("merges adjacent identical face draws without changing two-pass transparency order", () => {
  const owner = new TerrainRenderGeometry(), source = new THREE.BoxGeometry();
  const side = new THREE.MeshBasicMaterial({ transparent: true }), top = new THREE.MeshBasicMaterial();
  const materials = [side, side, top, top, top, top];
  const merged = owner.withoutBottom(source, materials);
  expect(merged.groups).toEqual([{ start: 0, count: 12, materialIndex: 0 }, { start: 12, count: 18, materialIndex: 2 }]);
  expect(owner.withoutBottom(source, materials)).toBe(merged);
  side.side = THREE.DoubleSide;
  expect(owner.withoutBottom(source, materials).groups).toHaveLength(3);
  side.forceSinglePass = true;
  expect(owner.withoutBottom(source, materials)).toBe(merged);
  materials[1] = top;
  expect(owner.withoutBottom(source, materials).groups).toEqual([{ start: 0, count: 6, materialIndex: 0 }, { start: 6, count: 24, materialIndex: 1 }]);
  expect(source.groups).toHaveLength(6);
  owner.dispose();
});
