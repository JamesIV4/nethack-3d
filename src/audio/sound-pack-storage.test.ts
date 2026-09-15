import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

// Keep records across module reloads, as IndexedDB does across app launches.
// This storage double exercises the public storage API and its ZIP import path;
// it does not model browser transaction scheduling or rollback.
function installPersistentDatabase() {
  const stores = new Map<string, Map<string, unknown>>();
  const keyPaths = new Map<string, string>();
  const request = (result: unknown) => {
    const pending = { result, onsuccess: null as null | (() => void) };
    queueMicrotask(() => pending.onsuccess?.());
    return pending;
  };
  const database = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore(name: string, options: { keyPath: string }) {
      stores.set(name, new Map());
      keyPaths.set(name, options.keyPath);
    },
    close() {},
    transaction() {
      return {
        set oncomplete(callback: () => void) { queueMicrotask(callback); },
        objectStore(name: string) {
          const store = stores.get(name)!;
          return {
            get: (key: string) => request(structuredClone(store.get(key))),
            getAll: () => request(structuredClone([...store.values()])),
            put(value: Record<string, unknown>) {
              const key = String(value[keyPaths.get(name)!]);
              store.set(key, structuredClone(value));
              return request(key);
            },
            delete(key: string) { store.delete(key); return request(undefined); },
          };
        },
      };
    },
  };
  vi.stubGlobal("indexedDB", {
    open() {
      const pending = {
        result: database,
        onupgradeneeded: null as null | (() => void),
        onsuccess: null as null | (() => void),
      };
      queueMicrotask(() => {
        pending.onupgradeneeded?.();
        pending.onsuccess?.();
      });
      return pending;
    },
  });
}

function packArchive(name: string, volume = 0.25): Blob {
  const bytes = zipSync({
    "manifest.json": strToU8(JSON.stringify({
      schema: "nh3d-soundpack",
      version: 2,
      pack: { name, sounds: [{ key: "player-walk", volume, enabled: true }] },
    })),
  });
  return new Blob([new Uint8Array(bytes)], { type: "application/zip" });
}

beforeEach(() => {
  vi.resetModules();
  installPersistentDatabase();
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    blob: async () => packArchive("Default"),
  })));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("sound pack selection across app restarts", () => {
  it("keeps the selected custom pack while refreshing the bundled default on reload", async () => {
    const firstLaunch = await import("./sound-pack-storage");
    await firstLaunch.loadNh3dSoundPackStateFromIndexedDb();
    const custom = await firstLaunch.createNh3dSoundPack("My sounds");
    await firstLaunch.setActiveNh3dSoundPackId(firstLaunch.nh3dDefaultSoundPackId);
    await firstLaunch.setActiveNh3dSoundPackId(custom.id);

    vi.mocked(fetch).mockResolvedValue({
      ok: true, blob: async () => packArchive("Updated Default", 0.75),
    } as Response);
    vi.resetModules();
    const nextLaunch = await import("./sound-pack-storage");
    const state = await nextLaunch.loadNh3dSoundPackStateFromIndexedDb();
    expect(state.activePackId).toBe(custom.id);
    expect(state.packs.find(pack => pack.id === custom.id)).toEqual(custom);
    expect(state.packs.find(pack => pack.isDefault)?.sounds["player-walk"].volume).toBe(0.75);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("selects the default for first launch and when the selected pack was deleted", async () => {
    const storage = await import("./sound-pack-storage");
    expect((await storage.loadNh3dSoundPackStateFromIndexedDb()).activePackId)
      .toBe(storage.nh3dDefaultSoundPackId);
    const custom = await storage.createNh3dSoundPack("Temporary sounds");
    await storage.deleteNh3dSoundPackFromIndexedDb(custom.id);
    vi.resetModules();
    const nextLaunch = await import("./sound-pack-storage");
    expect((await nextLaunch.loadNh3dSoundPackStateFromIndexedDb()).activePackId)
      .toBe(nextLaunch.nh3dDefaultSoundPackId);
  });

  it("still activates an explicitly imported custom pack", async () => {
    const storage = await import("./sound-pack-storage");
    await storage.loadNh3dSoundPackStateFromIndexedDb();
    const imported = await storage.importNh3dSoundPackFromZip(packArchive("Imported sounds"));
    expect((await storage.loadNh3dSoundPackStateFromIndexedDb()).activePackId).toBe(imported.id);
  });
});
