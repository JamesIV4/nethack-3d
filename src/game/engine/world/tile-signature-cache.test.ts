import { describe, expect, it } from "vitest";
import { LevelTerrainCache, type LevelTerrainCacheDependencies } from "./level-terrain-cache";

describe("tile signature decoding", () => {
  it("reuses pure decoding while returning independent snapshots and fresh changed values", () => {
    const state = new Map([["4,5", "123|%7C|7|ti:8|si:9|gf:16"]]);
    const deps = { tileUpdates: { tileStateCache: state } } as LevelTerrainCacheDependencies;
    const cache = new LevelTerrainCache(deps);
    const signature = state.get("4,5")!;
    const first = cache.parseTileStateSignature(signature)!;
    expect(first).toEqual({ glyph: 123, char: "|", color: 7, tileIndex: 8, symidx: 9, glyphFlags: 16 });
    first.glyph = 999;
    const second = cache.parseTileStateSignature(signature)!;
    expect(second.glyph).toBe(123);
    expect(second).not.toBe(first);
    state.set("4,5", "456|%40|3|ti:20|si:21|gf:32");
    expect(cache.getTileSnapshotFromStateCache("4,5")).toEqual({ glyph: 456, char: "@", color: 3, tileIndex: 20, symidx: 21 });
    for (let i = 0; i < 2100; i++) cache.parseTileStateSignature(`${i}|x|1`);
    expect(cache.parseTileStateSignature(signature)).toEqual(second);
    expect(cache.parseTileStateSignature("invalid")).toBeNull();
    expect(cache.parseTileStateSignature("invalid")).toBeNull();
    expect(cache.parseTileStateSignature("1|%invalid|NaN")).toMatchObject({ glyph: 1, char: "%invalid", color: undefined });
  });
});
