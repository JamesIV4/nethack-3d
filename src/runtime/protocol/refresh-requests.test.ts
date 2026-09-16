import { describe, expect, it, vi } from "vitest";
import { normalizeRefreshCells, RuntimeRefreshRequests } from "./refresh-requests";
import type { RuntimeObservationScope } from "./types";

const initialScope = (): RuntimeObservationScope => ({
  presentationGeneration: 1,
  levelGeneration: 2,
  level: { dnum: 0, dlevel: 3 },
});

describe("identified refresh sets", () => {
  it("combines overlapping obligations without dropping an explicit under-player query", () => {
    let querySafe = false;
    const scope = initialScope(), query = vi.fn(() => querySafe ? "fresh" as const : "cached" as const);
    const requests = new RuntimeRefreshRequests({ scope: () => scope, canQuery: () => querySafe, query, emit: () => {} });
    requests.request(1, [{ x: 4, y: 5 }], scope, false);
    requests.request(2, [{ x: 4, y: 5 }], scope, true);
    query.mockClear(); querySafe = true; requests.flush();
    expect(query).toHaveBeenCalledExactlyOnceWith({ x: 4, y: 5 }, true);
  });
  it("normalizes cells and keeps unknown distinct from known empty", () => {
    expect(normalizeRefreshCells([
      { x: 1, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 2 }, { x: 1.5, y: 2 }, { x: 255, y: 255 },
    ])).toEqual([{ x: 1, y: 2 }, { x: 255, y: 255 }]);
  });

  it("reports cached presentation, then deduplicates overlapping fresh queries", () => {
    let querySafe = false;
    const scope = initialScope();
    const query = vi.fn(cell => querySafe ? "fresh" as const : cell.x === 1 ? "cached" as const : "unavailable" as const);
    const events: any[] = [];
    const requests = new RuntimeRefreshRequests({
      scope: () => scope,
      canQuery: () => querySafe,
      query,
      emit: event => events.push(event),
    });
    requests.request(10, [{ x: 1, y: 1 }, { x: 2, y: 2 }], { ...scope, level: { ...scope.level! } });
    requests.request(11, [{ x: 2, y: 2 }, { x: 3, y: 3 }], { ...scope, level: { ...scope.level! } });
    expect(events[0]).toEqual(expect.objectContaining({
      requestId: 10,
      complete: false,
      cells: [{ x: 1, y: 1, status: "deferred", cached: true }, { x: 2, y: 2, status: "deferred", cached: false }],
    }));
    query.mockClear();
    querySafe = true;
    requests.flush();
    expect(query).toHaveBeenCalledTimes(3);
    expect(events.filter(event => event.complete)).toEqual([
      expect.objectContaining({ requestId: 10, cells: [expect.objectContaining({ status: "fresh" }), expect.objectContaining({ status: "fresh" })] }),
      expect.objectContaining({ requestId: 11, cells: [expect.objectContaining({ status: "fresh" }), expect.objectContaining({ status: "fresh" })] }),
    ]);
  });

  it("cancels stale-level work without querying it", () => {
    const scope = initialScope();
    const query = vi.fn(() => "fresh" as const), events: any[] = [];
    const requests = new RuntimeRefreshRequests({ scope: () => scope, canQuery: () => false, query, emit: event => events.push(event) });
    requests.request(1, [{ x: 1, y: 1 }], { ...scope, levelGeneration: 1 });
    expect(query).not.toHaveBeenCalled();
    expect(events).toEqual([expect.objectContaining({ requestId: 1, complete: true, cells: [{ x: 1, y: 1, status: "cancelled" }] })]);
  });
});
