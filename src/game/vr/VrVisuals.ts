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
        const handedness =
          event.data?.handedness === "left" ? "left" : "right";
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
  }
}
