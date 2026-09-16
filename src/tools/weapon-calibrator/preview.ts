import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createControllerLaser } from '../../quest/webxr/controller-laser';
import { createWeaponVoxelMesh } from '../../quest/webxr/weapon-voxels';
import { weaponLocalMatrix, type WeaponPose } from '../../quest/webxr/weapon-pose';
import { pickWeaponAttachment } from './picking';

export class WeaponPreview {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, .001, 30);
  private controls: OrbitControls;
  private mesh: THREE.InstancedMesh | null = null;
  private pixelSize = 1;
  private spriteCenter = new THREE.Mesh(new THREE.SphereGeometry(.005, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffcc66, depthTest: false }));
  onPickAttachment: ((point: { x: number; y: number; z: number }) => void) | null = null;
  private resize: ResizeObserver;
  constructor(private container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x101824);
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', this.render);
    this.renderer.domElement.addEventListener('dblclick', this.pickAttachment);
    const laser = createControllerLaser();
    laser.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.5)]);
    const origin = new THREE.Mesh(new THREE.SphereGeometry(.009, 16, 12), new THREE.MeshBasicMaterial({ color: 0x78d5ff, depthTest: false }));
    origin.renderOrder = 20001;
    this.spriteCenter.renderOrder = 20000;
    const axes = new THREE.AxesHelper(.16);
    const grid = new THREE.GridHelper(3, 30, 0x41546b, 0x243247);
    grid.position.y = -.45;
    this.scene.add(laser, origin, axes, grid, this.spriteCenter);
    this.resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      this.renderer.setSize(width, height);
      this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); this.render();
    });
    this.resize.observe(container);
    this.view('perspective');
  }
  private render = (): void => { this.renderer.render(this.scene, this.camera); };
  setSprite(texture: THREE.Texture): { pixelWidth: number; pixelHeight: number } {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
    const voxel = createWeaponVoxelMesh(texture);
    this.mesh = voxel.mesh;
    this.pixelSize = voxel.pixelSize;
    this.mesh.matrixAutoUpdate = false; this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    return { pixelWidth: voxel.aspect / voxel.pixelSize, pixelHeight: 1 / voxel.pixelSize };
  }
  setPose(pose: WeaponPose): void {
    if (!this.mesh) return;
    this.mesh.matrix.copy(weaponLocalMatrix(pose, this.pixelSize));
    this.mesh.matrixWorldNeedsUpdate = true;
    this.spriteCenter.position.setFromMatrixPosition(this.mesh.matrix);
    this.render();
  }
  private pickAttachment = (event: MouseEvent): void => {
    if (!this.mesh || !this.onPickAttachment) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const point = pickWeaponAttachment(this.mesh, this.pixelSize, ray);
    if (point) this.onPickAttachment(point);
  };
  view(view: string): void {
    this.controls.target.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    if (view === 'front') this.camera.position.set(0, 0, 1.6);
    else if (view === 'side') this.camera.position.set(1.6, 0, 0);
    else if (view === 'top') { this.camera.position.set(0, 1.6, 0); this.camera.up.set(0, 0, -1); }
    else this.camera.position.set(1.1, .7, 1);
    this.controls.update(); this.render();
  }
  dispose(): void {
    this.resize.disconnect(); this.controls.dispose();
    this.renderer.domElement.removeEventListener('dblclick', this.pickAttachment);
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
