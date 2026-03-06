import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import type { VrControllerHand, VrControllerVisual } from "./types";

type ConnectedControllerEvent = THREE.Event<"connected"> & {
  data?: XRInputSource;
};

type DisconnectedControllerEvent = THREE.Event<"disconnected">;

type XrControllerEventTarget = {
  addEventListener(
    type: "connected",
    listener: (event: ConnectedControllerEvent) => void,
  ): void;
  addEventListener(
    type: "disconnected",
    listener: (event: DisconnectedControllerEvent) => void,
  ): void;
  removeEventListener(
    type: "connected",
    listener: (event: ConnectedControllerEvent) => void,
  ): void;
  removeEventListener(
    type: "disconnected",
    listener: (event: DisconnectedControllerEvent) => void,
  ): void;
};

export default class VrVisuals {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly worldRoot: THREE.Group;
  private readonly modelFactory = new XRControllerModelFactory();
  private readonly controllersByHand = new Map<VrControllerHand, VrControllerVisual>();
  private readonly controllerSpaces: VrControllerVisual[] = [];
  private readonly boundaryLine: THREE.LineLoop;
  private readonly connectedHandlers = new Map<
    number,
    (event: ConnectedControllerEvent) => void
  >();
  private readonly disconnectedHandlers = new Map<
    number,
    (event: DisconnectedControllerEvent) => void
  >();
  private readonly warningPanelRoot: THREE.Group;
  private readonly warningPanelMesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly warningPanelCanvas: HTMLCanvasElement;
  private readonly warningPanelContext: CanvasRenderingContext2D;
  private readonly warningPanelTexture: THREE.CanvasTexture;
  private readonly warningPanelForward = new THREE.Vector3();
  private readonly warningPanelPosition = new THREE.Vector3();
  private warningPanelMessage =
    "DOM overlay unavailable in this session.";
  private warningPanelHovered = false;
  private warningPanelFingerprint = "";

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    worldRoot: THREE.Group,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.worldRoot = worldRoot;
    this.boundaryLine = this.createBoundaryLine();
    this.worldRoot.add(this.boundaryLine);

    const warningPanel = this.createWarningPanel();
    this.warningPanelRoot = warningPanel.root;
    this.warningPanelMesh = warningPanel.mesh;
    this.warningPanelCanvas = warningPanel.canvas;
    this.warningPanelContext = warningPanel.context;
    this.warningPanelTexture = warningPanel.texture;
    this.warningPanelRoot.visible = false;
    this.scene.add(this.warningPanelRoot);
    this.redrawWarningPanel();

