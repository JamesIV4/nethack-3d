import * as THREE from "three";
import type { PlayMode } from "../ui-types";
import type {
  VrControllerHand,
  VrControllerVisual,
  VrEngineBridge,
  VrTileTarget,
} from "./types";
import VrWorldManipulator from "./VrWorldManipulator";

type ButtonSnapshot = {
  triggerPressed: boolean;
  gripPressed: boolean;
  facePrimaryPressed: boolean;
  faceSecondaryPressed: boolean;
};

export default class VrInputRouter {
  private readonly bridge: VrEngineBridge;
  private readonly worldManipulator: VrWorldManipulator;
  private readonly previousButtons = new Map<VrControllerHand, ButtonSnapshot>();
  private readonly gripPositionScratch = new THREE.Vector3();

  constructor(bridge: VrEngineBridge, worldManipulator: VrWorldManipulator) {
    this.bridge = bridge;
    this.worldManipulator = worldManipulator;
  }

  update(options: {
    controllers: VrControllerVisual[];
    activeTarget: VrTileTarget | null;
    playMode: PlayMode;
    quickPanelVisible: boolean;
  }): void {
    const { controllers, activeTarget, quickPanelVisible } = options;
    const seenHands = new Set<VrControllerHand>();
    for (const visual of controllers) {
      seenHands.add(visual.hand);
      const current = this.readButtons(visual.inputSource?.gamepad ?? null);
      const previous =
        this.previousButtons.get(visual.hand) ?? this.createEmptyButtons();

      this.gripPositionScratch.setFromMatrixPosition(visual.grip.matrixWorld);
      this.worldManipulator.setGripPose(
        visual.hand,
        this.gripPositionScratch,
        current.gripPressed,
      );

      if (
        visual.hand === "left" &&
        current.faceSecondaryPressed &&
        !previous.faceSecondaryPressed
      ) {
        this.bridge.setVrQuickPanelVisible(!this.bridge.getVrQuickPanelVisible());
      }

      if (!quickPanelVisible && activeTarget) {
        const primaryPressed =
          (current.triggerPressed && !previous.triggerPressed) ||
          (current.facePrimaryPressed && !previous.facePrimaryPressed);
        if (primaryPressed) {
          this.bridge.runVrPrimaryAction(activeTarget);
        }
        if (
          current.faceSecondaryPressed &&
          !previous.faceSecondaryPressed &&
          visual.hand === "right"
        ) {
          this.bridge.runVrSecondaryAction(activeTarget);
        }
      }

      this.previousButtons.set(visual.hand, current);
    }

    for (const hand of ["left", "right"] as const) {
      if (!seenHands.has(hand)) {
        this.previousButtons.delete(hand);
        this.worldManipulator.setGripPose(
          hand,
          this.gripPositionScratch.set(0, 0, 0),
          false,
        );
      }
    }
  }

  private readButtons(gamepad: Gamepad | null): ButtonSnapshot {
    return {
      triggerPressed: Boolean(gamepad?.buttons?.[0]?.pressed),
      gripPressed: Boolean(gamepad?.buttons?.[1]?.pressed),
      facePrimaryPressed: Boolean(gamepad?.buttons?.[4]?.pressed),
      faceSecondaryPressed: Boolean(gamepad?.buttons?.[5]?.pressed),
    };
  }

  private createEmptyButtons(): ButtonSnapshot {
    return {
      triggerPressed: false,
      gripPressed: false,
      facePrimaryPressed: false,
      faceSecondaryPressed: false,
    };
  }
}
