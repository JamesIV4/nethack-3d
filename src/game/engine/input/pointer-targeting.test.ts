import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointerTargeting, type PointerTargetingDependencies } from "./pointer-targeting";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

class TestCanvas {
  width = 2;
  height = 2;
  pixels = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 127, 0, 0, 0, 128, 0, 0, 0, 255]);
  read = vi.fn(() => ({ data: this.pixels }));
  getContext() { return { getImageData: this.read }; }
}

describe("sprite alpha picking", () => {
  it("preserves transparent edges, UV transforms and threshold changes without repeated canvas reads", () => {
    vi.stubGlobal("HTMLCanvasElement", TestCanvas);
    const picker = new PointerTargeting({} as PointerTargetingDependencies);
    const canvas = new TestCanvas();
    const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    texture.flipY = true;
    const material = new THREE.SpriteMaterial({ map: texture, alphaTest: 128 / 255 });
    const sprite = new THREE.Sprite(material);
    const hit = (u: number, v: number) => picker.isOpaqueSpriteIntersection({
      object: sprite, uv: new THREE.Vector2(u, v), distance: 0, point: new THREE.Vector3(),
    });
    expect(hit(0.25, 0.75)).toBe(false);
    expect(hit(0.75, 0.75)).toBe(false);
    expect(hit(0.25, 0.25)).toBe(true);
    expect(hit(0.75, 0.25)).toBe(true);
    for (let i = 0; i < 120; i++) expect(hit(0.25, 0.25)).toBe(true);
    expect(canvas.read).toHaveBeenCalledTimes(1);
    material.alphaTest = 129 / 255;
    expect(hit(0.25, 0.25)).toBe(false);
    texture.offset.set(0.5, 0);
    texture.updateMatrix();
    expect(hit(0.25, 0.25)).toBe(true);
    expect(canvas.read).toHaveBeenCalledTimes(1);
  });

  it("invalidates after published damage textures, shared source edits, resize and image replacement", () => {
    vi.stubGlobal("HTMLCanvasElement", TestCanvas);
    const picker = new PointerTargeting({} as PointerTargetingDependencies);
    const canvas = new TestCanvas();
    const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    texture.flipY = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    const hit = () => picker.isOpaqueSpriteIntersection({ object: sprite, uv: new THREE.Vector2(0.25, 0.75), distance: 0, point: new THREE.Vector3() });
    expect(hit()).toBe(false);
    canvas.pixels[3] = 255;
    texture.needsUpdate = true;
    expect(hit()).toBe(true);
    canvas.pixels[3] = 0;
    texture.source.needsUpdate = true;
    expect(hit()).toBe(false);
    canvas.height = 1;
    hit();
    expect(canvas.read).toHaveBeenCalledTimes(4);
    const replacement = new TestCanvas();
    texture.image = replacement;
    hit();
    expect(replacement.read).toHaveBeenCalledTimes(1);
    replacement.width = 0;
    expect(hit()).toBe(false);
  });
});
