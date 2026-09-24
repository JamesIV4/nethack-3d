import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return response.json();
}

async function main() {
  const tileId = Number(new URLSearchParams(location.search).get('tile') ?? 0);
  const registry = await json('/tools/pixelhack-reference/models.json');
  const entry = registry.models.find((model) => model.tileIds.includes(tileId));
  if (!entry) throw new Error(`Tile ${tileId} has no model yet.`);
  const base = `/${entry.directory}`;
  $('title').textContent = entry.title;
  $('download-glb').href = `${base}/model.glb`;
  $('download-blend').href = `${base}/model.blend`;
  $('review-link').href = `${base}/review.png`;
  const stats = await json(`${base}/model.json`);
  $('metrics').replaceChildren(...[
    `${stats.triangles.toLocaleString()} triangles`, `${stats.bones} bones`,
    `${stats.materials} material`, `${Math.round(stats.glbBytes / 1024)} KB GLB`, '1 tile = 1 unit',
  ].map((label) => { const node = document.createElement('span'); node.textContent = label; return node; }));
  for (const [name, color] of Object.entries(stats.palette)) {
    const swatch = document.createElement('span');
    swatch.style.background = `#${color}`;
    swatch.title = `${name}: #${color}`;
    $('palette').append(swatch);
  }

  const atlas = new Image();
  atlas.src = '/assets/5.0/PixelHack.png';
  await atlas.decode();
  const crop = document.createElement('canvas');
  crop.width = crop.height = 32;
  const context = crop.getContext('2d', { willReadFrequently: true });
  const pixels = (id) => {
    context.clearRect(0, 0, 32, 32);
    context.drawImage(atlas, id % 40 * 32, Math.floor(id / 40) * 32, 32, 32, 0, 0, 32, 32);
    return context.getImageData(0, 0, 32, 32);
  };
  const background = pixels(2304), subject = pixels(tileId);
  for (let i = 0; i < subject.data.length; i += 4) {
    const a = subject.data, b = background.data;
    if ((a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) ||
        (a[i] === 131 && a[i + 1] === 171 && a[i + 2] === 162)) a[i + 3] = 0;
  }
  context.putImageData(subject, 0, 0);
  for (const [id, color] of [['source-light', '#ded9c6'], ['source-dark', '#1d282b']]) {
    const ctx = $(id).getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 320, 320);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(crop, 0, 0, 320, 320);
  }

  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.65, .65, .65, -.65, .01, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minZoom = .5;
  controls.maxZoom = 5;
  controls.maxPolarAngle = Math.PI / 2 + .08;
  scene.add(new THREE.HemisphereLight(0xeaf1f7, 0x707b76, 1.8));
  for (const [position, intensity, shadow] of [ [[2, 4, 3], 2.6, true], [[-3, 2, 1], 1.0, false], [[1, 3, -4], 2.0, false] ]) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(...position);
    light.castShadow = shadow;
    if (shadow) {
      light.shadow.mapSize.set(2048, 2048);
      Object.assign(light.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: .1, far: 12 });
      light.shadow.normalBias = .012;
      light.shadow.bias = -.00015;
    }
    scene.add(light);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.003;
  ground.receiveShadow = true;
  scene.add(ground);
  const gltf = await new GLTFLoader().loadAsync(`${base}/model.glb`);
  const model = gltf.scene;
  model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false; } });
  scene.add(model);
  const helper = new THREE.SkeletonHelper(model);
  helper.visible = false;
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.material.opacity = .8;
  helper.renderOrder = 10;
  scene.add(helper);
  // Include the attack arc when framing so the upward pounce stays on screen.
  // Sample once on load; playback retains a fixed camera and a readable ground reference.
  const framingPoints = [];
  function captureFramingBounds() {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (object.isSkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i += 1) {
        const point = object.getVertexPosition(i, new THREE.Vector3());
        framingPoints.push(point.applyMatrix4(object.matrixWorld));
      }
    });
  }
  captureFramingBounds();
  const attackClip = gltf.animations.find((clip) => clip.name === 'Attack');
  if (attackClip) {
    const framingMixer = new THREE.AnimationMixer(model);
    const action = framingMixer.clipAction(attackClip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    for (const time of [0, 1 / 30, stats.animationContract?.Attack?.hitTime ?? .1, attackClip.duration * .5]) {
      framingMixer.setTime(time);
      captureFramingBounds();
    }
    framingMixer.stopAllAction();
    framingMixer.uncacheRoot(model);
    model.traverse((object) => { if (object.isSkinnedMesh) object.skeleton.pose(); });
    model.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  let currentView = 'hero';
  let projectedWidth = .9, projectedHeight = .6;
  const views = { hero: [4, 3.1, 5], side: [5, 1.45, 0], front: [0, 1.9, 5], top: [0, 5, .001] };
  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    renderer.setSize(width, height, false);
    const vertical = Math.max(projectedHeight, projectedWidth * height / width) * 1.28;
    camera.left = -vertical * width / height / 2;
    camera.right = -camera.left;
    camera.top = vertical / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
  }
  function setView(name) {
    currentView = name;
    camera.position.copy(center).add(new THREE.Vector3(...views[name]).normalize().multiplyScalar(3));
    camera.zoom = 1;
    controls.target.copy(center);
    controls.update();
    camera.updateMatrixWorld();
    const projected = new THREE.Box3();
    const point = new THREE.Vector3();
    for (const sample of framingPoints) projected.expandByPoint(point.copy(sample).applyMatrix4(camera.matrixWorldInverse));
    const offset = projected.getCenter(new THREE.Vector3());
    offset.z = 0;
    offset.applyQuaternion(camera.quaternion);
    camera.position.add(offset);
    controls.target.add(offset);
    projectedWidth = projected.max.x - projected.min.x;
    projectedHeight = projected.max.y - projected.min.y;
    resize();
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
  const mixer = new THREE.AnimationMixer(model);
  for (const clip of gltf.animations) $('animation').add(new Option(clip.name, clip.name));
  function playClip() {
    mixer.stopAllAction();
    model.traverse((object) => { if (object.isSkinnedMesh) object.skeleton.pose(); });
    const clip = gltf.animations.find((item) => item.name === $('animation').value);
    if (clip) {
      const action = mixer.clipAction(clip).reset();
      const loop = stats.animationContract?.[clip.name]?.loop ?? clip.name !== 'Attack';
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      action.play();
    }
  }
  mixer.addEventListener('finished', () => {
    if ($('animation').value === 'Attack' && gltf.animations.some((clip) => clip.name === 'Idle')) {
      $('animation').value = 'Idle';
      playClip();
    }
  });
  $('animation').addEventListener('change', playClip);
  $('attack').addEventListener('click', () => {
    paused = false;
    $('pause').textContent = 'Pause';
    $('pause').setAttribute('aria-pressed', 'false');
    $('animation').value = 'Attack';
    playClip();
  });
  if (gltf.animations.some((clip) => clip.name === 'Idle')) $('animation').value = 'Idle';
  playClip();
  let paused = false;
  $('pause').addEventListener('click', () => {
    paused = !paused;
    $('pause').textContent = paused ? 'Play' : 'Pause';
    $('pause').setAttribute('aria-pressed', String(paused));
  });
  $('wireframe').addEventListener('change', () => model.traverse((object) => {
    if (object.isMesh) for (const material of [object.material].flat()) material.wireframe = $('wireframe').checked;
  }));
  $('skeleton').addEventListener('change', () => { helper.visible = $('skeleton').checked; });
  function backdrop() {
    const dark = $('backdrop').value === 'dark';
    scene.background = new THREE.Color(dark ? 0x1d282b : 0xded9c6);
    ground.material.opacity = dark ? .32 : .22;
    document.querySelector('.stage-note').style.color = dark ? '#9aafaa' : '#66716d';
  }
  $('backdrop').addEventListener('change', backdrop);
  backdrop();
  setView(currentView);
  $('status').hidden = true;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), .05);
    if (!paused && !document.hidden) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    controls.dispose();
    mixer.stopAllAction();
    renderer.dispose();
  }, { once: true });
}

main().catch((error) => {
  $('status').hidden = false;
  $('status').textContent = `Model preview failed: ${error.message}`;
  console.error(error);
});
