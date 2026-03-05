import * as THREE from "three";
import type {
  Nh3dClientOptions,
  PlayMode,
  XrAvailabilityState,
  XrSessionState,
} from "../ui-types";

export type VrControllerHand = "left" | "right";

export type VrTileTarget = {
  key: string;
  x: number;
  y: number;
  mesh: THREE.Mesh;
};

export type VrControllerVisual = {
  hand: VrControllerHand;
  index: number;
  controller: THREE.Group;
  grip: THREE.Group;
  rayLine: THREE.Line;
  modelRoot: THREE.Group;
  inputSource: XRInputSource | null;
};

export type VrEngineBridge = {
  getPlayMode(): PlayMode;
  getPlayerTilePosition(): { x: number; y: number };
  getClientOptions(): Nh3dClientOptions;
  setClientOptions(options: Nh3dClientOptions): void;
  resolveTileTargetFromRay(
    raycaster: THREE.Raycaster,
    requireMesh: boolean,
  ): VrTileTarget | null;
  runVrPrimaryAction(target: VrTileTarget): void;
  runVrSecondaryAction(target: VrTileTarget): void;
  setVrHoveredTile(target: VrTileTarget | null): void;
  setVrQuickPanelVisible(visible: boolean): void;
  getVrQuickPanelVisible(): boolean;
  setXrAvailability(state: XrAvailabilityState): void;
  setXrSessionState(state: XrSessionState): void;
  setPlayerUiNumbersWorldProjection(enabled: boolean): void;
  clearPointerLockForVr(): void;
  shouldSuspendVrForUi(): boolean;
};