    this.initControllers();
  }

  private createBoundaryLine(): THREE.LineLoop {
    const points = [
      new THREE.Vector3(-0.5, 0.5, 0.02),
      new THREE.Vector3(79.5, 0.5, 0.02),
      new THREE.Vector3(79.5, -20.5, 0.02),
      new THREE.Vector3(-0.5, -20.5, 0.02),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xa8d6ff,
      transparent: true,
      opacity: 0.64,
      depthTest: false,
      toneMapped: false,
    });
    const line = new THREE.LineLoop(geometry, material);
    line.renderOrder = 920;
    line.visible = false;
    return line;
  }

  private createLaserLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0xfff6a8,
      transparent: true,
      opacity: 0.78,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.name = "nh3d-vr-laser";
    line.scale.z = 8;
    return line;
  }

  private createWarningPanel(): {
    root: THREE.Group;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
  } {
    const root = new THREE.Group();
    root.name = "nh3d-vr-warning-panel-root";

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create VR warning panel canvas context");
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.44), material);
    mesh.name = "nh3d-vr-warning-panel";
    mesh.renderOrder = 2400;
    root.add(mesh);

    return { root, mesh, canvas, context, texture };
  }

  private redrawWarningPanel(): void {
    const fingerprint = `${this.warningPanelMessage}|${this.warningPanelHovered ? "hover" : "idle"}`;
    if (fingerprint === this.warningPanelFingerprint) {
      return;
    }
    this.warningPanelFingerprint = fingerprint;

    const context = this.warningPanelContext;
    const canvas = this.warningPanelCanvas;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(22, 32, 46, 0.96)");
    gradient.addColorStop(1, "rgba(8, 16, 28, 0.98)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = this.warningPanelHovered
      ? "rgba(255, 246, 168, 1)"
      : "rgba(255, 246, 168, 0.82)";
    context.lineWidth = this.warningPanelHovered ? 8 : 6;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    context.fillStyle = "#fff6a8";
    context.font = "bold 50px 'Courier New', monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("VR WARNING", canvas.width * 0.5, 86);

    context.fillStyle = "rgba(220, 236, 255, 0.96)";
    context.font = "30px 'Courier New', monospace";
    context.fillText(this.warningPanelMessage, canvas.width * 0.5, 170);

    context.fillStyle = this.warningPanelHovered
      ? "rgba(255, 246, 168, 1)"
      : "rgba(188, 210, 232, 0.92)";
    context.font = "bold 28px 'Courier New', monospace";
    context.fillText("Trigger / A to dismiss", canvas.width * 0.5, 262);

    this.warningPanelTexture.needsUpdate = true;
  }

  setWarningPanelMessage(message: string): void {
    const next = String(message || "").trim();
    this.warningPanelMessage =
      next.length > 0 ? next : "DOM overlay unavailable in this session.";
    this.redrawWarningPanel();
  }

  setWarningPanelHover(hovered: boolean): void {
    const next = Boolean(hovered);
    if (this.warningPanelHovered === next) {
      return;
    }
    this.warningPanelHovered = next;
    this.redrawWarningPanel();
  }

  resolveWarningPanelHitFromRay(
    raycaster: THREE.Raycaster,
  ): { distance: number } | null {
    if (!this.warningPanelRoot.visible) {
      return null;
    }
    const hit = raycaster.intersectObject(this.warningPanelMesh, false)[0];
    if (!hit) {
      return null;
    }
    return { distance: hit.distance };
  }

  private initControllers(): void {
    for (let index = 0; index < 2; index += 1) {
      const controller = this.renderer.xr.getController(index);
      const grip = this.renderer.xr.getControllerGrip(index);
      const rayLine = this.createLaserLine();
      const modelRoot = new THREE.Group();
      grip.add(modelRoot);
      controller.add(rayLine);
      this.scene.add(controller);
      this.scene.add(grip);

      const visual: VrControllerVisual = {
        hand: index === 0 ? "left" : "right",
        index,
        controller,
        grip,
        rayLine,
        modelRoot,
        inputSource: null,
      };
      this.controllerSpaces.push(visual);

      const onConnected = (event: ConnectedControllerEvent): void => {
        const handedness = event.data?.handedness === "left" ? "left" : "right";
        visual.hand = handedness;
        visual.inputSource = event.data ?? null;
        while (modelRoot.children.length > 0) {
          modelRoot.remove(modelRoot.children[0]);
        }
        modelRoot.add(this.modelFactory.createControllerModel(grip));
        this.controllersByHand.set(handedness, visual);
      };
      const onDisconnected = (): void => {
        if (this.controllersByHand.get(visual.hand) === visual) {
          this.controllersByHand.delete(visual.hand);
        }
        visual.inputSource = null;
        while (modelRoot.children.length > 0) {
          modelRoot.remove(modelRoot.children[0]);
        }
      };
      const controllerEvents = controller as unknown as XrControllerEventTarget;
      controllerEvents.addEventListener("connected", onConnected);
      controllerEvents.addEventListener("disconnected", onDisconnected);
      this.connectedHandlers.set(index, onConnected);
      this.disconnectedHandlers.set(index, onDisconnected);
    }
  }

  getControllers(): VrControllerVisual[] {
    const ordered: VrControllerVisual[] = [];
    const left = this.controllersByHand.get("left");
    const right = this.controllersByHand.get("right");
    if (left) {
      ordered.push(left);
    }
    if (right) {
      ordered.push(right);
    }
    for (const visual of this.controllerSpaces) {
      if (!ordered.includes(visual) && visual.inputSource) {
        ordered.push(visual);
      }
    }
    return ordered;
  }

  setBoundaryVisible(visible: boolean): void {
    this.boundaryLine.visible = visible;
  }

  setRayLength(visual: VrControllerVisual, distance: number): void {
    visual.rayLine.scale.z = Math.max(0.25, distance);
  }

  updateWarningPanel(
    camera: THREE.Camera & THREE.Object3D,
    visible: boolean,
  ): void {
    this.warningPanelRoot.visible = visible;
    if (!visible) {
      this.setWarningPanelHover(false);
      return;
    }
    camera.getWorldPosition(this.warningPanelPosition);
    camera.getWorldDirection(this.warningPanelForward);
    this.warningPanelForward.normalize();
    this.warningPanelRoot.position
      .copy(this.warningPanelPosition)
      .addScaledVector(this.warningPanelForward, 1.02);
    this.warningPanelRoot.quaternion.copy(camera.quaternion);
    this.warningPanelRoot.translateY(-0.14);
  }

  resetRayLengths(): void {
    for (const visual of this.controllerSpaces) {
      visual.rayLine.scale.z = 8;
    }
  }

  dispose(): void {
    for (const visual of this.controllerSpaces) {
      const connected = this.connectedHandlers.get(visual.index);
      const controllerEvents =
        visual.controller as unknown as XrControllerEventTarget;
      if (connected) {
        controllerEvents.removeEventListener("connected", connected);
      }
      const disconnected = this.disconnectedHandlers.get(visual.index);
      if (disconnected) {
        controllerEvents.removeEventListener("disconnected", disconnected);
      }
      visual.controller.remove(visual.rayLine);
      visual.grip.remove(visual.modelRoot);
      this.scene.remove(visual.controller);
      this.scene.remove(visual.grip);
      visual.rayLine.geometry.dispose();
      const lineMaterial = visual.rayLine.material;
      if (lineMaterial instanceof THREE.Material) {
        lineMaterial.dispose();
      }
    }
    this.controllersByHand.clear();
    this.connectedHandlers.clear();
    this.disconnectedHandlers.clear();
    this.worldRoot.remove(this.boundaryLine);
    this.boundaryLine.geometry.dispose();
    const boundaryMaterial = this.boundaryLine.material;
    if (boundaryMaterial instanceof THREE.Material) {
      boundaryMaterial.dispose();
    }

    this.scene.remove(this.warningPanelRoot);
    this.warningPanelMesh.geometry.dispose();
    this.warningPanelMesh.material.map?.dispose();
    this.warningPanelMesh.material.dispose();
  }
}
