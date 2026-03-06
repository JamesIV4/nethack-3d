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
const defaultTabletopAnchorHeight = 0.92;
const defaultTabletopTiltDegrees = 20;
const minTabletopTiltDegrees = 0;
const maxTabletopTiltDegrees = 45;

export default class VrWorldManipulator {
  private readonly worldRoot: THREE.Group;
  private readonly fpsQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  private readonly tabletopQuaternion = new THREE.Quaternion();
  private readonly tabletopEuler = new THREE.Euler(-Math.PI / 2, 0, 0);
  private readonly tabletopAnchor = new THREE.Vector3(
    0,
    defaultTabletopAnchorHeight,
    -1.25,
  );
  private readonly tabletopManualPosition = new THREE.Vector3(
    0,
    defaultTabletopAnchorHeight,
    -1.25,
  );
  private readonly targetPosition = new THREE.Vector3();
  private readonly playerLocalScratch = new THREE.Vector3();
  private readonly playerWorldScratch = new THREE.Vector3();
  private readonly gripDeltaScratch = new THREE.Vector3();
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
  private tabletopTiltRadians = THREE.MathUtils.degToRad(
    defaultTabletopTiltDegrees,
  );

  constructor(worldRoot: THREE.Group) {
    this.worldRoot = worldRoot;
    this.tabletopEuler.x = -Math.PI / 2 + this.tabletopTiltRadians;
    this.tabletopQuaternion.setFromEuler(this.tabletopEuler);
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
    this.syncTabletopTilt(clientOptions.vrTabletopTiltDegrees);
    this.syncMode(playMode, clientOptions);
    if (playMode === "fps") {
      this.worldRoot.quaternion.copy(this.fpsQuaternion);
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
        const delta = this.gripDeltaScratch.subVectors(
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

    this.worldRoot.quaternion.copy(this.tabletopQuaternion);
    this.worldRoot.scale.setScalar(this.tabletopScale);
    this.playerLocalScratch.set(playerTile.x, -playerTile.y, 0).multiplyScalar(
      this.tabletopScale,
    );
    this.playerWorldScratch
      .copy(this.playerLocalScratch)
      // Follow translation should stay stable even when tabletop tilt changes.
      .applyQuaternion(this.fpsQuaternion);
    const desiredPosition = clientOptions.vrFollowPlayer
      ? this.targetPosition
          .copy(this.tabletopAnchor)
          .sub(this.playerWorldScratch)
      : this.targetPosition.copy(this.tabletopManualPosition);
    if (clientOptions.vrFollowPlayer) {
      desiredPosition.y = this.tabletopAnchor.y;
    }

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

  private syncMode(
    playMode: PlayMode,
    clientOptions: Pick<Nh3dClientOptions, "vrFollowPlayer"> | null = null,
  ): void {
    if (this.lastPlayMode === playMode) {
      return;
    }
    this.lastPlayMode = playMode;
    if (playMode === "normal") {
      this.worldRoot.quaternion.copy(this.tabletopQuaternion);
      this.worldRoot.scale.setScalar(this.tabletopScale);
      const shouldFollowPlayer =
        clientOptions?.vrFollowPlayer !== false;
      this.worldRoot.position.copy(
        shouldFollowPlayer ? this.tabletopAnchor : this.tabletopManualPosition,
      );
      return;
    }
    this.leftGrip.active = false;
    this.rightGrip.active = false;
  }

  private syncTabletopTilt(rawTiltDegrees: number): void {
    const tiltDegrees = Number.isFinite(rawTiltDegrees)
      ? rawTiltDegrees
      : defaultTabletopTiltDegrees;
    const clampedTiltRadians = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(
        tiltDegrees,
        minTabletopTiltDegrees,
        maxTabletopTiltDegrees,
      ),
    );
    if (Math.abs(clampedTiltRadians - this.tabletopTiltRadians) <= 1e-5) {
      return;
    }
    this.tabletopTiltRadians = clampedTiltRadians;
    this.tabletopEuler.x = -Math.PI / 2 + clampedTiltRadians;
    this.tabletopQuaternion.setFromEuler(this.tabletopEuler);
  }
}
