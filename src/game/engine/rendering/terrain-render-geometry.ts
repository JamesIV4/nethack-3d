import * as THREE from "three";

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const revision = (attribute: Attribute | null | undefined): number | undefined =>
  attribute ? "version" in attribute ? attribute.version : attribute.data.version : undefined;

/** Render-only wall geometry; the tile keeps its complete geometry for picking. */
export class TerrainRenderGeometry {
  private readonly cache = new Map<THREE.BufferGeometry, {
    signature: string; geometry: THREE.BufferGeometry; release: () => void;
    position: Attribute; normal: Attribute; index: THREE.BufferAttribute | null; uv: Attribute | undefined;
    variants: Map<string, THREE.BufferGeometry>;
  }>();
  private readonly materialArrays = new WeakMap<THREE.Material[], {
    base: THREE.BufferGeometry; materials: THREE.Material[]; mergeable: boolean[]; geometry: THREE.BufferGeometry;
  }>();

  withoutBottom(source: THREE.BufferGeometry, materials?: THREE.Material | THREE.Material[]): THREE.BufferGeometry {
    const position = source.getAttribute("position"), normal = source.getAttribute("normal");
    if (!position || !normal || source.drawRange.start !== 0 || source.drawRange.count !== Infinity) return source;
    const index = source.index, uv = source.getAttribute("uv");
    const signature = [revision(position), revision(normal), revision(index), revision(uv), position.count, index?.count].join(":");
    const cached = this.cache.get(source);
    if (cached?.signature === signature && cached.position === position && cached.normal === normal &&
      cached.index === index && cached.uv === uv) return this.mergeGroups(cached, materials);
    if (cached) this.release(source);
    const count = index?.count ?? position.count;
    const kept: number[] = [], offsets = new Uint32Array(count + 1);
    for (let i = 0; i < count; i += 3) {
      const a = index?.getX(i) ?? i, b = index?.getX(i + 1) ?? i + 1, c = index?.getX(i + 2) ?? i + 2;
      const bottom = normal.getZ(a) < -0.9 && normal.getZ(b) < -0.9 && normal.getZ(c) < -0.9;
      for (let j = 0; j < 3; j++) offsets[i + j] = kept.length;
      if (!bottom) kept.push(a, b, c);
      offsets[i + 3] = kept.length;
    }
    const geometry = source.clone();
    geometry.setIndex(kept);
    geometry.clearGroups();
    for (const group of source.groups) {
      const start = offsets[group.start], end = offsets[Math.min(count, group.start + group.count)];
      if (end > start) geometry.addGroup(start, end - start, group.materialIndex);
    }
    const release = () => this.release(source);
    source.addEventListener("dispose", release);
    const entry = { signature, geometry, release, position, normal, index, uv, variants: new Map<string, THREE.BufferGeometry>() };
    this.cache.set(source, entry);
    return this.mergeGroups(entry, materials);
  }

  private canMerge(material: THREE.Material | undefined): boolean {
    // Two-pass transparent materials draw back then front for EACH group.
    // Combining their groups would change that order.
    return !!material && !(material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass);
  }

  private mergeGroups(entry: { geometry: THREE.BufferGeometry; variants: Map<string, THREE.BufferGeometry> }, materials?: THREE.Material | THREE.Material[]): THREE.BufferGeometry {
    if (!Array.isArray(materials)) return entry.geometry;
    const cached = this.materialArrays.get(materials);
    if (cached?.base === entry.geometry && cached.materials.length === materials.length &&
      materials.every((material, i) => material === cached.materials[i] && this.canMerge(material) === cached.mergeable[i])) return cached.geometry;
    const groups: THREE.BufferGeometry["groups"] = [];
    for (const group of entry.geometry.groups) {
      const previous = groups[groups.length - 1], material = materials[group.materialIndex ?? 0];
      if (previous && previous.start + previous.count === group.start && material &&
        materials[previous.materialIndex ?? 0] === material && this.canMerge(material)) previous.count += group.count;
      else groups.push({ ...group });
    }
    let geometry = entry.geometry;
    if (groups.length < geometry.groups.length) {
      const key = groups.map(group => `${group.start},${group.count},${group.materialIndex}`).join("|");
      geometry = entry.variants.get(key) ?? entry.geometry.clone();
      if (!entry.variants.has(key)) { geometry.groups = groups; entry.variants.set(key, geometry); }
    }
    this.materialArrays.set(materials, { base: entry.geometry, materials: materials.slice(), mergeable: materials.map(m => this.canMerge(m)), geometry });
    return geometry;
  }

  private release(source: THREE.BufferGeometry): void {
    const entry = this.cache.get(source);
    if (!entry) return;
    source.removeEventListener("dispose", entry.release);
    for (const variant of entry.variants.values()) variant.dispose();
    entry.geometry.dispose();
    this.cache.delete(source);
  }

  dispose(): void {
    for (const source of this.cache.keys()) this.release(source);
  }
}
