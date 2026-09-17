/** Deduplicate native system recenter notifications carried by UI bridge replies. */
export class SystemRecenter {
  private revision: number | null = null;
  accept(header: string | null): boolean {
    if (header === null || !/^\d+$/.test(header)) return false;
    const next = Number(header);
    if (!Number.isSafeInteger(next)) return false;
    const changed = this.revision !== null && next > this.revision;
    this.revision = next;
    return changed;
  }
}
