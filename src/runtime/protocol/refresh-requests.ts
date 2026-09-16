import type { RuntimeCell, RuntimeObservationScope, RuntimeRefreshCellResult, RuntimeRefreshResult, RuntimeRefreshStatus } from "./types";

export function sameObservationScope(a: RuntimeObservationScope, b: RuntimeObservationScope): boolean {
  return Boolean(a && b) && a.presentationGeneration === b.presentationGeneration && a.levelGeneration === b.levelGeneration &&
    a.level?.dnum === b.level?.dnum && a.level?.dlevel === b.level?.dlevel;
}
export function normalizeRefreshCells(cells: readonly RuntimeCell[]): RuntimeCell[] {
  const unique = new Map<string, RuntimeCell>();
  for (const cell of (Array.isArray(cells) ? cells : []).slice(0, 4096)) {
    if (Number.isSafeInteger(cell?.x) && Number.isSafeInteger(cell?.y) && cell.x >= 0 && cell.y >= 0 && cell.x < 256 && cell.y < 256) {
      unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    }
  }
  return Array.from(unique.values());
}
interface Request { requestId: number; scope: RuntimeObservationScope; cells: RuntimeCell[]; includeUnderPlayer: boolean }

/** Deduplicates queries, retaining fresh-data obligations after cached presentation. */
export class RuntimeRefreshRequests {
  private readonly pending = new Map<number, Request>();

  constructor(private readonly dependencies: {
    scope(): RuntimeObservationScope;
    canQuery(): boolean;
    query(cell: RuntimeCell, includeUnderPlayer: boolean): RuntimeRefreshStatus;
    emit(result: RuntimeRefreshResult): void;
  }) {}

  get hasPending(): boolean { return this.pending.size > 0; }

  request(requestId: number, cells: readonly RuntimeCell[], scope: RuntimeObservationScope, includeUnderPlayer = false): void {
    const request = {
      requestId,
      includeUnderPlayer,
      cells: normalizeRefreshCells(cells),
      scope: scope ? {
        presentationGeneration: scope.presentationGeneration,
        levelGeneration: scope.levelGeneration,
        level: scope.level ? { ...scope.level } : null,
      } : scope,
    };
    if (this.pending.has(requestId)) return;
    if (request.cells.length === 0) { this.finish(request, "unavailable"); return; }
    if (!sameObservationScope(scope, this.dependencies.scope()) || this.pending.size >= 128) {
      this.finish(request, "cancelled"); return;
    }
    this.pending.set(requestId, request);
    if (this.dependencies.canQuery()) { this.flush(); return; }
    const results = request.cells.map(cell => {
      const status = this.dependencies.query(cell, includeUnderPlayer);
      return { ...cell, status: "deferred" as const, cached: status === "cached" };
    });
    if (this.pending.has(requestId)) this.dependencies.emit({ type: "refresh_result", requestId, complete: false, cells: results });
  }

  flush(): void {
    this.cancelObsolete();
    if (!this.dependencies.canQuery() || !this.pending.size) return;
    const queried = new Map<string, RuntimeRefreshCellResult>();
    const requests = Array.from(this.pending.values());
    this.pending.clear();
    const underPlayerQueries = new Set(requests.filter(request => request.includeUnderPlayer).flatMap(request => request.cells.map(cell => `${cell.x},${cell.y}`)));
    for (const request of requests) {
      const cells = request.cells.map(cell => {
        const key = `${cell.x},${cell.y}`;
        let result = queried.get(key);
        if (!result) {
          const status = this.dependencies.query(cell, underPlayerQueries.has(key));
          result = { ...cell, status: status === "cached" ? "unavailable" : status, ...(status === "cached" ? { cached: true } : {}) };
          queried.set(key, result);
        }
        return result;
      });
      if (!sameObservationScope(request.scope, this.dependencies.scope())) this.finish(request, "cancelled");
      else this.dependencies.emit({ type: "refresh_result", requestId: request.requestId, complete: true, cells });
    }
  }

  cancelObsolete(): void {
    const scope = this.dependencies.scope();
    for (const [id, request] of this.pending) {
      if (!sameObservationScope(request.scope, scope)) { this.pending.delete(id); this.finish(request, "cancelled"); }
    }
  }

  cancelAll(): void {
    const pending = Array.from(this.pending.values()); this.pending.clear();
    for (const request of pending) this.finish(request, "cancelled");
  }

  private finish(request: Request, status: RuntimeRefreshStatus): void {
    this.dependencies.emit({ type: "refresh_result", requestId: request.requestId, complete: true, cells: request.cells.map(cell => ({ ...cell, status })) });
  }
}
