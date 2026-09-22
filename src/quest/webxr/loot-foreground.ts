import * as THREE from "three";

export function isPlayerTileLoot(object: THREE.Object3D | undefined, player: { x: number; y: number } | null | undefined): boolean {
  return !!object && !!player && object.userData.entityType === "loot" &&
    object.userData.tileX === player.x && object.userData.tileY === player.y;
}

/** Alpha-only loot mask for the native hotbar, drawn against world depth before controllers. */
export class LootForeground {
  private readonly scene = new THREE.Scene();
  private readonly targets: Array<THREE.Sprite | THREE.Mesh> = [];
  private readonly materials = new Map<THREE.Material, { mask: THREE.Material; version: number }>();
  constructor() { this.scene.matrixAutoUpdate = false; }
  get active(): boolean { return this.targets.length > 0; }
  prepare(sprites: ReadonlyMap<string, THREE.Sprite>, enabled: boolean, player: { x: number; y: number } | null): void {
    this.targets.length = 0;
    if (!enabled) { this.dispose(); return; }
    for (const sprite of sprites.values()) {
      if (!isPlayerTileLoot(sprite, player)) continue;
      const proxy = sprite.userData.fpsPitchLockedProxyMesh as THREE.Mesh | undefined;
      const object = proxy?.visible ? proxy : sprite;
      if (object.visible && object.parent?.visible && !Array.isArray(object.material) && object.material.visible && object.material.opacity > 0) this.targets.push(object);
    }
    const used = new Set(this.targets.map(object => object.material));
    for (const [source, entry] of this.materials) if (!used.has(source)) { entry.mask.dispose(); this.materials.delete(source); }
  }
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, world: THREE.Scene): void {
    this.scene.matrix.copy(world.matrixWorld);
    this.scene.matrixWorldNeedsUpdate = true;
    const saved: Array<{ object: THREE.Sprite | THREE.Mesh; material: THREE.Material; parent: THREE.Object3D }> = [];
    try {
      for (const object of this.targets) {
        if (object.parent !== world || Array.isArray(object.material)) continue;
        const source = object.material;
        let entry = this.materials.get(source);
        if (!entry || entry.version !== source.version) {
          entry?.mask.dispose();
          const mask = source.clone();
          mask.transparent = true; mask.depthTest = true; mask.depthWrite = false;
          mask.blending = THREE.CustomBlending;
          mask.blendSrc = THREE.ZeroFactor; mask.blendDst = THREE.OneFactor;
          mask.blendSrcAlpha = THREE.OneFactor; mask.blendDstAlpha = THREE.ZeroFactor;
          mask.onBeforeCompile = (shader, gl) => {
            source.onBeforeCompile(shader, gl);
            shader.fragmentShader = shader.fragmentShader.replace("#include <tonemapping_fragment>", "gl_FragColor.a = 0.75;\n#include <tonemapping_fragment>");
          };
          mask.customProgramCacheKey = () => source.customProgramCacheKey() + "|loot-foreground";
          entry = { mask, version: source.version }; this.materials.set(source, entry);
        }
        entry.mask.opacity = source.opacity;
        entry.mask.alphaTest = Math.max(source.alphaTest, 1 / 255);
        saved.push({ object, material: source, parent: world });
        object.material = entry.mask as THREE.SpriteMaterial;
        this.scene.add(object);
      }
      renderer.render(this.scene, camera);
    } finally {
      for (const { object, material, parent } of saved) { object.material = material as THREE.SpriteMaterial; parent.add(object); }
    }
  }
  dispose(): void { for (const { mask } of this.materials.values()) mask.dispose(); this.materials.clear(); this.targets.length = 0; }
}
