import { describe, expect, it, vi } from "vitest";
import { RuntimeProtocolSession } from "./session";

describe("identified runtime input waits", () => {
  it("buffers a prompt until its Promise is known and reports command/token consumption", async () => {
    const events: any[] = [];
    const session = new RuntimeProtocolSession(true, event => events.push(event));
    let resolve!: (value: number) => void;
    const pending = new Promise<number>(done => { resolve = done; });
    expect(session.invokeCallback("shim_yn_function", () => {
      session.publish({ type: "question", text: "Really?" });
      return pending;
    })).toBe(pending);
    expect(events).toEqual([
      expect.objectContaining({ type: "input_wait", requestId: 1, state: "waiting" }),
      { type: "question", text: "Really?", inputRequestId: 1 },
    ]);

    let token: any;
    expect(session.dispatchCommand({ sessionId: "s", commandId: 7, lastProcessedSequence: 2, requestId: 1 }, () => {
      token = session.tagToken({ key: "y", source: "user", createdAt: 1 });
      session.consumed(token, ["shim_yn_function"]);
    })).toBe(true);
    expect(token).toEqual(expect.objectContaining({ commandId: 7, tokenIndex: 0 }));
    resolve(121);
    await pending;
    await Promise.resolve();
    expect(events).toContainEqual(expect.objectContaining({ type: "input_consumed", commandId: 7, requestId: 1 }));
    expect(events[events.length - 1]).toEqual(expect.objectContaining({ type: "input_wait", requestId: 1, state: "consumed" }));
  });

  it("does not invent a wait ID for synchronous notices and shares reused Promises", () => {
    const events: any[] = [];
    const session = new RuntimeProtocolSession(true, event => events.push(event));
    session.invokeCallback("shim_display_nhwindow", () => {
      session.publish({ type: "info_menu", title: "Nonblocking" });
      return 0;
    });
    expect(events).toEqual([{ type: "info_menu", title: "Nonblocking" }]);

    const pending = new Promise(() => {});
    session.invokeCallback("shim_nhgetch", () => pending);
    session.invokeCallback("shim_nhgetch", () => pending);
    expect(events.filter(event => event.type === "input_wait")).toHaveLength(1);
  });

  it("rejects closed targeted waits and cancels the matching owner only", () => {
    const events: any[] = [];
    const session = new RuntimeProtocolSession(true, event => events.push(event));
    const position = new Promise(() => {});
    session.invokeCallback("shim_nh_poskey", () => position);
    session.cancelWait(["shim_nhgetch"]);
    expect(events.filter(event => event.state === "cancelled")).toHaveLength(0);
    session.cancelWait(["shim_nh_poskey"]);
    expect(events[events.length - 1]).toEqual(expect.objectContaining({ state: "cancelled", requestId: 1 }));
    const dispatch = vi.fn();
    expect(session.dispatchCommand({ sessionId: "s", commandId: 2, lastProcessedSequence: 0, requestId: 1 }, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("tracks level and presentation generations from exported values", () => {
    const session = new RuntimeProtocolSession(true, () => {});
    (globalThis as any).nethackGlobal = { globals: { u: { uz: { dnum: 0, dlevel: 1 } } } };
    session.publish({ type: "map_glyph" });
    expect(session.scope).toEqual({ presentationGeneration: 0, levelGeneration: 1, level: { dnum: 0, dlevel: 1 } });
    session.publish({ type: "clear_scene" });
    expect(session.scope.presentationGeneration).toBe(1);
    (globalThis as any).nethackGlobal.globals.u.uz.dlevel = 2;
    session.publish({ type: "player_position" });
    expect(session.scope).toEqual({ presentationGeneration: 1, levelGeneration: 2, level: { dnum: 0, dlevel: 2 } });
    delete (globalThis as any).nethackGlobal;
  });

  it("does not reread stable level globals for every glyph in a display burst", () => {
    const readLevel = vi.fn(() => ({ dnum: 0, dlevel: 1 }));
    const session = new RuntimeProtocolSession(true, () => {}, readLevel);
    session.publish({ type: "clear_scene" });
    session.publish({ type: "map_glyph", x: 1, y: 1 });
    for (let i = 0; i < 1000; i++) session.publish({ type: "map_glyph", x: i % 80, y: 2 });
    expect(readLevel).toHaveBeenCalledTimes(2);
  });
});
