import { describe, expect, it } from "vitest";
import { SinglePointerOwner, uvToSourcePoint } from "./input";

describe("uvToSourcePoint", () => {
  const bounds = { width: 1600, height: 1000 };

  it("flips the panel V axis into browser CSS coordinates", () => {
    expect(uvToSourcePoint({ x: 0.25, y: 0.75 }, bounds)).toEqual({
      x: 400,
      y: 250,
    });
  });

  it("uses the current source viewport size rather than a fixed texture size", () => {
    expect(
      uvToSourcePoint({ x: 0.5, y: 0.5 }, { width: 800, height: 600 }),
    ).toEqual({ x: 400, y: 300 });
  });

  it("keeps plane edges and out-of-range UVs inside the last source pixel", () => {
    expect(uvToSourcePoint({ x: 0, y: 1 }, bounds)).toEqual({ x: 0, y: 0 });
    expect(uvToSourcePoint({ x: 1, y: 0 }, bounds)).toEqual({
      x: 1599,
      y: 999,
    });
    expect(uvToSourcePoint({ x: -0.1, y: 1.2 }, bounds)).toEqual({ x: 0, y: 0 });
    expect(uvToSourcePoint({ x: 1.2, y: -0.1 }, bounds)).toEqual({
      x: 1599,
      y: 999,
    });
  });

  it("accepts a one-pixel source without returning a negative position", () => {
    expect(
      uvToSourcePoint({ x: 0.8, y: 0.2 }, { width: 1, height: 1 }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("returns no position before source bounds exist or when the ray misses", () => {
    expect(uvToSourcePoint({ x: 0.5, y: 0.5 }, undefined)).toBeNull();
    expect(uvToSourcePoint({ x: 0.5, y: 0.5 }, null)).toBeNull();
    expect(uvToSourcePoint(null, bounds)).toBeNull();
    expect(uvToSourcePoint(undefined, bounds)).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity])("rejects nonfinite input %s", (value) => {
    expect(uvToSourcePoint({ x: value, y: 0.5 }, bounds)).toBeNull();
    expect(uvToSourcePoint({ x: 0.5, y: value }, bounds)).toBeNull();
    expect(
      uvToSourcePoint({ x: 0.5, y: 0.5 }, { width: value, height: 1000 }),
    ).toBeNull();
    expect(
      uvToSourcePoint({ x: 0.5, y: 0.5 }, { width: 1600, height: value }),
    ).toBeNull();
  });

  it.each([0, -1, 0.5])("rejects unusable viewport dimensions %s", (value) => {
    expect(
      uvToSourcePoint({ x: 0.5, y: 0.5 }, { width: value, height: 1000 }),
    ).toBeNull();
    expect(
      uvToSourcePoint({ x: 0.5, y: 0.5 }, { width: 1600, height: value }),
    ).toBeNull();
  });
});

describe("SinglePointerOwner", () => {
  it("prevents a second controller stealing or releasing an active drag", () => {
    const pointer = new SinglePointerOwner();
    expect(pointer.claim("left")).toBe(true);
    expect(pointer.claim("left")).toBe(true);
    expect(pointer.claim("right")).toBe(false);
    expect(pointer.owns("right")).toBe(false);
    expect(pointer.release("right")).toBe(false);
    expect(pointer.activeOwner).toBe("left");
    expect(pointer.release("left")).toBe(true);
    expect(pointer.claim("right")).toBe(true);
  });

  it("allows a release after the controller ray leaves the panel", () => {
    const pointer = new SinglePointerOwner();
    pointer.claim("left");
    expect(uvToSourcePoint(null, { width: 1600, height: 1000 })).toBeNull();
    expect(pointer.release("left")).toBe(true);
    expect(pointer.activeOwner).toBeNull();
    expect(pointer.release("left")).toBe(false);
  });

  it("reports the cancelled owner once and permits a new session's controller", () => {
    const pointer = new SinglePointerOwner();
    pointer.claim("left");
    expect(pointer.cancel()).toBe("left");
    expect(pointer.activeOwner).toBeNull();
    expect(pointer.owns("left")).toBe(false);
    expect(pointer.cancel()).toBeNull();
    expect(pointer.claim("right")).toBe(true);
  });

  it("releases a disconnected owner without cancelling another controller", () => {
    const pointer = new SinglePointerOwner();
    pointer.claim("right");
    expect(pointer.release("left")).toBe(false);
    expect(pointer.activeOwner).toBe("right");
    expect(pointer.release("right")).toBe(true);
    expect(pointer.claim("left")).toBe(true);
  });
});
