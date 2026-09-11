import * as THREE from "three";
import type { AimDirection } from "../shared/types";
import type { AimHighlights } from "../ui/aim-highlights";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { InputCommands } from "./input-commands";
import type { PlayerMovement } from "../world/player-movement";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileRendering } from "../rendering/tile-rendering";

export interface MovementInputDependencies {
  readonly aimHighlights: Pick<
    AimHighlights,
    "fpsAimLinePulseUntilMs"
  >;
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "armPendingThrownWeaponDirectionSound"
  >;
  readonly camera: Pick<
    Camera,
    "cameraPitch"
    | "firstPersonPitchMin"
    | "getFpsAimDirectionFromCamera"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "playMode"
    | "session"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "numberPadModeEnabled"
    | "sendInput"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
}

/** Keyboard and analog direction mapping, relative movement, input sounds and cooldown bookkeeping. */
export class MovementInput {
  constructor(private readonly dependencies: MovementInputDependencies) {}

  lastMovementInputAtMs: number = 0;

  playerCliparoundInputCooldownUntilMs: number = 0;

  readonly playerCliparoundInputCooldownMs: number = 520;

  fpsFireSuppressionUntilMs: number = 0;

  readonly fpsFireSuppressionDurationMs: number = 1500;

  getDirectionVectorFromInput(
    input: string,
  ): { dx: number; dy: number } | null {
    if (this.dependencies.inputCommands.numberPadModeEnabled && /^[hjklyubn]$/i.test(input)) {
      return null;
    }

    switch (input) {
      case "k":
      case "K":
      case "ArrowUp":
      case "Numpad8":
        return { dx: 0, dy: -1 };
      case "j":
      case "J":
      case "ArrowDown":
      case "Numpad2":
        return { dx: 0, dy: 1 };
      case "h":
      case "H":
      case "ArrowLeft":
      case "Numpad4":
        return { dx: -1, dy: 0 };
      case "l":
      case "L":
      case "ArrowRight":
      case "Numpad6":
        return { dx: 1, dy: 0 };
      case "y":
      case "Y":
      case "Home":
      case "Numpad7":
        return { dx: -1, dy: -1 };
      case "u":
      case "U":
      case "PageUp":
      case "Numpad9":
        return { dx: 1, dy: -1 };
      case "b":
      case "B":
      case "End":
      case "Numpad1":
        return { dx: -1, dy: 1 };
      case "n":
      case "N":
      case "PageDown":
      case "Numpad3":
        return { dx: 1, dy: 1 };
      default:
        break;
    }

    if (!this.dependencies.inputCommands.numberPadModeEnabled) {
      return null;
    }

    switch (input) {
      case "8":
        return { dx: 0, dy: -1 };
      case "2":
        return { dx: 0, dy: 1 };
      case "4":
        return { dx: -1, dy: 0 };
      case "6":
        return { dx: 1, dy: 0 };
      case "7":
        return { dx: -1, dy: -1 };
      case "9":
        return { dx: 1, dy: -1 };
      case "1":
        return { dx: -1, dy: 1 };
      case "3":
        return { dx: 1, dy: 1 };
      default:
        return null;
    }
  }

