import { afterEach, expect, it, vi } from "vitest";
import { requestGameQuit } from "./platform";

afterEach(() => vi.unstubAllGlobals());

it("exits the VR APK through the native host without closing its page", async () => {
  const close = vi.fn(), fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("location", { origin: "http://127.0.0.1:18973", search: "?xrHost=native" });
  vi.stubGlobal("window", { close }); vi.stubGlobal("fetch", fetch);
  await requestGameQuit();
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/__xr/quit", { method: "POST", headers: { "Content-Type": "application/json" }, body: "[]" });
  expect(close).not.toHaveBeenCalled();
});

it("keeps the VR page open if its native quit request fails", async () => {
  const close = vi.fn();
  vi.stubGlobal("location", { origin: "http://127.0.0.1:18973" });
  vi.stubGlobal("window", { close }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(requestGameQuit()).rejects.toThrow("VR host");
  expect(close).not.toHaveBeenCalled();
});

it.each(["http://localhost:5173", "https://example.com"])("keeps browser quit behavior on %s even with a native query flag", async origin => {
  const close = vi.fn(), fetch = vi.fn();
  vi.stubGlobal("location", { origin, search: "?xrHost=native" });
  vi.stubGlobal("window", { close }); vi.stubGlobal("fetch", fetch);
  await requestGameQuit();
  expect(close).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});

it.each(["nh3dElectron", "nh3dAndroid"])("preserves the existing %s exit bridge", async name => {
  const close = vi.fn(), quitGame = vi.fn();
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("window", { close, [name]: { quitGame } });
  await requestGameQuit();
  expect(quitGame).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
});
