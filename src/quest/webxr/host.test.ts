import { afterEach, expect, it, vi } from "vitest";
import { isQuestApk } from "./host";
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["http://127.0.0.1:18973", "?xrHost=native", true],
  ["http://127.0.0.1:5175", "?xrHost=wired", false],
  ["https://nethack.example", "?xrHost=native", false],
  ["http://localhost:5173", "", false],
])("limits APK options at %s", (origin, search, expected) => {
  vi.stubGlobal("location", { origin, search });
  expect(isQuestApk()).toBe(expected);
});
