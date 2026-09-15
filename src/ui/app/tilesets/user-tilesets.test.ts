import { afterEach, describe, expect, it, vi } from "vitest";
import { inferTilesetTileDimensionsFromBlob, normalizeUserTilesetTileSizes, resolveUserTilesetTileHeight, toUserTilesetRegistrations } from "./user-tilesets";
import type { StoredUserTilesetRecord } from "../../../game/user-tileset-storage";

function imageBoundary(width: number, height: number, fail = false) {
  vi.stubGlobal("window", { Image: class {
    naturalWidth = width;
    naturalHeight = height;
    onload = () => {};
    onerror = () => {};
    set src(_value: string) { queueMicrotask(() => fail ? this.onerror() : this.onload()); }
  } });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
}

function record(extra: Partial<StoredUserTilesetRecord> = {}): StoredUserTilesetRecord {
  return {
    id: "user-geoduck", label: "Geoduck", tileSize: 15, tileLayoutVersion: "3.6.7",
    fileName: "geoduck.png", mimeType: "image/png", blob: new Blob(), createdAt: 1, updatedAt: 2,
    ...extra,
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("user tileset rectangular dimensions", () => {
  it.each([8, 17, 24, 48, 73])("supports custom height %s without assuming Geoduck's ratio", async height => {
    imageBoundary(1280, height * 39);
    const dimensions = await inferTilesetTileDimensionsFromBlob(new Blob(), "3.6.7");
    const saved = record({ tileSize: dimensions.tileWidth, tileHeight: resolveUserTilesetTileHeight(String(height), dimensions.tileHeight) });
    const [restored] = await normalizeUserTilesetTileSizes([saved]);
    expect(toUserTilesetRegistrations([restored])[0]).toMatchObject({ tileSize: 32, tileHeight: height });
  });

  it("uses inference for a blank height and rejects invalid manual heights", () => {
    expect(resolveUserTilesetTileHeight("", 25)).toBe(25);
    for (const invalid of ["0", "-1", "1.5", "NaN", "Infinity"]) {
      expect(() => resolveUserTilesetTileHeight(invalid, 25)).toThrow();
    }
  });
  it.each([[975, "3.6.7"], [1500, "5.0"]] as const)("infers original Geoduck height %s for layout %s", async (height, layout) => {
    imageBoundary(600, height);
    expect(await inferTilesetTileDimensionsFromBlob(new Blob(), layout)).toEqual({ tileWidth: 15, tileHeight: 25 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("repairs an old Geoduck record and forwards its height to the runtime registration", async () => {
    imageBoundary(600, 975);
    const [restored] = await normalizeUserTilesetTileSizes([record()]);
    expect(restored).toMatchObject({ tileSize: 15, tileHeight: 25, createdAt: 1, updatedAt: 2 });
    expect(toUserTilesetRegistrations([restored])[0]).toMatchObject({ tileSize: 15, tileHeight: 25 });
  });

  it("preserves explicit rectangular metadata during rehydration", async () => {
    imageBoundary(600, 1800);
    const [restored] = await normalizeUserTilesetTileSizes([record({ tileHeight: 30 })]);
    expect(restored.tileHeight).toBe(30);
  });

  it("retains stored dimensions when the image cannot load", async () => {
    imageBoundary(0, 0, true);
    const [restored] = await normalizeUserTilesetTileSizes([record({ tileHeight: 25 })]);
    expect(restored).toMatchObject({ tileSize: 15, tileHeight: 25 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
