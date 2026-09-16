/** Deduplicate derived visual work while a synchronous group of tiles changes. */
export class TileNeighborBatch {
  private depth = 0;
  private readonly dirty = new Map<string, { x: number; y: number }>();

  constructor(private readonly apply: (x: number, y: number) => void) {}

  get active(): boolean { return this.depth > 0; }

  begin(): void { this.depth++; }

  update(x: number, y: number): void {
    if (!this.active) { this.apply(x, y); return; }
    const key = `${x},${y}`;
    if (!this.dirty.has(key)) this.dirty.set(key, { x, y });
  }

  flush(): void {
    const depth = this.depth;
    this.depth = 0;
    const cells = Array.from(this.dirty.values());
    this.dirty.clear();
    try { for (const cell of cells) this.apply(cell.x, cell.y); }
    finally { this.depth = depth; }
  }

  end(): void {
    if (this.depth === 0) return;
    if (--this.depth === 0) this.flush();
  }
}
