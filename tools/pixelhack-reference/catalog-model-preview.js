import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const clipOrder = ['Walk', 'Idle', 'Attack', 'Idle'];

function disposeModel(model) {
  const textures = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const material of [object.material].flat()) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}

export class ModelPreview {
  constructor(container, label) {
    this.container = container;
    this.label = label;
    this.disposed = false;
    this.visible = true;
    this.frameId = null;
    this.lastFrame = 0;
  }

  async load(entry) {
    const gltf = await new GLTFLoader().loadAsync(`/${entry.directory}/model.glb`);
    if (this.disposed) {
      disposeModel(gltf.scene);
      return;
    }
    this.model = gltf.scene;
    this.model.traverse((object) => {
      if (object.isMesh) object.frustumCulled = false;
    });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x283638);
    scene.add(new THREE.HemisphereLight(0xeaf1f7, 0x707b76, 1.9));
    for (const [position, intensity] of [[[2, 4, 3], 2.5], [[-3, 2, 1], 1.1], [[1, 3, -4], 1.7]]) {
      const light = new THREE.DirectionalLight(0xffffff, intensity);
      light.position.set(...position);
      scene.add(light);
    }
    scene.add(this.model);
    this.scene = scene;

    // Keep one camera through the full sting, including the first moving frame and impact.
    const points = [];
    const bounds = new THREE.Box3();
    const point = new THREE.Vector3();
    const capture = () => {
      this.model.updateMatrixWorld(true);
      this.model.traverse((object) => {
        if (!object.isMesh) return;
        if (object.isSkinnedMesh) object.skeleton.update();
        const count = object.geometry.attributes.position.count;
        for (let i = 0; i < count; i += 1) {
          if (object.isSkinnedMesh) object.getVertexPosition(i, point);
          else point.fromBufferAttribute(object.geometry.attributes.position, i);
          const worldPoint = point.clone().applyMatrix4(object.matrixWorld);
          bounds.expandByPoint(worldPoint);
          points.push(worldPoint);
        }
      });
    };
    capture();
    const attack = gltf.animations.find((clip) => clip.name === 'Attack');
    if (attack) {
      const framingMixer = new THREE.AnimationMixer(this.model);
      const action = framingMixer.clipAction(attack).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      for (const time of [0, 1 / 30, entry.animations?.Attack?.hitTime ?? attack.duration * .25,
        attack.duration * .5, attack.duration]) {
        framingMixer.setTime(time);
        capture();
      }
      framingMixer.stopAllAction();
      framingMixer.uncacheRoot(this.model);
      this.model.traverse((object) => { if (object.isSkinnedMesh) object.skeleton.pose(); });
      this.model.updateMatrixWorld(true);
    }

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 30);
    const center = bounds.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(...(entry.viewer?.heroView ?? [4, 3.1, 5])).normalize();
    camera.position.copy(center).addScaledVector(direction, 3);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const projected = new THREE.Box3();
    for (const vertex of points) projected.expandByPoint(vertex.clone().applyMatrix4(camera.matrixWorldInverse));
    const offset = projected.getCenter(new THREE.Vector3());
    offset.z = 0;
    const worldOffset = offset.applyQuaternion(camera.quaternion);
    camera.position.add(worldOffset);
    this.projectedWidth = projected.max.x - projected.min.x;
    this.projectedHeight = projected.max.y - projected.min.y;
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = 'model-canvas';
    this.container.prepend(renderer.domElement);
    this.renderer = renderer;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center).add(worldOffset);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.minZoom = .5;
    controls.maxZoom = 5;
    controls.update();
    this.controls = controls;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.intersectionObserver = new IntersectionObserver(([observation]) => {
      this.visible = observation.isIntersecting;
    });
    this.intersectionObserver.observe(this.container);
    this.resize();

    this.clips = clipOrder.map((name) => gltf.animations.find((clip) => clip.name === name)).filter(Boolean);
    if (!this.clips.length) this.clips = gltf.animations;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clipIndex = 0;
    if (this.clips.length) this.playClip();
    else {
      this.label.textContent = '3D model';
      this.label.hidden = false;
    }
    this.frameId = requestAnimationFrame((time) => this.render(time));
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    const vertical = Math.max(this.projectedHeight, this.projectedWidth * height / width) * 1.24;
    this.camera.left = -vertical * width / height / 2;
    this.camera.right = -this.camera.left;
    this.camera.top = vertical / 2;
    this.camera.bottom = -this.camera.top;
    this.camera.updateProjectionMatrix();
  }

  playClip() {
    this.mixer.stopAllAction();
    const clip = this.clips[this.clipIndex];
    const action = this.mixer.clipAction(clip).reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    this.mixer.update(0);
    this.clipElapsed = 0;
    this.label.textContent = clip.name;
    this.label.hidden = false;
  }

  render(time) {
    if (this.disposed) return;
    const delta = this.lastFrame ? Math.min((time - this.lastFrame) / 1000, .05) : 0;
    this.lastFrame = time;
    if (this.visible && !document.hidden) {
      if (this.clips.length) {
        this.mixer.update(delta);
        this.clipElapsed += delta;
        if (this.clipElapsed >= this.clips[this.clipIndex].duration) {
          this.clipIndex = (this.clipIndex + 1) % this.clips.length;
          this.playClip();
        }
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
    this.frameId = requestAnimationFrame((nextTime) => this.render(nextTime));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.mixer?.stopAllAction();
    this.controls?.dispose();
    if (this.model) disposeModel(this.model);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.label.hidden = true;
  }
}