  isMovementInput(input: string): boolean {
    if (input.length === 1) {
      switch (input) {
        case "h":
        case "j":
        case "k":
        case "l":
        case "y":
        case "u":
        case "b":
        case "n":
        case "H":
        case "J":
        case "K":
        case "L":
        case "Y":
        case "U":
        case "B":
        case "N":
          return !this.dependencies.inputCommands.numberPadModeEnabled;
        case "1":
        case "2":
        case "3":
        case "4":
        case "6":
        case "7":
        case "8":
        case "9":
          return this.dependencies.inputCommands.numberPadModeEnabled;
        default:
          return false;
      }
    }

    switch (input) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
      case "Numpad1":
      case "Numpad2":
      case "Numpad3":
      case "Numpad4":
      case "Numpad5":
      case "Numpad6":
      case "Numpad7":
      case "Numpad8":
      case "Numpad9":
        return true;
      default:
        return false;
    }
  }

  getMovementDeltaFromInput(
    input: string,
  ): { dx: number; dy: number } | null {
    if (!this.isMovementInput(input)) {
      return null;
    }
    switch (input) {
      case "ArrowUp":
      case "Numpad8":
        return { dx: 0, dy: -1 };
      case "ArrowDown":
      case "Numpad2":
        return { dx: 0, dy: 1 };
      case "ArrowLeft":
      case "Numpad4":
        return { dx: -1, dy: 0 };
      case "ArrowRight":
      case "Numpad6":
        return { dx: 1, dy: 0 };
      case "Home":
      case "Numpad7":
        return { dx: -1, dy: -1 };
      case "PageUp":
      case "Numpad9":
        return { dx: 1, dy: -1 };
      case "End":
      case "Numpad1":
        return { dx: -1, dy: 1 };
      case "PageDown":
      case "Numpad3":
        return { dx: 1, dy: 1 };
      default:
        break;
    }

    const normalized = input.toLowerCase();
    switch (normalized) {
      case "k":
      case "8":
        return { dx: 0, dy: -1 };
      case "j":
      case "2":
        return { dx: 0, dy: 1 };
      case "h":
      case "4":
        return { dx: -1, dy: 0 };
      case "l":
      case "6":
        return { dx: 1, dy: 0 };
      case "y":
      case "7":
        return { dx: -1, dy: -1 };
      case "u":
      case "9":
        return { dx: 1, dy: -1 };
      case "b":
      case "1":
        return { dx: -1, dy: 1 };
      case "n":
      case "3":
        return { dx: 1, dy: 1 };
      default:
        return null;
    }
  }

  isRunMovementInput(input: string): boolean {
    return !this.dependencies.inputCommands.numberPadModeEnabled && /^[HJKLYUBN]$/.test(input);
  }

  isNumpadRunPrefixInput(input: string): boolean {
    return this.dependencies.inputCommands.numberPadModeEnabled && input === "Numpad5";
  }

  isRunPrefixInput(input: string): boolean {
    return input === "5" || this.isNumpadRunPrefixInput(input);
  }

  armPlayerCliparoundInputCooldown(): void {
    if (!this.dependencies.engineState.session) {
      return;
    }
    this.playerCliparoundInputCooldownUntilMs =
      Date.now() + this.playerCliparoundInputCooldownMs;
  }

  refreshPlayerCliparoundInputCooldownFromMovement(): void {
    const nowMs = Date.now();
    if (nowMs > this.playerCliparoundInputCooldownUntilMs) {
      return;
    }
    this.playerCliparoundInputCooldownUntilMs =
      nowMs + this.playerCliparoundInputCooldownMs;
  }

  clearPlayerCliparoundInputCooldown(): void {
    this.playerCliparoundInputCooldownUntilMs = 0;
  }

  isPlayerCliparoundInputCooldownActive(nowMs: number): boolean {
    return nowMs <= this.playerCliparoundInputCooldownUntilMs;
  }

  normalizeWaitKey(event: KeyboardEvent): string | null {
    if (event.key === ">") {
      return null;
    }
    if (
      event.key === "." ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.key === "Decimal" ||
      event.key === "NumpadDecimal" ||
      event.code === "NumpadDecimal" ||
      event.code === "Space"
    ) {
      return ".";
    }
    return null;
  }

  isCameraRelativeMovementEnabled(): boolean {
    // Terminal mode is a fixed north-up grid, independent of the orbit-camera
    // yaw retained from the 3D display modes. Applying that stale yaw here can
    // rotate the cardinal controls by 180 degrees even though the map itself is
    // rendered in the correct NetHack orientation.
    return (
      !this.isFpsMode() &&
      !this.dependencies.terminalRendering.isTerminalDisplayMode() &&
      this.dependencies.engineState.clientOptions.cameraRelativeMovement
    );
  }

  resolveCameraRelativeDirectionInputFromLocalDelta(
    localDx: number,
    localDy: number,
  ): string | null {
    const stepDx = THREE.MathUtils.clamp(Math.sign(localDx), -1, 1) as
      | -1
      | 0
      | 1;
    const stepDy = THREE.MathUtils.clamp(Math.sign(localDy), -1, 1) as
      | -1
      | 0
      | 1;
    if (stepDx === 0 && stepDy === 0) {
      return null;
    }
    const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
    if (!aim) {
      return this.getDirectionInputFromMapDelta(stepDx, stepDy);
    }
    const localRight = stepDx;
    const localForward = (stepDy * -1) as -1 | 0 | 1;
    return this.resolveFpsRelativeMovementInput(aim, localRight, localForward);
  }

  tryResolveCameraRelativeGameplayMovementInput(
    event: KeyboardEvent,
  ): string | null {
    if (!this.isCameraRelativeMovementEnabled()) {
      return null;
    }

    let logicalInput: string | null = null;
    let sourceIsNumpadDigit = false;
    if (event.code.startsWith("Numpad") && /^[1-9]$/.test(event.key)) {
      sourceIsNumpadDigit = true;
      if (this.dependencies.inputCommands.numberPadModeEnabled) {
        logicalInput = event.key;
      } else {
        logicalInput = this.mapNumpadDigitToDirectionKey(event.key);
      }
    } else {
      const mappedNavigationInput = this.mapDirectionalKeyFromNavigationInput(
        event.key,
      );
      if (mappedNavigationInput) {
        logicalInput = mappedNavigationInput;
      } else if (this.dependencies.inputCommands.numberPadModeEnabled && /^[1-9]$/.test(event.key)) {
        logicalInput = event.key;
      } else if (
        !this.dependencies.inputCommands.numberPadModeEnabled &&
        /^[hjklyubnHJKLYUBN]$/.test(event.key)
      ) {
        logicalInput = event.key;
      }
    }

    if (!logicalInput) {
      return null;
    }

    const localDirection = this.getDirectionVectorFromInput(logicalInput);
    if (!localDirection) {
      return null;
    }

    const mappedDirection =
      this.resolveCameraRelativeDirectionInputFromLocalDelta(
        localDirection.dx,
        localDirection.dy,
      );
    if (!mappedDirection) {
      return null;
    }

    let output = mappedDirection;
    if (/^[A-Z]$/.test(logicalInput) && /^[a-z]$/.test(output)) {
      output = output.toUpperCase();
    }
    if (
      sourceIsNumpadDigit &&
      this.dependencies.inputCommands.numberPadModeEnabled &&
      /^[1-9]$/.test(output)
    ) {
      return `Numpad${output}`;
    }
    return output;
  }

  resolveDirectionQuestionInputForCurrentCamera(
    directionKey: string,
  ): string | null {
    const normalized = String(directionKey).trim();
    if (!normalized) {
      return null;
    }
    if (!this.isCameraRelativeMovementEnabled()) {
      return normalized;
    }

    const localDirection = this.getDirectionVectorFromInput(normalized);
    if (!localDirection) {
      return normalized;
    }

    const mappedDirection =
      this.resolveCameraRelativeDirectionInputFromLocalDelta(
        localDirection.dx,
        localDirection.dy,
      );
    if (!mappedDirection) {
      return normalized;
    }

    let output = mappedDirection;
    if (/^[A-Z]$/.test(normalized) && /^[a-z]$/.test(output)) {
      output = output.toUpperCase();
    }
    if (
      /^Numpad[1-9]$/.test(normalized) &&
      this.dependencies.inputCommands.numberPadModeEnabled &&
      /^[1-9]$/.test(output)
    ) {
      output = `Numpad${output}`;
    }
    return output;
  }

  mapArrowKeyToDirectionKey(key: string): string | null {
    switch (key) {
      case "ArrowUp":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "8" : "k";
      case "ArrowDown":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "2" : "j";
      case "ArrowLeft":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "4" : "h";
      case "ArrowRight":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "6" : "l";
      default:
        return null;
    }
  }

  mapNavigationKeyToDirectionKey(key: string): string | null {
    switch (key) {
      case "Home":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "7" : "y";
      case "PageUp":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "9" : "u";
      case "End":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "1" : "b";
      case "PageDown":
        return this.dependencies.inputCommands.numberPadModeEnabled ? "3" : "n";
      default:
        return null;
    }
  }

  mapNumpadDigitToDirectionKey(digit: string): string | null {
    if (!/^[1-9]$/.test(digit)) {
      return null;
    }
    if (this.dependencies.inputCommands.numberPadModeEnabled) {
      return digit;
    }
    switch (digit) {
      case "1":
        return "b";
      case "2":
        return "j";
      case "3":
        return "n";
      case "4":
        return "h";
      case "5":
        return ".";
      case "6":
        return "l";
      case "7":
        return "y";
      case "8":
        return "k";
      case "9":
        return "u";
      default:
        return null;
    }
  }

  mapDirectionalKeyFromNavigationInput(key: string): string | null {
    return (
      this.mapArrowKeyToDirectionKey(key) ||
      this.mapNavigationKeyToDirectionKey(key)
    );
  }

  isFpsMode(): boolean {
    return this.dependencies.engineState.playMode === "fps";
  }

  isFpsWasdKeyboardMovementEnabled(): boolean {
    return this.dependencies.engineState.clientOptions.fpsWasdKeyboardMovementEnabled !== false;
  }

  isWasdKeyboardInput(key: string, code: string = ""): boolean {
    const normalizedKey = String(key || "").toLowerCase();
    if (
      normalizedKey === "w" ||
      normalizedKey === "a" ||
      normalizedKey === "s" ||
      normalizedKey === "d"
    ) {
      return true;
    }
    return (
      code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD"
    );
  }

  getDirectionInputFromMapDelta(dx: number, dy: number): string | null {
    if (dx === 0 && dy === 0) {
      return null;
    }
    if (this.dependencies.inputCommands.numberPadModeEnabled) {
      if (dx === 0 && dy < 0) return "8";
      if (dx === 0 && dy > 0) return "2";
      if (dx < 0 && dy === 0) return "4";
      if (dx > 0 && dy === 0) return "6";
      if (dx < 0 && dy < 0) return "7";
      if (dx > 0 && dy < 0) return "9";
      if (dx < 0 && dy > 0) return "1";
      if (dx > 0 && dy > 0) return "3";
      return null;
    }

    if (dx === 0 && dy < 0) return "k";
    if (dx === 0 && dy > 0) return "j";
    if (dx < 0 && dy === 0) return "h";
    if (dx > 0 && dy === 0) return "l";
    if (dx < 0 && dy < 0) return "y";
    if (dx > 0 && dy < 0) return "u";
    if (dx < 0 && dy > 0) return "b";
    if (dx > 0 && dy > 0) return "n";
    return null;
  }

  resolveFpsRelativeMovementInput(
    aim: AimDirection,
    localRight: -1 | 0 | 1,
    localForward: -1 | 0 | 1,
  ): string | null {
    if (localRight === 0 && localForward === 0) {
      return null;
    }

    // Basis vectors in map-space derived from current FPS aim.
    // forward = aim delta, right = 90deg clockwise from forward.
    const rightX = -aim.dy;
    const rightY = aim.dx;
    const rawDx = aim.dx * localForward + rightX * localRight;
    const rawDy = aim.dy * localForward + rightY * localRight;
    const stepDx = THREE.MathUtils.clamp(Math.sign(rawDx), -1, 1);
    const stepDy = THREE.MathUtils.clamp(Math.sign(rawDy), -1, 1);
    return this.getDirectionInputFromMapDelta(stepDx, stepDy);
  }

  tryResolveFpsMovementInput(
    key: string,
    code: string = "",
  ): string | null {
    const lower = key.toLowerCase();
    if (
      !this.isFpsWasdKeyboardMovementEnabled() &&
      this.isWasdKeyboardInput(key, code)
    ) {
      return null;
    }
    if (this.dependencies.inputCommands.numberPadModeEnabled && /^[hjklyubn]$/.test(lower)) {
      return null;
    }
    const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
    if (!aim) {
      return null;
    }

    if (code.startsWith("Numpad")) {
      switch (code) {
        case "Numpad8":
          return this.resolveFpsRelativeMovementInput(aim, 0, 1);
        case "Numpad2":
          return this.resolveFpsRelativeMovementInput(aim, 0, -1);
        case "Numpad4":
          return this.resolveFpsRelativeMovementInput(aim, -1, 0);
        case "Numpad6":
          return this.resolveFpsRelativeMovementInput(aim, 1, 0);
        case "Numpad7":
          return this.resolveFpsRelativeMovementInput(aim, -1, 1);
        case "Numpad9":
          return this.resolveFpsRelativeMovementInput(aim, 1, 1);
        case "Numpad1":
          return this.resolveFpsRelativeMovementInput(aim, -1, -1);
        case "Numpad3":
          return this.resolveFpsRelativeMovementInput(aim, 1, -1);
        default:
          break;
      }
    }

    switch (lower) {
      case "w":
      case "arrowup":
      case "k":
        return this.resolveFpsRelativeMovementInput(aim, 0, 1);
      case "s":
      case "arrowdown":
      case "j":
        return this.resolveFpsRelativeMovementInput(aim, 0, -1);
      case "a":
      case "arrowleft":
      case "h":
        return this.resolveFpsRelativeMovementInput(aim, -1, 0);
      case "d":
      case "arrowright":
      case "l":
        return this.resolveFpsRelativeMovementInput(aim, 1, 0);
      case "y":
      case "home":
        return this.resolveFpsRelativeMovementInput(aim, -1, 1);
      case "u":
      case "pageup":
        return this.resolveFpsRelativeMovementInput(aim, 1, 1);
      case "b":
      case "end":
        return this.resolveFpsRelativeMovementInput(aim, -1, -1);
      case "n":
      case "pagedown":
        return this.resolveFpsRelativeMovementInput(aim, 1, -1);
      default:
        return null;
    }
  }

  tryResolveFpsPositionLookInput(
    key: string,
    code: string = "",
  ): string | null {
    if (
      !this.isFpsWasdKeyboardMovementEnabled() &&
      this.isWasdKeyboardInput(key, code)
    ) {
      return null;
    }

    const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
    if (!aim) {
      return null;
    }

    if (code.startsWith("Numpad")) {
      switch (code) {
        case "Numpad8":
          return this.resolveFpsRelativeMovementInput(aim, 0, 1);
        case "Numpad2":
          return this.resolveFpsRelativeMovementInput(aim, 0, -1);
        case "Numpad4":
          return this.resolveFpsRelativeMovementInput(aim, -1, 0);
        case "Numpad6":
          return this.resolveFpsRelativeMovementInput(aim, 1, 0);
        case "Numpad7":
          return this.resolveFpsRelativeMovementInput(aim, -1, 1);
        case "Numpad9":
          return this.resolveFpsRelativeMovementInput(aim, 1, 1);
        case "Numpad1":
          return this.resolveFpsRelativeMovementInput(aim, -1, -1);
        case "Numpad3":
          return this.resolveFpsRelativeMovementInput(aim, 1, -1);
        default:
          break;
      }
    }

    switch (key.toLowerCase()) {
      case "w":
      case "arrowup":
      case "k":
        return this.resolveFpsRelativeMovementInput(aim, 0, 1);
      case "s":
      case "arrowdown":
      case "j":
        return this.resolveFpsRelativeMovementInput(aim, 0, -1);
      case "a":
      case "arrowleft":
      case "h":
        return this.resolveFpsRelativeMovementInput(aim, -1, 0);
      case "d":
      case "arrowright":
      case "l":
        return this.resolveFpsRelativeMovementInput(aim, 1, 0);
      case "home":
      case "y":
        return this.resolveFpsRelativeMovementInput(aim, -1, 1);
      case "pageup":
      case "u":
        return this.resolveFpsRelativeMovementInput(aim, 1, 1);
      case "end":
      case "b":
        return this.resolveFpsRelativeMovementInput(aim, -1, -1);
      case "pagedown":
      case "n":
        return this.resolveFpsRelativeMovementInput(aim, 1, -1);
      default:
        return null;
    }
  }

  fireInCurrentAimDirection(): void {
    this.armFpsFireSuppression();
    this.dependencies.aimHighlights.fpsAimLinePulseUntilMs = Date.now() + 220;
    // In FPS mode, fire should first ask for direction; the direction prompt
    // confirmation path (left-click/W/etc.) supplies the actual direction input.
    this.dependencies.audioHapticsPlatform.armPendingThrownWeaponDirectionSound();
    this.dependencies.inputCommands.sendInput("f");
  }

  armFpsFireSuppression(): void {
    if (!this.isFpsMode()) {
      return;
    }
    this.fpsFireSuppressionUntilMs =
      Date.now() + this.fpsFireSuppressionDurationMs;
  }

  clearFpsFireSuppression(): void {
    this.fpsFireSuppressionUntilMs = 0;
  }

  isFpsFireSuppressed(): boolean {
    return this.isFpsMode() && Date.now() < this.fpsFireSuppressionUntilMs;
  }

  shouldUseFpsSelfTileDirectionTarget(): boolean {
    if (!this.isFpsMode()) {
      return false;
    }
    if (this.dependencies.camera.cameraPitch > this.dependencies.camera.firstPersonPitchMin + 0.42) {
      return false;
    }
    const playerTile =
      this.dependencies.tileRendering.tileMap.get(`${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}`) ?? null;
    return Boolean(playerTile) && !Boolean(playerTile?.userData?.isWall);
  }

  getFpsDirectionQuestionInputFromAim(): string | null {
    if (this.shouldUseFpsSelfTileDirectionTarget()) {
      return "s";
    }
    const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
    return aim?.input ?? null;
  }

  tryResolveFpsDirectionQuestionInput(
    event: KeyboardEvent,
  ): string | null {
    const lowerKey = event.key.toLowerCase();
    if (
      !this.isFpsWasdKeyboardMovementEnabled() &&
      this.isWasdKeyboardInput(event.key, event.code)
    ) {
      return lowerKey === "s" ? "s" : null;
    }
    if (lowerKey === "a" || lowerKey === "d") {
      return "Escape";
    }
    if (lowerKey === "s") {
      return "s";
    }
    if (lowerKey === "w") {
      return this.getFpsDirectionQuestionInputFromAim();
    }
    if (event.key === "<" || event.key === ",") {
      return "<";
    }
    if (event.key === ">") {
      return ">";
    }
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space"
    ) {
      return this.getFpsDirectionQuestionInputFromAim();
    }
    return null;
  }

  resolveDirectionKeyFromDelta(
    dx: number,
    dy: number,
    deadzone: number,
  ): { dx: number; dy: number } | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < deadzone && absY < deadzone) {
      return null;
    }

    const axisBiasRatio = 0.55;
    if (absX <= absY * axisBiasRatio) {
      if (dy < 0) {
        return { dx: 0, dy: -1 };
      }
      return { dx: 0, dy: 1 };
    }
    if (absY <= absX * axisBiasRatio) {
      if (dx < 0) {
        return { dx: -1, dy: 0 };
      }
      return { dx: 1, dy: 0 };
    }

    if (dx < 0 && dy < 0) {
      return { dx: -1, dy: -1 };
    }
    if (dx > 0 && dy < 0) {
      return { dx: 1, dy: -1 };
    }
    if (dx < 0 && dy > 0) {
      return { dx: -1, dy: 1 };
    }
    return { dx: 1, dy: 1 };
  }

  resolveSwipeDirectionInput(dx: number, dy: number): string | null {
    const localDirection = this.resolveDirectionKeyFromDelta(dx, dy, 1);
    if (!localDirection) {
      return null;
    }
    if (this.isCameraRelativeMovementEnabled()) {
      return this.resolveCameraRelativeDirectionInputFromLocalDelta(
        localDirection.dx,
        localDirection.dy,
      );
    }
    return this.getDirectionInputFromMapDelta(
      localDirection.dx,
      localDirection.dy,
    );
  }

  resolveDirectionFromDelta(dx: number, dy: number): string | null {
    const direction = this.resolveDirectionKeyFromDelta(dx, dy, 0.25);
    if (!direction) {
      return null;
    }
    return this.getDirectionInputFromMapDelta(direction.dx, direction.dy);
  }
}
