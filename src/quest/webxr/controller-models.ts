import * as THREE from "three";
import { isQuestApk } from "./host";
import { GlbControllerModelLoader, type ControllerModelLoader, type LoadedController } from "./controller-model-loader";

type Hand = "left" | "right";
export interface ControllerModelDiagnostic {
  hand: Hand; source: "loading" | "fallback" | "runtime"; state: string; tracked: boolean;
  meshes: number; triangles: number; channels: number; error: string; tag: string;
}
type Entry = { group: THREE.Group; fadeStart: number | null; opacity: number; materials: { material: THREE.Material; opacity: number; transparent: boolean }[]; model: LoadedController | null; diagnostic: ControllerModelDiagnostic; loading: boolean; nextCheck: number; rejectedTag: string };

/** Runtime-provided GLBs, drawn in the same tracked space as the XR camera. */
export class ControllerModels {
  readonly diagnostics: ControllerModelDiagnostic[] = [];
  private readonly scene = new THREE.Scene();
  private readonly tracking = new THREE.Group();
  private readonly entries = new Map<XRInputSource, Entry>();
  private readonly lifetime = new AbortController();
  private disposed = false;
  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly loader: ControllerModelLoader = new GlbControllerModelLoader(renderer), private readonly native = isQuestApk()) {
    this.tracking.matrixAutoUpdate = false;
    this.scene.add(this.tracking);
  }
  private add(source: XRInputSource, hand: Hand): Entry {
    const group = new THREE.Group(); group.name = `Controller grip ${hand}`; group.matrixAutoUpdate = false;
    group.visible = false; this.tracking.add(group);
    const diagnostic: ControllerModelDiagnostic = { hand, source: "loading", state: "loading", tracked: false, meshes: 0, triangles: 0, channels: 0, error: "", tag: "" };
    const entry: Entry = { group, fadeStart: null, opacity: 0, materials: [], model: null, diagnostic, loading: false, nextCheck: 0, rejectedTag: "" };
    this.entries.set(source, entry); this.diagnostics.push(diagnostic); return entry;
  }
  update(frame: XRFrame, reference: XRReferenceSpace, sources: readonly XRInputSource[], now: number): void {
    if (this.disposed) return;
    const active = new Set(sources);
    for (const [source, entry] of this.entries) if (!active.has(source)) this.remove(source, entry);
    for (const source of sources) {
      if (source.hand || (source.handedness !== "left" && source.handedness !== "right") || !source.gripSpace) continue;
      const entry = this.entries.get(source) ?? this.add(source, source.handedness);
      const pose = frame.getPose(source.gripSpace, reference);
      entry.group.visible = !!pose && !!entry.model; entry.diagnostic.tracked = !!pose;
      if (!pose) { entry.opacity = 0; entry.fadeStart = null; continue; }
      if (entry.model) {
        entry.fadeStart ??= now;
        const t = THREE.MathUtils.clamp((now - entry.fadeStart) / 250, 0, 1);
        entry.opacity = t * t * (3 - 2 * t);
        for (const original of entry.materials) {
          const transparent = entry.opacity < 1 || original.transparent;
          if (original.material.transparent !== transparent) { original.material.transparent = transparent; original.material.needsUpdate = true; }
          original.material.opacity = original.opacity * entry.opacity;
        }
        entry.group.visible = entry.opacity > 0;
      }
      entry.group.matrix.fromArray(pose.transform.matrix); entry.group.matrixWorldNeedsUpdate = true;
      entry.model?.animation.update(source.gamepad);
      if (!entry.loading && now >= entry.nextCheck) {
        entry.nextCheck = now + 2000;
        void this.refresh(source, entry);
      }
    }
  }
  opacity(source: XRInputSource): number {
    if (source.hand || !source.gripSpace) return 1;
    return this.entries.get(source)?.opacity ?? 0;
  }
  private async refresh(source: XRInputSource, entry: Entry): Promise<void> {
    entry.loading = true;
    const signal = this.lifetime.signal, hand = entry.diagnostic.hand;
    const valid = () => !this.disposed && this.entries.get(source) === entry;
    const install = (model: LoadedController, kind: "runtime" | "fallback", tag: string) => {
      if (!valid()) { model.dispose(); return; }
      entry.model?.dispose(); entry.model = model; entry.group.add(model.scene);
      entry.materials = [];
      const seen = new Set<THREE.Material>();
      model.scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!seen.has(material)) {
          seen.add(material); entry.materials.push({ material, opacity: material.opacity, transparent: material.transparent });
          material.opacity *= entry.opacity;
          if (entry.opacity < 1) { material.transparent = true; material.needsUpdate = true; }
        }
      });
      entry.group.visible = entry.diagnostic.tracked && entry.opacity > 0;
      Object.assign(entry.diagnostic, { source: kind, state: "ready", tag, meshes: model.meshes, triangles: model.triangles, channels: model.animation.channels, error: "" });
    };
    try {
      if (this.native) {
        try {
        const url = `/__xr/controller-model/${hand}.glb`;
        const status = await fetch(url, { method: "HEAD", signal, cache: "no-store" });
        const tag = status.headers.get("ETag") ?? "";
        if (status.status === 200 && tag && tag !== entry.diagnostic.tag && tag !== entry.rejectedTag) {
          try {
            const response = await fetch(url, { signal, cache: "no-store" });
            if (response.status !== 200 || response.headers.get("ETag") !== tag) throw new Error("Runtime controller changed while loading");
            const bytes = await response.arrayBuffer();
            let model: LoadedController;
            try { model = await this.loader.load(bytes, hand, true, signal); }
            catch (error) { entry.rejectedTag = tag; throw error; }
            install(model, "runtime", tag);
          } catch (error) { if (!signal.aborted) { entry.diagnostic.error = String(error); } }
        } else if (status.status !== 200 && !entry.model) {
          entry.diagnostic.state = status.headers.get("X-NH3D-Model-State") ?? `host-${status.status}`;
        }
        } catch (error) { if (!signal.aborted) entry.diagnostic.error = String(error); }
      }
      if (!entry.model && valid()) {
        const response = await fetch(`/quest-controllers/meta-quest-touch-plus/${hand}.glb`, { signal });
        if (!response.ok) throw new Error("Controller fallback mesh is unavailable");
        const error = entry.diagnostic.error;
        install(await this.loader.load(await response.arrayBuffer(), hand, false, signal), "fallback", "fallback");
        entry.diagnostic.error = error;
      }
    } catch (error) { if (valid() && !signal.aborted) { entry.diagnostic.error = String(error); entry.diagnostic.state = "load-error"; } }
    finally { entry.loading = false; }
  }
  /** Draw after the world, with a fresh depth buffer so model parts self-occlude. */
  render(camera: THREE.Camera, trackingRoot: THREE.Object3D): void {
    if (this.disposed || !this.entries.size) return;
    trackingRoot.updateWorldMatrix(true, false);
    this.tracking.matrix.copy(trackingRoot.matrixWorld); this.tracking.matrixWorldNeedsUpdate = true;
    const autoClear = this.renderer.autoClear, clipping = this.renderer.clippingPlanes;
    try {
      this.renderer.autoClear = false; this.renderer.clippingPlanes = [];
      this.renderer.clearDepth(); this.renderer.render(this.scene, camera);
    } finally { this.renderer.autoClear = autoClear; this.renderer.clippingPlanes = clipping; }
  }
  private remove(source: XRInputSource, entry: Entry): void {
    entry.model?.dispose();
    entry.group.removeFromParent(); this.entries.delete(source);
    const index = this.diagnostics.indexOf(entry.diagnostic); if (index >= 0) this.diagnostics.splice(index, 1);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.lifetime.abort();
    for (const [source, entry] of this.entries) this.remove(source, entry);
    this.loader.dispose();
  }
}
