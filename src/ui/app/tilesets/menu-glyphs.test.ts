import { afterEach, describe, expect, it, vi } from "vitest";
import { isMenuItemTileApplicable, resolveMenuItemTileIndex, resolveMenuItemTilePreviewDataUrl } from "./menu-glyphs";

afterEach(() => vi.unstubAllGlobals());

describe("runtime menu tile decisions", () => {
  it("honors explicit non-tile and tile-without-index decisions without consulting fallback helpers", () => {
    const lookup = vi.fn(() => 77);
    vi.stubGlobal("nethackGlobal", { helpers: { tileIndexForGlyph: lookup } });
    expect(resolveMenuItemTileIndex({ glyph: 5, tileIndex: 9, isTileApplicable: false })).toBeNull();
    expect(resolveMenuItemTileIndex({ glyph: 5, isTileApplicable: true })).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("uses explicit tile indexes before live glyph lookup for older payloads", () => {
    const lookup = vi.fn(() => 77);
    vi.stubGlobal("nethackGlobal", { helpers: { tileIndexForGlyph: lookup } });
    expect(resolveMenuItemTileIndex({ glyph: 5, tileIndex: 9 })).toBe(9);
    expect(lookup).not.toHaveBeenCalled();
    expect(resolveMenuItemTileIndex({ glyph: 5 })).toBe(77);
    expect(lookup).toHaveBeenCalledWith(5);
  });

  it("ignores category rows, whitespace glyphs and runtime NO_GLYPH sentinels", () => {
    vi.stubGlobal("nethackGlobal", { constants: { GLYPH: { NO_GLYPH: 6000, MAX_GLYPH: 7000 } } });
    expect(isMenuItemTileApplicable({ isCategory: true, tileIndex: 9 })).toBe(false);
    expect(isMenuItemTileApplicable({ glyphChar: " ", tileIndex: 9 })).toBe(false);
    expect(isMenuItemTileApplicable({ glyph: 6000, tileIndex: 9 })).toBe(false);
    expect(isMenuItemTileApplicable({ glyph: 7000, tileIndex: 9 })).toBe(true);
  });

  it("falls back to MAX_GLYPH when the runtime omits NO_GLYPH", () => {
    vi.stubGlobal("nethackGlobal", { constants: { GLYPH: { MAX_GLYPH: 6000 } } });
    expect(resolveMenuItemTileIndex({ glyph: 6000, tileIndex: 9 })).toBeNull();
  });

  it("survives unavailable, failing and invalid live glyph helpers", () => {
    expect(resolveMenuItemTileIndex({ glyph: 5 })).toBeNull();
    vi.stubGlobal("nethackGlobal", { helpers: { tileIndexForGlyph: () => { throw new Error("runtime disposed"); } } });
    expect(resolveMenuItemTileIndex({ glyph: 5 })).toBeNull();
    vi.stubGlobal("nethackGlobal", { helpers: { tileIndexForGlyph: () => -1 } });
    expect(resolveMenuItemTileIndex({ glyph: 5 })).toBeNull();
  });

  it("retains runtime-supplied tile previews independently of tile lookup", () => {
    expect(resolveMenuItemTilePreviewDataUrl({ tilePreviewDataUrl: " data:image/png;base64,abc " })).toBe("data:image/png;base64,abc");
    expect(resolveMenuItemTilePreviewDataUrl({ tilePreviewDataUrl: "  " })).toBeNull();
  });
});
