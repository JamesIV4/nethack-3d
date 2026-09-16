import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "https:" } });
});

import { resolveInitialClientOptionsFromPersisted } from "./defaults";

afterEach(() => vi.unstubAllGlobals());

it("uses a 200 percent minimap only for a fresh Quest host and preserves a saved choice", () => {
  vi.stubGlobal("location", { search: "?xrHost=native", origin: "http://127.0.0.1:18973" });
  expect(resolveInitialClientOptionsFromPersisted(null).minimapScale).toBe(2);
  expect(resolveInitialClientOptionsFromPersisted({ minimapScale: 1.25 }).minimapScale).toBe(1.25);
  vi.stubGlobal("location", { search: "", origin: "https://example.test" });
  expect(resolveInitialClientOptionsFromPersisted(null).minimapScale).toBe(1);
});
