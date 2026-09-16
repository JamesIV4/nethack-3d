import { describe, expect, it } from "vitest";
import { GRID_UI_HEADING_STEP, gridUiGameYaw, gridUiHeading, snapGridUiHeading } from "./grid-ui-heading";

describe("grid-aligned FPS HUD heading", () => {
  it("uses the dungeon's north axis at recenter, regardless of the physical tracking axis", () => {
    expect(gridUiGameYaw(1.91, 1.91, 0)).toBeCloseTo(Math.PI);
    expect(gridUiGameYaw(-2.4, -2.4, 0)).toBeCloseTo(Math.PI);
    expect(gridUiHeading(1.91, 1.91, 0)).toBeCloseTo(1.91);
    expect(gridUiHeading(-2.4, -2.4, 0)).toBeCloseTo(-2.4);
  });

  it("rounds physical head turns to the nearest cardinal or diagonal dungeon direction", () => {
    const recenterTrackingYaw = 1.1;
    expect(gridUiGameYaw(recenterTrackingYaw - 0.34, recenterTrackingYaw, 0)).toBeCloseTo(Math.PI);
    expect(gridUiHeading(recenterTrackingYaw - 0.34, recenterTrackingYaw, 0)).toBeCloseTo(recenterTrackingYaw);
    expect(gridUiGameYaw(recenterTrackingYaw - 0.52, recenterTrackingYaw, 0)).toBeCloseTo(-3 * Math.PI / 4);
    expect(gridUiHeading(recenterTrackingYaw - 0.52, recenterTrackingYaw, 0)).toBeCloseTo(recenterTrackingYaw - GRID_UI_HEADING_STEP);
  });

  it("moves with snap turns and fast-movement auto-turn offsets while staying on the grid", () => {
    const trackingYaw = 0.3, recenterTrackingYaw = 0.3;
    expect(gridUiGameYaw(trackingYaw, recenterTrackingYaw, GRID_UI_HEADING_STEP)).toBeCloseTo(-3 * Math.PI / 4);
    expect(gridUiHeading(trackingYaw, recenterTrackingYaw, GRID_UI_HEADING_STEP)).toBeCloseTo(.3);
    expect(gridUiGameYaw(trackingYaw, recenterTrackingYaw, -2 * GRID_UI_HEADING_STEP)).toBeCloseTo(Math.PI / 2);
    expect(gridUiHeading(trackingYaw, recenterTrackingYaw, -2 * GRID_UI_HEADING_STEP)).toBeCloseTo(.3);
  });

  it("wraps the nearest grid direction at the ±pi boundary", () => {
    expect(snapGridUiHeading(Math.PI - .01)).toBeCloseTo(Math.PI);
    expect(snapGridUiHeading(-Math.PI + .01)).toBeCloseTo(-Math.PI);
  });
});
