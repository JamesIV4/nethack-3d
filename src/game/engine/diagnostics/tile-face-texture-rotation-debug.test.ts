import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TileFaceTextureRotationDebug } from "./tile-face-texture-rotation-debug";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createDebug() {
  const refreshTilesFromStateCache = vi.fn();
  return {
    debug: new TileFaceTextureRotationDebug({
      tileUpdates: {
        refreshTilesFromStateCache,
      },
    }),
    refreshTilesFromStateCache,
  };
}

describe("tile face texture rotation debug", () => {
  it("keeps the localhost editor disabled by its internal switch", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const { debug } = createDebug();
    expect(debug.isEnabled()).toBe(false);
  });

  it("applies built-in face defaults even while the editor is disabled", () => {
    const { debug } = createDebug();
    const base = new THREE.BoxGeometry(1, 1, 1);
    const rotated = debug.resolveGeometry(base, "5.0:tile:1273");

    expect(debug.getRotationDegrees("5.0:tile:1273", "north")).toBe(90);
    expect(rotated).not.toBe(base);
    const baseUv = base.getAttribute("uv");
    const rotatedUv = rotated.getAttribute("uv");
    const normals = base.getAttribute("normal");
    for (let index = 0; index < baseUv.count; index += 1) {
      if (normals.getY(index) > 0.9) {
        expect(rotatedUv.getX(index)).toBeCloseTo(baseUv.getY(index));
        expect(rotatedUv.getY(index)).toBeCloseTo(1 - baseUv.getX(index));
      }
    }
  });

  it("rotates only the configured physical face and reuses its geometry", () => {
    const { debug } = createDebug();
    const variant = "3.6.7:tile:20";
    debug.rotationOverrides = { [variant]: { east: 90 } };
    const base = new THREE.BoxGeometry(1, 1, 1);

    const rotated = debug.resolveGeometry(base, variant);
    expect(rotated).not.toBe(base);
    expect(debug.resolveGeometry(base, variant)).toBe(rotated);

    const baseUv = base.getAttribute("uv");
    const rotatedUv = rotated.getAttribute("uv");
    const normals = base.getAttribute("normal");
    for (let index = 0; index < baseUv.count; index += 1) {
      const normalX = normals.getX(index);
      if (normalX > 0.9) {
        expect(rotatedUv.getX(index)).toBeCloseTo(baseUv.getY(index));
        expect(rotatedUv.getY(index)).toBeCloseTo(1 - baseUv.getX(index));
      } else if (normalX < -0.9) {
        expect(rotatedUv.getX(index)).toBeCloseTo(baseUv.getX(index));
        expect(rotatedUv.getY(index)).toBeCloseTo(baseUv.getY(index));
      }
    }
  });

  it("cycles a variant face, refreshes every matching tile and persists JSON", async () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { debug, refreshTilesFromStateCache } = createDebug();
    debug.debugEnabled = true;

    debug.cycleRotation({
      variant: "5.0:tile:412",
      tileIndex: 412,
      face: "south",
      rotationDegrees: 0,
    });

    expect(debug.rotationOverrides["5.0:tile:412"]).toEqual({ south: 90 });
    expect(refreshTilesFromStateCache).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/__nh3d/tile-face-texture-rotations",
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).rotations[
        "5.0:tile:412"
      ],
    ).toEqual({ south: 90 });
  });

  it("maps Three.js world normals to NetHack map sides", () => {
    const { debug } = createDebug();
    expect(debug.resolveFaceFromWorldNormal(new THREE.Vector3(1, 0, 0))).toBe(
      "east",
    );
    expect(debug.resolveFaceFromWorldNormal(new THREE.Vector3(0, 1, 0))).toBe(
      "north",
    );
    expect(debug.resolveFaceFromWorldNormal(new THREE.Vector3(0, -1, 0))).toBe(
      "south",
    );
    expect(debug.resolveFaceFromWorldNormal(new THREE.Vector3(0, 0, 1))).toBe(
      "top",
    );
  });
});
