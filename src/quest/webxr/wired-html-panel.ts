import * as THREE from "three";

/** Wired development only. The standalone runtime composites its live page GPU surface directly. */
export class WiredHtmlPanel {
  private readonly canvas = Object.assign(document.createElement("canvas"), { width: 1600, height: 1000 });
  private readonly context = this.canvas.getContext("2d", { willReadFrequently: true })!;
  private readonly texture = new THREE.CanvasTexture(this.canvas);
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly ray = new THREE.Raycaster();
  private readonly transform = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3();
  private readonly headers: Record<string, string>;
  private pending = false;
  private lastCapture = -Infinity;
  private lastMove = -Infinity;
  private pressed: XRInputSource | null = null;
  private disposed = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: THREE.Group, private readonly renderer: THREE.WebGLRenderer) {
    const token = new URLSearchParams(location.hash.slice(1)).get("token");
    if (!token) throw new Error("Start the wired WebXR host to provide the live HTML pane.");
    this.headers = { Authorization: "Bearer " + token };
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    this.mesh.renderOrder = 10000;
    this.mesh.position.set(0, 1.6, -1.8);
    root.add(this.mesh);
  }

  recenter(position: THREE.Vector3, heading: THREE.Quaternion): void {
    this.mesh.position.set(0, 0, -1.8).applyQuaternion(heading).add(position);
    this.mesh.quaternion.copy(heading);
  }

  private hit(source: XRInputSource, frame: XRFrame): { x: number; y: number } | null {
    const reference = this.renderer.xr.getReferenceSpace();
    const pose = reference && frame.getPose(source.targetRaySpace, reference);
    if (!pose) return null;
    this.transform.fromArray(pose.transform.matrix).premultiply(this.root.matrixWorld);
    this.position.setFromMatrixPosition(this.transform);
    this.rotation.setFromRotationMatrix(this.transform.clone().extractRotation(this.transform));
    this.direction.set(0, 0, -1).applyQuaternion(this.rotation);
    this.ray.set(this.position, this.direction);
    this.mesh.updateWorldMatrix(true, false);
    const uv = this.ray.intersectObject(this.mesh, false)[0]?.uv;
    if (!uv) return null;
    const x = Math.min(1599, Math.max(0, Math.floor(uv.x * 1600)));
    const y = Math.min(999, Math.max(0, Math.floor((1 - uv.y) * 1000)));
    if (!this.pressed && this.context.getImageData(x, y, 1, 1).data[3] < 16) return null;
    return { x, y };
  }

  owns(source: XRInputSource, frame: XRFrame): boolean { return this.pressed === source || this.hit(source, frame) !== null; }
  selectStart(event: XRInputSourceEvent): boolean {
    const point = this.hit(event.inputSource, event.frame);
    if (!point || this.pressed) return false;
    this.pressed = event.inputSource;
    this.input({ type: "down", ...point });
    return true;
  }
  selectEnd(event: XRInputSourceEvent): void {
    if (this.pressed !== event.inputSource) return;
    const point = this.hit(event.inputSource, event.frame);
    this.pressed = null;
    if (point) this.input({ type: "up", ...point }); else this.release();
  }
  private input(value: Record<string, unknown>): void {
    this.queue = this.queue.catch(() => {}).then(() => fetch("/__xr/input", {
      method: "POST", headers: { ...this.headers, "Content-Type": "application/json" }, body: JSON.stringify(value),
    })).catch((error) => console.warn("Wired UI input failed", error));
  }
  private release(): void {
    this.queue = this.queue.catch(() => {}).then(() => fetch("/__xr/release", { method: "POST", headers: this.headers })).catch(() => {});
  }

  update(time: number): void {
    const frame = this.renderer.xr.getFrame();
    if (frame && this.pressed && time - this.lastMove >= 35) {
      this.lastMove = time;
      const point = this.hit(this.pressed, frame);
      if (point) this.input({ type: "move", ...point });
    }
    if (this.pending || this.disposed || time - this.lastCapture < 100) return;
    this.lastCapture = time; this.pending = true;
    void fetch("/__xr/frame", { headers: this.headers, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTML capture unavailable."); return response.blob(); })
      .then(createImageBitmap)
      .then((bitmap) => {
        if (!this.disposed) {
          this.context.clearRect(0, 0, 1600, 1000); this.context.drawImage(bitmap, 0, 0, 1600, 1000);
          this.texture.needsUpdate = true;
        }
        bitmap.close();
      })
      .catch((error) => console.warn("Wired HTML capture failed", error))
      .finally(() => { this.pending = false; });
  }

  dispose(): void {
    this.disposed = true; this.release(); this.pressed = null;
    this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
  }
}
