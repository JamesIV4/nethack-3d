import * as THREE from "three";
import { WiredBridge, type WiredPoint } from "./bridge";
import { SinglePointerOwner, uvToSourcePoint } from "./input";
import { createSurface, createControls, type Surface } from "./surfaces";
import "./style.css";

type Hit = { surface: Surface; point: WiredPoint; world: THREE.Vector3 };
const mount = document.getElementById("wired-scene")!;
const status = document.getElementById("wired-status")!;
const enter = document.getElementById("wired-enter") as HTMLButtonElement;
const token = new URLSearchParams(location.hash.slice(1)).get("token");
function report(message: string): void { status.textContent = message; }
if (!token) {
  report("Run npm run quest:wired and open the complete local URL printed in the terminal.");
  enter.textContent = "UI host required";
} else {
  void start(token).catch((error: unknown) => report(error instanceof Error ? error.message : String(error)));
}

async function start(accessToken: string): Promise<void> {
  const bridge = new WiredBridge(accessToken, report);
  const info = await bridge.info();
  const sourceSize = { width: info.width, height: info.height };
  if (!uvToSourcePoint({ x: 0, y: 0 }, sourceSize)) throw new Error("Invalid UI viewport from local host.");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.domElement.tabIndex = 0;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07111d");
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .05, 100);
  camera.position.set(0, 1.45, .8);
  const panel = new THREE.Group();
  panel.position.set(0, 1.45, -1.6);
  scene.add(panel);
  const floor = new THREE.GridHelper(20, 40, 0x27465a, 0x102b3a);
  floor.position.y = -.02; scene.add(floor);
  const uiHeight = 1.8 * info.height / info.width;
  const ui = createSurface(panel, info.width, info.height, 1.8, 0);
  const toolbar = createSurface(panel, 1600, 100, 1.8, -uiHeight / 2 - .08);
  const keyboard = createSurface(panel, 1600, 470, 1.8, -uiHeight / 2 - .43);
  const surfaces = [ui, toolbar, keyboard];
  const context = ui.canvas.getContext("2d")!;
  context.fillStyle = "#12283b"; context.fillRect(0, 0, info.width, info.height);
  context.fillStyle = "#eaf2ff"; context.font = "32px sans-serif";
  context.fillText("Waiting for browser-rendered UI…", 40, 70);
  const owner = new SinglePointerOwner();
  let lastPoint: WiredPoint = { x: 0, y: 0 };
  let frameId = 0, lastFramePoll = -Infinity, lastMove = -Infinity, lastScroll = -Infinity;
  let framePending = false, stopped = false, entering = false;
  const raycaster = new THREE.Raycaster(), rotation = new THREE.Matrix4(), mouse = new THREE.Vector2();
  const head = new THREE.Vector3(), forward = new THREE.Vector3();

  function cancel(pointer?: string): void {
    if (pointer && !owner.owns(pointer)) return;
    owner.cancel();
    bridge.release();
  }
  function up(pointer: string, target: Hit | null): void {
    if (!owner.release(pointer)) return;
    if (target?.surface === ui) bridge.input({ type: "up", ...target.point });
    else bridge.release(); // Cancel outside the viewport; do not click the last hovered button.
  }
  function recenter(): void {
    const view = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    view.getWorldPosition(head); view.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < .01) forward.set(0, 0, -1);
    forward.normalize();
    panel.position.copy(head).addScaledVector(forward, 2.4);
    panel.position.y -= .05;
    panel.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0);
    panel.updateMatrixWorld(true);
  }
  createControls(toolbar, keyboard, {
    key: (key, shift) => bridge.input({ type: "key", key, ...(shift === undefined ? {} : { shift }) }),
    navigate: (page) => { cancel(); bridge.navigate(page); }, recenter,
    exit: () => { void renderer.xr.getSession()?.end(); },
  });
  function hit(): Hit | null {
    const result = raycaster.intersectObjects(surfaces.filter((s) => s.mesh.visible).map((s) => s.mesh), false)[0];
    if (!result?.uv) return null;
    const surface = surfaces.find((s) => s.mesh === result.object)!;
    const point = uvToSourcePoint(result.uv, { width: surface.canvas.width, height: surface.canvas.height });
    return point ? { surface, point, world: result.point } : null;
  }
  function down(pointer: string, target: Hit | null): void {
    if (!target || owner.activeOwner !== null) return;
    if (target.surface === ui) {
      if (!owner.claim(pointer)) return;
      lastPoint = target.point;
      bridge.input({ type: "move", ...lastPoint }); bridge.input({ type: "down", ...lastPoint });
    } else {
      const { x, y } = target.point;
      target.surface.buttons.find((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)?.action();
    }
  }
  function move(pointer: string, target: Hit | null, now: number): void {
    if (owner.activeOwner !== null && !owner.owns(pointer)) return;
    if (target?.surface !== ui || now - lastMove < 30) return;
    lastMove = now; lastPoint = target.point;
    bridge.input({ type: "move", ...lastPoint });
  }
  function desktopHit(event: MouseEvent): Hit | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    mouse.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    return hit();
  }
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    renderer.domElement.focus(); renderer.domElement.setPointerCapture(event.pointerId);
    down("desktop", desktopHit(event));
  });
  renderer.domElement.addEventListener("pointermove", (event) => move("desktop", desktopHit(event), performance.now()));
  renderer.domElement.addEventListener("pointerup", (event) => up("desktop", desktopHit(event)));
  renderer.domElement.addEventListener("pointercancel", () => cancel("desktop"));
  renderer.domElement.addEventListener("lostpointercapture", () => cancel("desktop"));
  renderer.domElement.addEventListener("wheel", (event) => {
    const target = desktopHit(event);
    if (target?.surface !== ui) return;
    event.preventDefault();
    bridge.input({ type: "wheel", ...target.point, deltaY: Math.max(-1000, Math.min(1000, event.deltaY * (event.deltaMode === 1 ? 16 : 1))) });
  }, { passive: false });
  renderer.domElement.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const named = ["Enter", "Escape", "Backspace", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (event.key.length !== 1 && !named.includes(event.key)) return;
    event.preventDefault(); bridge.input({ type: "key", key: event.key, shift: event.shiftKey });
  });

  const controllers = [0, 1].map((index) => {
    const controller = renderer.xr.getController(index), pointer = `xr-${index}`;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: index === 0 ? 0x8ce8d6 : 0xb6a5ff }));
    line.scale.z = 4; controller.add(line); scene.add(controller);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8ce8d6, depthTest: false }));
    dot.visible = false; dot.renderOrder = 10; scene.add(dot);
    const state = { controller, pointer, dot, line, input: null as XRInputSource | null, target: null as Hit | null };
    controller.addEventListener("connected", (event) => { state.input = event.data as XRInputSource; });
    controller.addEventListener("disconnected", () => { cancel(pointer); state.input = null; state.target = null; dot.visible = false; });
    controller.addEventListener("selectstart", () => down(pointer, state.target));
    controller.addEventListener("selectend", () => up(pointer, state.target));
    return state;
  });
  async function checkHeadset(): Promise<void> {
    if (renderer.xr.isPresenting) return;
    try {
      const supported = window.isSecureContext && await navigator.xr?.isSessionSupported("immersive-vr");
      enter.disabled = !supported; enter.textContent = supported ? "Enter VR" : "Headset unavailable";
      report(supported ? "Headset available. Enter VR to use the UI panel." : "Start Link/SteamVR in a WebXR-capable desktop browser, then Check headset.");
    } catch (error) { enter.disabled = true; report(`Headset check failed: ${String(error)}`); }
  }
  // Three has restored its framebuffer and cleared isPresenting before this event.
  renderer.xr.addEventListener("sessionend", () => {
    cancel(); controllers.forEach((s) => { s.dot.visible = false; s.target = null; });
    camera.position.set(0, 1.45, .8); camera.quaternion.identity();
    camera.fov = 58; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    panel.position.set(0, 1.45, -1.6); panel.quaternion.identity();
    void checkHeadset();
  });
  enter.addEventListener("click", () => {
    if (entering) return;
    entering = true;
    void (async () => {
      let session: XRSession | undefined;
      try {
        session = await navigator.xr!.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });

        session.addEventListener("visibilitychange", () => { if (session?.visibilityState !== "visible") cancel(); });
        await renderer.xr.setSession(session);
        enter.disabled = true; enter.textContent = "VR active";
        report("Trigger: interact; thumbstick: scroll. Keyboard and recenter are below the UI.");
      } catch (error) {
        if (session) await session.end().catch(() => undefined);
        report(`Could not enter VR: ${String(error)}`);
      } finally { entering = false; }
    })();
  });
  document.getElementById("wired-recheck")!.addEventListener("click", () => { void checkHeadset(); });
  document.getElementById("wired-recenter")!.addEventListener("click", recenter);
  window.addEventListener("blur", () => cancel());
  window.addEventListener("resize", () => {
    if (renderer.xr.isPresenting) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });
  async function fetchFrame(): Promise<void> {
    framePending = true;
    try {
      const response = await bridge.request(`frame?since=${frameId}`);
      if (response.status === 204) return;
      const nextId = Number(response.headers.get("X-Frame-Id"));
      const bitmap = await createImageBitmap(await response.blob());
      if (!stopped) { context.drawImage(bitmap, 0, 0, info.width, info.height); ui.mesh.material.map!.needsUpdate = true; if (Number.isFinite(nextId)) frameId = nextId; }
      bitmap.close();
    } catch (error) { report(`UI stream interrupted: ${String(error)}`); }
    finally { framePending = false; }
  }
  renderer.setAnimationLoop((time) => {
    if (stopped) return;
    if (!framePending && time - lastFramePoll >= 50) { lastFramePoll = time; void fetchFrame(); }
    scene.updateMatrixWorld(true);
    if (renderer.xr.isPresenting) for (const state of controllers) {
      if (!state.input) continue;
      rotation.extractRotation(state.controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(state.controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      state.target = hit(); state.dot.visible = !!state.target;
      if (state.target) { state.dot.position.copy(state.target.world); state.line.scale.z = state.target.world.distanceTo(raycaster.ray.origin); move(state.pointer, state.target, time); }
      else state.line.scale.z = 4;
      const axes = state.input.gamepad?.axes, scroll = axes?.[3] ?? axes?.[1] ?? 0;
      if (state.target?.surface === ui && Math.abs(scroll) > .25 && time - lastScroll >= 50 && (owner.activeOwner === null || owner.owns(state.pointer))) {
        lastScroll = time; bridge.input({ type: "wheel", ...state.target.point, deltaY: scroll * 65 });
      }
    }
    renderer.render(scene, camera);
  });
  window.addEventListener("pagehide", () => {
    stopped = true; bridge.releaseOnUnload(); renderer.setAnimationLoop(null);
    surfaces.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); });
    controllers.forEach(({ line, dot }) => { line.geometry.dispose(); line.material.dispose(); dot.geometry.dispose(); dot.material.dispose(); });
    floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); renderer.dispose();
  }, { once: true });
  await checkHeadset();
}
