import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "https:" } });
});

import { resolveInitialClientOptionsFromPersisted } from "./defaults";
import { clientOptionsTabs, resolveClientOptionsDefaultTabId } from "./config";

afterEach(() => vi.unstubAllGlobals());

it("defaults flattening off while respecting an explicit saved choice", () => {
  expect(resolveInitialClientOptionsFromPersisted(null).fpsFlattenEntityBillboards).toBe(false);
  expect(resolveInitialClientOptionsFromPersisted({fpsFlattenEntityBillboards:true}).fpsFlattenEntityBillboards).toBe(true);
});

it("lists VR first and opens it by default only in the Quest APK", () => {
  expect(clientOptionsTabs[0].id).toBe("vr");
  vi.stubGlobal("location",new URL("http://127.0.0.1:18973/"));
  expect(resolveClientOptionsDefaultTabId()).toBe("vr");
  vi.stubGlobal("location",new URL("http://localhost/?xrHost=wired"));
  expect(resolveClientOptionsDefaultTabId()).toBe("display");
});

it("uses a 100 percent minimap only for a fresh Quest host and preserves a saved choice", () => {
  vi.stubGlobal("location", { search: "?xrHost=native", origin: "http://127.0.0.1:18973" });
  expect(resolveInitialClientOptionsFromPersisted(null).minimapScale).toBe(1);
  expect(resolveInitialClientOptionsFromPersisted({ minimapScale: 1.25 }).minimapScale).toBe(1.25);
  vi.stubGlobal("location", { search: "", origin: "https://example.test" });
  expect(resolveInitialClientOptionsFromPersisted(null).minimapScale).toBe(1);
});
