import { describe, expect, it } from "vitest";

import { constrainFpsModeForTilesetMode } from "./client-option-constraints";

describe("constrainFpsModeForTilesetMode", () => {
  it("turns first-person mode off for Terminal display", () => {
    expect(constrainFpsModeForTilesetMode(true, "terminal")).toBe(false);
    expect(constrainFpsModeForTilesetMode(false, "terminal")).toBe(false);
  });

  it("preserves the first-person setting for 3D display modes", () => {
    expect(constrainFpsModeForTilesetMode(true, "ascii")).toBe(true);
    expect(constrainFpsModeForTilesetMode(true, "tiles")).toBe(true);
    expect(constrainFpsModeForTilesetMode(false, "tiles")).toBe(false);
  });
});
