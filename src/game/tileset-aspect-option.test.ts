import { afterAll, describe, expect, it, vi } from "vitest";
import { defaultNh3dClientOptions, normalizeNh3dClientOptions } from "./ui-types";

vi.hoisted(() => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } });
});
afterAll(() => vi.unstubAllGlobals());

describe("tile aspect ratio preference", () => {
  it("enables matching blocks for new and existing settings without the option", () => {
    expect(defaultNh3dClientOptions.tilesetUseTileAspectRatio).toBe(true);
    expect(normalizeNh3dClientOptions().tilesetUseTileAspectRatio).toBe(true);
    expect(normalizeNh3dClientOptions({ tilesetMode: "tiles" }).tilesetUseTileAspectRatio).toBe(true);
  });

  it.each([true, false])("preserves an explicit saved preference of %s", enabled => {
    const saved = JSON.parse(JSON.stringify(normalizeNh3dClientOptions({ tilesetUseTileAspectRatio: enabled })));
    expect(normalizeNh3dClientOptions(saved).tilesetUseTileAspectRatio).toBe(enabled);
  });
});
