import { expect, it } from "vitest";
import { RuntimeProtocolSession } from "./session";
import type { RuntimeEvent } from "../types";

it("preserves observations following a prompt while publishing its wait identity", async () => {
  const events: RuntimeEvent[] = [], session = new RuntimeProtocolSession(true, event => events.push(event), () => null);
  let resolve!: (value: number) => void;
  const pending = new Promise<number>(done => { resolve = done; });
  const result = session.invokeCallback("shim_display_nhwindow", () => {
    session.publish({ type: "info_menu", lines: ["A remembered message"] });
    session.publish({ type: "text", text: "Follow-up observation" });
    return pending;
  });
  expect(result).toBe(pending);
  expect(events.map(event => event.type)).toEqual(["input_wait", "info_menu", "text"]);
  expect(events[1].inputRequestId).toBe(events[0].requestId);
  expect(events[2].inputRequestId).toBeUndefined();
  resolve(27); await pending; await Promise.resolve();
});

it("preserves synchronous notification order without creating an input wait", () => {
  const events: RuntimeEvent[] = [], session = new RuntimeProtocolSession(true, event => events.push(event), () => null);
  expect(session.invokeCallback("shim_display_nhwindow", () => {
    session.publish({ type: "info_menu", lines: [] });
    session.publish({ type: "text", text: "Later" });
    return 0;
  })).toBe(0);
  expect(events).toEqual([{ type: "info_menu", lines: [] }, { type: "text", text: "Later" }]);
});
