import * as THREE from "three";
import type { Nh3dVrPointerHand } from "../ui-types";
import type { VrControllerVisual, VrEngineBridge, VrTileTarget } from "./types";

export default class VrPointerSystem {
  private readonly bridge: VrEngineBridge;
  private readonly raycaster = new THREE.Raycaster();

  constructor(bridge: VrEngineBridge) {
    this.bridge = bridge;
  }

  update(
    controllers: VrControllerVisual[],
    preferredHand: Nh3dVrPointerHand,
    setRayLength: (visual: VrControllerVisual, distance: number) => void,
  ): VrTileTarget | null {
    const xrControllerTarget = (
      controller: VrControllerVisual["controller"],
    ): Parameters<THREE.Raycaster["setFromXRController"]>[0] =>
      controller as Parameters<THREE.Raycaster["setFromXRController"]>[0];
    const hits = new Map<VrControllerVisual, VrTileTarget | null>();
    for (const visual of controllers) {
      this.raycaster.setFromXRController(xrControllerTarget(visual.controller));
      const target = this.bridge.resolveTileTargetFromRay(this.raycaster, false);
      hits.set(visual, target);
      if (target) {
        const distance = this.raycaster.ray.origin.distanceTo(
          target.mesh.getWorldPosition(new THREE.Vector3()),
        );
        setRayLength(visual, distance);
      } else {
        setRayLength(visual, 8);
      }
    }

    const preferred = controllers.find((entry) => entry.hand === preferredHand);
    const secondary = controllers.find((entry) => entry.hand !== preferredHand);
    const activeTarget =
      (preferred && hits.get(preferred)) ||
      (secondary && hits.get(secondary)) ||
      null;
    this.bridge.setVrHoveredTile(activeTarget);
    return activeTarget;
  }

  clear(): void {
    this.bridge.setVrHoveredTile(null);
  }
}
