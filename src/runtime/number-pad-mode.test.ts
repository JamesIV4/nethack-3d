import { describe, expect, it } from "vitest";

import {
  extractRuntimeNumberPadModeEnabled,
  normalizeNumberPadModeValue,
} from "./number-pad-mode";

describe("number pad runtime state", () => {
  it.each([
    [0, false],
    [-1, false],
    [1, true],
    [2, true],
    ["off", false],
    ["on", true],
  ] as const)("normalizes %s", (rawValue, expected) => {
    expect(normalizeNumberPadModeValue(rawValue)).toBe(expected);
  });

  it("reads the restored iflags value before configured startup options", () => {
    expect(
      extractRuntimeNumberPadModeEnabled({
        configuredNethackOptions: "number_pad:1",
        nethackGlobal: { globals: { iflags: { num_pad: 0 } } },
      }),
    ).toBe(false);
  });

  it("supports the nested globals layout used by newer runtimes", () => {
    expect(
      extractRuntimeNumberPadModeEnabled({
        nethackGlobal: { globals: { g: { iflags: { num_pad: 1 } } } },
      }),
    ).toBe(true);
  });
});
