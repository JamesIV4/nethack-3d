import * as THREE from "three";
import type { Nh3dClientOptions, PlayMode } from "../ui-types";
import type { VrControllerHand, VrControllerVisual } from "./types";

type GripState = {
  active: boolean;
  currentPosition: THREE.Vector3;
  previousPosition: THREE.Vector3;
};

const tabletopMinScale = 0.05;
const tabletopMaxScale = 0.45;
const fpsWorldScale = 1.85;
const followHalfLifeMs = 110;

export default class VrWorldManipulator {
  private readonly worldRoot: THREE.Group;
  private readonly baseQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  private readonly tabletopAnchor = new THREE.Vector3(0, 1.05, -1.25);
  private readonly tabletopManualPosition = new THREE.Vector3(0, 1.05, -1.25);
  private readonly targetPosition = new THREE.Vector3();
  private readonly playerLocalScratch = new THREE.Vector3();
  private readonly leftGrip: GripState = {
    active: false,
    currentPosition: new THREE.Vector3(),
    previousPosition: new THREE.Vector3(),
  };
  private readonly rightGrip: GripState = {
    active: false,
    currentPosition: new THREE.Vector3(),
    previousPosition: new THREE.Vector3(),
  };
  private tabletopScale = 0.14;
  private dualGripStartDistance = 0;
  private dualGripStartScale = 0.14;
  private active = false;
  private lastPlayMode: PlayMode | null = null;

  constructor(worldRoot: THREE.Group) {
    this.worldRoot = worldRoot;
  }

  enter(playMode: PlayMode): void {
    this.active = true;
    this.lastPlayMode = null;
    this.syncMode(playMode);
  }

  exit(): void {
    this.active = false;
    this.lastPlayMode = null;
    this.leftGrip.active = false;
    this.rightGrip.active = false;
    this.tabletopScale = 0.14;
    this.dualGripStartDistance = 0;
    this.dualGripStartScale = this.tabletopScale;
    this.worldRoot.position.set(0, 0, 0);
    this.worldRoot.quaternion.identity();
    this.worldRoot.scale.set(1, 1, 1);
  }

  setGripPose(hand: VrControllerHand, position: THREE.Vector3, active: boolean): void {
    const state = hand === "left" ? this.leftGrip : this.rightGrip;
    if (active && !state.active) {
      state.previousPosition.copy(position);
      state.currentPosition.copy(position);
      state.active = true;
      if (this.leftGrip.active && this.rightGrip.active) {
        this.dualGripStartDistance = this.leftGrip.currentPosition.distanceTo(
          this.rightGrip.currentPosition,
        );
        this.dualGripStartScale = this.tabletopScale;
      }
      return;
    }
    if (!active) {
      state.active = false;
      return;
    }
    state.previousPosition.copy(state.currentPosition);
    state.currentPosition.copy(position);
  }

  update(
    deltaSeconds: number,
    playMode: PlayMode,
    playerTile: { x: number; y: number },
    clientOptions: Nh3dClientOptions,
    controllers: VrControllerVisual[],
  ): void {
    if (!this.active) {
      return;
    }
    this.syncMode(playMode);
    if (playMode === "fps") {
      this.worldRoot.quaternion.copy(this.baseQuaternion);
      this.worldRoot.scale.setScalar(fpsWorldScale);
      this.worldRoot.position.set(
        -playerTile.x * fpsWorldScale,
        0,
        -playerTile.y * fpsWorldScale,
      );
      return;
    }

    this.updateGripStatesFromControllers(controllers);
    const isDualGripActive = this.leftGrip.active && this.rightGrip.active;
    if (isDualGripActive) {
      const distance = this.leftGrip.currentPosition.distanceTo(
        this.rightGrip.currentPosition,
      );
      if (this.dualGripStartDistance > 0) {
        const nextScale =
          this.dualGripStartScale * (distance / this.dualGripStartDistance);
        this.tabletopScale = THREE.MathUtils.clamp(
          nextScale,
          tabletopMinScale,
          tabletopMaxScale,
        );
      }
    } else {
      const singleGrip = this.leftGrip.active ? this.leftGrip : this.rightGrip;
      if (singleGrip.active) {
        const delta = new THREE.Vector3().subVectors(
          singleGrip.currentPosition,
          singleGrip.previousPosition,
        );
        if (clientOptions.vrFollowPlayer) {
          this.tabletopAnchor.add(delta);
        } else {
          this.tabletopManualPosition.add(delta);
        }
      }
    }

    this.worldRoot.quaternion.copy(this.baseQuaternion);
    this.worldRoot.scale.setScalar(this.tabletopScale);
    this.playerLocalScratch.set(playerTile.x, -playerTile.y, 0).multiplyScalar(
      this.tabletopScale,
    );
    const desiredPosition = clientOptions.vrFollowPlayer
      ? this.targetPosition
          .copy(this.tabletopAnchor)
          .sub(this.playerLocalScratch)
      : this.targetPosition.copy(this.tabletopManualPosition);

    if (clientOptions.vrFollowPlayer && !this.leftGrip.active && !this.rightGrip.active) {
      const alpha =
        1 -
        Math.exp((-Math.LN2 * deltaSeconds * 1000) / followHalfLifeMs);
      this.worldRoot.position.lerp(desiredPosition, alpha);
    } else {
      this.worldRoot.position.copy(desiredPosition);
    }
  }

  private updateGripStatesFromControllers(controllers: VrControllerVisual[]): void {
    const leftController = controllers.find((entry) => entry.hand === "left");
    const rightController = controllers.find((entry) => entry.hand === "right");
    if (leftController && this.leftGrip.active) {
      this.leftGrip.currentPosition.setFromMatrixPosition(
        leftController.grip.matrixWorld,
      );
    }
    if (rightController && this.rightGrip.active) {
      this.rightGrip.currentPosition.setFromMatrixPosition(
        rightController.grip.matrixWorld,
      );
    }
  }

  private syncMode(playMode: PlayMode): void {
    if (this.lastPlayMode === playMode) {
      return;
    }
    this.lastPlayMode = playMode;
    if (playMode === "normal") {
      this.worldRoot.quaternion.copy(this.baseQuaternion);
      this.worldRoot.scale.setScalar(this.tabletopScale);
      this.worldRoot.position.copy(this.tabletopAnchor);
      return;
    }
    this.leftGrip.active = false;
    this.rightGrip.active = false;
  }
}
