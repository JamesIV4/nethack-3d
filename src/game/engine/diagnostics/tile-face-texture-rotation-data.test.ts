import { describe, expect, it } from "vitest";

import {
  createDefaultTileFaceTextureRotationOverrides,
  normalizeTileFaceTextureRotationOverrides,
  serializeTileFaceTextureRotationOverrides,
} from "./tile-face-texture-rotation-data";

describe("tile face texture rotation data", () => {
  it("includes the accepted calibration file as built-in defaults", () => {
    expect(createDefaultTileFaceTextureRotationOverrides()).toEqual({
      "5.0:tile:1273": { north: 90, south: 90 },
      "5.0:tile:1274": { east: 90, north: 180, south: 180 },
      "5.0:tile:1275": { west: 180, south: 180 },
      "5.0:tile:1276": { south: 180 },
      "5.0:tile:1277": { west: 180, north: 270, south: 180 },
      "5.0:tile:1278": { west: 90, south: 180 },
    });
  });

  it("keeps supported tile variants, faces and non-zero quarter turns", () => {
    expect(
      normalizeTileFaceTextureRotationOverrides({
        formatVersion: 1,
        rotations: {
          "5.0:tile:412": { east: 450, west: -90, top: 0, diagonal: 90 },
          "../../outside": { north: 90 },
          "3.6.7:tile:20": { south: 181, bottom: Number.NaN },
        },
      }),
    ).toEqual({
      "5.0:tile:412": { east: 90, west: 270 },
      "3.6.7:tile:20": { south: 180 },
    });
  });

  it("serializes variants and faces in stable order and omits zeroes", () => {
    expect(
      serializeTileFaceTextureRotationOverrides({
        "5.0:tile:9": { west: 270, east: 90 },
        "3.6.7:tile:2": { top: 360, north: 180 },
      }),
    ).toEqual({
      formatVersion: 1,
      rotations: {
        "3.6.7:tile:2": { north: 180 },
        "5.0:tile:9": { east: 90, west: 270 },
      },
    });
  });
});
