import { afterEach, describe, expect, it, vi } from "vitest";
import { createNethackCallbackDispatcher } from "./bootstrap";

afterEach(() => vi.unstubAllGlobals());

describe("native callback return policy", () => {
  it("keeps old artifacts and non-glyph callbacks Promise based", async () => {
    vi.stubGlobal("nethackGlobal", {});
    const handle = vi.fn(() => 7);
    const callback = createNethackCallbackDispatcher(handle);
    const glyph = callback("shim_print_glyph", 1, 2);
    expect(glyph).toBeInstanceOf(Promise);
    await expect(glyph).resolves.toBe(7);
    vi.stubGlobal("nethackGlobal", { nh3dSynchronousGlyphCallbacks: 1 });
    expect(callback("shim_nhgetch")).toBeInstanceOf(Promise);
    expect(handle).toHaveBeenCalledWith("shim_print_glyph", [1, 2]);
  });

  it("returns copied glyph results synchronously only for capable artifacts", () => {
    vi.stubGlobal("nethackGlobal", { nh3dSynchronousGlyphCallbacks: 1 });
    const callback = createNethackCallbackDispatcher(() => 0);
    expect(callback("shim_print_glyph", 1, 2, 3)).toBe(0);
  });

  it("retains Promise identity and converts thrown callbacks into rejection", async () => {
    vi.stubGlobal("nethackGlobal", { nh3dSynchronousGlyphCallbacks: 1 });
    const pending = Promise.resolve(4);
    expect(createNethackCallbackDispatcher(() => pending)("shim_print_glyph")).toBe(pending);
    const failure = createNethackCallbackDispatcher(() => { throw new Error("decode failed"); })("shim_print_glyph");
    await expect(failure).rejects.toThrow("decode failed");
  });
});
