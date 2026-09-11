import type {
  PendingCharacterDamage,
  DirectionalAttackContext,
  PointerAttackTargetContext,
  PendingFpsHeldWeaponMeleeSwipeContext,
  MonsterBillboardShatterOptions,
  DamageEffectOptions
} from "../shared/types";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { BillboardShatter } from "../effects/billboard-shatter";
import type { BloodParticles } from "../effects/blood-particles";
import type { Camera } from "../camera/camera";
import type { DamageFlashes } from "../effects/damage-flashes";
import type { DamageNumbers } from "../effects/damage-numbers";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { EntityMovement } from "./entity-movement";
import type { HeldWeapon } from "../rendering/held-weapon";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "./player-movement";
import type { RuntimeEntityTracking } from "./runtime-entity-tracking";
import type { TileRendering } from "../rendering/tile-rendering";
import type { WorldClassification } from "./world-classification";

export interface CombatAttributionDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "clearPendingIncomingDamageRumble"
    | "isMobileIosWebOrAndroidDevice"
    | "messageSoundHooks"
    | "pendingPlayerFootstepSoundArmed"
    | "triggerOutgoingDamageRumble"
    | "triggerPlayerDeathRumble"
    | "triggerPlayerKillRumble"
  >;
  readonly billboardShatter: Pick<
    BillboardShatter,
    "spawnMonsterBillboardShatterEffectAtTile"
  >;
  readonly bloodParticles: Pick<
    BloodParticles,
    "damageParticles"
    | "disposeDamageParticle"
    | "disposeMonsterBillboardShardParticle"
    | "monsterBillboardShardParticles"
    | "playerDeathBillboardSplitCount"
    | "playerDeathBloodMistCountMultiplier"
    | "spawnBloodEffects"
  >;
  readonly camera: Pick<
    Camera,
    "normalModePlayerMoveCameraFollowActive"
  >;
  readonly damageFlashes: Pick<
    DamageFlashes,
    "glyphDamageFlashes"
    | "glyphDamageShakes"
    | "monsterBillboardDamageFlashes"
    | "shouldUseMonsterBillboardDamageFlash"
    | "startGlyphDamageFlash"
    | "startGlyphDamageShake"
    | "startMonsterBillboardDamageFlash"
    | "stopGlyphDamageFlash"
    | "stopGlyphDamageShake"
    | "stopMonsterBillboardDamageFlash"
  >;
  readonly damageNumbers: Pick<
    DamageNumbers,
    "clearPlayerUiNumberParticles"
    | "disposePlayerDamageNumberParticle"
    | "playerDamageNumberParticles"
    | "spawnPlayerDamageNumberParticle"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
  >;
  readonly entityMovement: Pick<
    EntityMovement,
    "clearEntityMoveTransitions"
  >;
  readonly heldWeapon: Pick<
    HeldWeapon,
    "playFpsHeldWeaponSwipeAnimation"
  >;
  readonly minimap: Pick<
    Minimap,
    "minimapTrackedPlayerTileKey"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "clearPlayerCliparoundInputCooldown"
    | "getDirectionVectorFromInput"
    | "getMovementDeltaFromInput"
    | "isFpsMode"
    | "resolveDirectionFromDelta"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasSeenPlayerPosition"
    | "playerPos"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "pendingRuntimeMonsterVacatedTileKeyById"
    | "runtimeMonsterIdByTileKey"
    | "runtimeMonsterLastSeenStateById"
    | "runtimeMonsterTileKeyById"
    | "runtimeTrackedPlayerEntitySeen"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "classifyTilePayload"
    | "isDamageFlashableBehavior"
  >;
}

/** Combat message interpretation, attack targeting, damage attribution and effect dispatch. */
export class CombatAttribution {
  constructor(private readonly dependencies: CombatAttributionDependencies) {}

  pendingCharacterDamageQueue: PendingCharacterDamage[] = [];

  readonly pendingCharacterDamageMaxAgeMs: number = 420;

  lastParsedDamageMessage: string = "";

  lastParsedDamageAtMs: number = 0;

  lastParsedDefeatMessage: string = "";

  lastParsedDefeatAtMs: number = 0;

  runtimeMonsterKillHeuristicSuppressionUntilMs: number = 0;

  suppressNextFpsHeldWeaponMissedAttackMessageSound: boolean = false;

  lastDirectionalAttackContext: DirectionalAttackContext | null = null;

  readonly directionalAttackContextMaxAgeMs: number = 900;

  pendingFpsHeldWeaponMeleeSwipeContext: PendingFpsHeldWeaponMeleeSwipeContext | null =
    null;

  readonly fpsHeldWeaponMeleeSwipeContextMaxAgeMs: number = 900;

  pendingPointerAttackTargetContext: PointerAttackTargetContext | null =
    null;

  readonly pointerAttackTargetContextMaxAgeMs: number = 1800;

  hasTriggeredPlayerDeathEffect: boolean = false;

  triggerPlayerDeathEffects(): void {
    if (this.hasTriggeredPlayerDeathEffect) {
      return;
    }
    this.hasTriggeredPlayerDeathEffect = true;
    this.dependencies.audioHapticsPlatform.triggerPlayerDeathRumble();

    if (!this.dependencies.playerMovement.hasSeenPlayerPosition) {
      this.dependencies.audioHapticsPlatform.messageSoundHooks.playDamageEffectSound("defeat");
      return;
    }

    this.triggerDamageEffectsAtTile(
      this.dependencies.playerMovement.playerPos.x,
      this.dependencies.playerMovement.playerPos.y,
      1,
      "defeat",
      {
        bloodMistCountMultiplier: this.dependencies.audioHapticsPlatform.isMobileIosWebOrAndroidDevice()
          ? 1
          : this.dependencies.bloodParticles.playerDeathBloodMistCountMultiplier,
        radialBloodMistSpread: true,
        bloodMistHorizontalSpeedMultiplier: 0.5,
        bloodMistVerticalSpeedMultiplier: 0.72,
        billboardShatter: {
          persistShardsOnGround: true,
          removeSourceBillboard: true,
          splitTargetCountOverride: this.dependencies.bloodParticles.playerDeathBillboardSplitCount,
        },
      },
    );
  }

  extractDamageAmountFromMessage(message: string): number | null {
    const patterns = [
      /\bfor\s+(-?\d+)\s+damage\b/i,
      /\btakes?\s+(-?\d+)\s+damage\b/i,
      /\bdeals?\s+(-?\d+)\s+damage\b/i,
      /\b(-?\d+)\s+points?\s+of\s+damage\b/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (!match || !match[1]) {
        continue;
      }

      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed !== 0) {
        return Math.abs(parsed);
      }
    }

    return null;
  }

  isPlayerAttackMessage(message: string): boolean {
    if (/\byou miss\b/i.test(message)) {
      return false;
    }
    return /\byou\s+(?:hit|bite|kick|claw|slash|strike|punch|shoot|zap|stab|maul|wound|smite|throw|thrust)\b/i.test(
      message,
    );
  }

  isPlayerMeleeAttackMessage(message: string): boolean {
    if (this.isPlayerMissMonsterMessage(message)) {
      return false;
    }
    return /\byou\s+(?:hit|bite|kick|claw|slash|strike|punch|stab|maul|wound|smite|thrust)\b/i.test(
      message,
    );
  }

  isPlayerMissMonsterMessage(message: string): boolean {
    return /\byou\s+(?:just\s+)?miss\b/i.test(message);
  }

  isPlayerHitMonsterMessage(message: string): boolean {
    return /\byou hit (?:the |an? )?.+[.!]?$/i.test(message);
  }

  isMonsterDefeatMessage(message: string): boolean {
    return /\byou (?:kill|kills|killed|smite|destroy|destroys|destroyed) (?:the |an? )?.+[.!]?$/i.test(
      message,
    );
  }

  isAnyKillMessage(message: string): boolean {
    return /\b(?:kill|kills|killed)\b/i.test(message);
  }

  updateDirectionalAttackContext(input: string): void {
    const direction = this.dependencies.movementInput.getDirectionVectorFromInput(input);
    if (!direction) {
      return;
    }
    this.lastDirectionalAttackContext = {
      dx: direction.dx,
      dy: direction.dy,
      originX: this.dependencies.playerMovement.playerPos.x,
      originY: this.dependencies.playerMovement.playerPos.y,
      capturedAtMs: Date.now(),
    };
  }

  updateDirectionalAttackContextFromTarget(
    targetX: number,
    targetY: number,
  ): void {
    const dx = targetX - this.dependencies.playerMovement.playerPos.x;
    const dy = targetY - this.dependencies.playerMovement.playerPos.y;
    const direction = this.dependencies.movementInput.resolveDirectionFromDelta(dx, dy);
    if (!direction) {
      return;
    }
    this.updateDirectionalAttackContext(direction);
  }

  armPendingFpsHeldWeaponMeleeSwipeFromMovementInput(
    input: string,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      this.pendingFpsHeldWeaponMeleeSwipeContext = null;
      return;
    }

    const direction = this.dependencies.movementInput.getMovementDeltaFromInput(input);
    if (!direction) {
      return;
    }

    const targetX = this.dependencies.playerMovement.playerPos.x + direction.dx;
    const targetY = this.dependencies.playerMovement.playerPos.y + direction.dy;
    if (!this.isMonsterAttackTargetTile(targetX, targetY)) {
      this.pendingFpsHeldWeaponMeleeSwipeContext = null;
      return;
    }

    this.pendingFpsHeldWeaponMeleeSwipeContext = {
      x: targetX,
      y: targetY,
      capturedAtMs: Date.now(),
    };
  }

  tryPlayFpsHeldWeaponSwipeFromPendingMeleeAttack(
    nowMs: number = Date.now(),
  ): boolean {
    const context = this.pendingFpsHeldWeaponMeleeSwipeContext;
    if (!context) {
      return false;
    }

    if (
      nowMs - context.capturedAtMs >
      this.fpsHeldWeaponMeleeSwipeContextMaxAgeMs
    ) {
      this.pendingFpsHeldWeaponMeleeSwipeContext = null;
      return false;
    }

    this.pendingFpsHeldWeaponMeleeSwipeContext = null;
    this.dependencies.heldWeapon.playFpsHeldWeaponSwipeAnimation();
    return true;
  }

  captureFpsHeldWeaponSwipeFromCombatMessage(
    messageLike: unknown,
  ): void {
    if (!this.dependencies.movementInput.isFpsMode() || typeof messageLike !== "string") {
      return;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const isMissMessage = this.isPlayerMissMonsterMessage(normalized);
    const shouldPlaySwipe =
      isMissMessage ||
      this.isPlayerMeleeAttackMessage(normalized) ||
      this.isMonsterDefeatMessage(normalized);
    if (!shouldPlaySwipe) {
      return;
    }

    if (!this.tryPlayFpsHeldWeaponSwipeFromPendingMeleeAttack()) {
      return;
    }

    this.suppressNextFpsHeldWeaponMissedAttackMessageSound = isMissMessage;
  }

  consumeFpsHeldWeaponMissedAttackMessageSoundSuppression(
    message: string,
  ): boolean {
    const shouldSuppress =
      this.suppressNextFpsHeldWeaponMissedAttackMessageSound &&
      this.isPlayerMissMonsterMessage(message);
    this.suppressNextFpsHeldWeaponMissedAttackMessageSound = false;
    return shouldSuppress;
  }

  isMonsterAttackTargetTile(x: number, y: number): boolean {
    if (x === this.dependencies.playerMovement.playerPos.x && y === this.dependencies.playerMovement.playerPos.y) {
      return false;
    }
    const key = `${x},${y}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    return (
      Boolean(mesh?.userData?.isMonsterLikeCharacter) ||
      this.dependencies.entityBillboards.monsterBillboards.has(key)
    );
  }

  resolveDamageEffectDirectionFromTiles(
    origin: { x: number; y: number } | null,
    target: { x: number; y: number } | null,
  ): { x: number; y: number } | null {
    if (!origin || !target) {
      return null;
    }

    const deltaX = Number(target.x) - Number(origin.x);
    const deltaY = Number(target.y) - Number(origin.y);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      return null;
    }

    const magnitude = Math.hypot(deltaX, deltaY);
    if (magnitude < 1e-6) {
      return null;
    }

    return {
      x: deltaX / magnitude,
      y: -deltaY / magnitude,
    };
  }

  suppressMonsterKillMessageHeuristics(): void {
    this.runtimeMonsterKillHeuristicSuppressionUntilMs = Date.now() + 180;
  }

  setPendingPointerAttackTargetFromTile(x: number, y: number): void {
    if (!this.isMonsterAttackTargetTile(x, y)) {
      this.pendingPointerAttackTargetContext = null;
      return;
    }
    this.pendingPointerAttackTargetContext = {
      x,
      y,
      capturedAtMs: Date.now(),
    };
  }

  getRecentPointerAttackTarget(
    nowMs: number,
  ): { x: number; y: number } | null {
    const context = this.pendingPointerAttackTargetContext;
    if (!context) {
      return null;
    }
    if (
      nowMs - context.capturedAtMs >
      this.pointerAttackTargetContextMaxAgeMs
    ) {
      return null;
    }
    return { x: context.x, y: context.y };
  }

  tryTriggerPointerMonsterHitSpray(amount: number): boolean {
    const target = this.getRecentPointerAttackTarget(Date.now());
    if (!target) {
      return false;
    }
    this.triggerDamageEffectsAtTile(target.x, target.y, amount, "hit");
    return true;
  }

  tryTriggerPointerMonsterDefeatSpray(): boolean {
    const target = this.getRecentPointerAttackTarget(Date.now());
    if (!target) {
      return false;
    }
    this.triggerDamageEffectsAtTile(target.x, target.y, 1, "defeat");
    return true;
  }

  getRecentDirectionalAttackContext(
    nowMs: number,
  ): DirectionalAttackContext | null {
    const context = this.lastDirectionalAttackContext;
    if (!context) {
      return null;
    }
    if (nowMs - context.capturedAtMs > this.directionalAttackContextMaxAgeMs) {
      return null;
    }
    return { ...context };
  }

  isTileInDirectionalAttackPath(
    tileX: number,
    tileY: number,
    context: DirectionalAttackContext | null,
  ): boolean {
    if (!context) {
      return false;
    }

    const deltaX = tileX - context.originX;
    const deltaY = tileY - context.originY;
    if (deltaX === 0 && deltaY === 0) {
      return false;
    }

    return Math.sign(deltaX) === context.dx && Math.sign(deltaY) === context.dy;
  }

  getLatestDirectionalAttackContext(): DirectionalAttackContext | null {
    const context = this.lastDirectionalAttackContext;
    return context ? { ...context } : null;
  }

  findDirectionalMonsterTarget(
    context: DirectionalAttackContext,
  ): { x: number; y: number } | null {
    let targetX: number | null = null;
    let targetY: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [key, mesh] of this.dependencies.tileRendering.tileMap.entries()) {
      if (!mesh.userData?.isMonsterLikeCharacter) {
        continue;
      }
      const [rawX, rawY] = key.split(",");
      const x = Number.parseInt(rawX, 10);
      const y = Number.parseInt(rawY, 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      if (!this.isTileInDirectionalAttackPath(x, y, context)) {
        continue;
      }
      const distance = Math.max(
        Math.abs(x - context.originX),
        Math.abs(y - context.originY),
      );
      if (distance < 1 || distance >= bestDistance) {
        continue;
      }
      bestDistance = distance;
      targetX = x;
      targetY = y;
    }

    if (targetX === null || targetY === null) {
      return null;
    }
    return { x: targetX, y: targetY };
  }

  captureMonsterDefeatFromMessage(messageLike: unknown): boolean {
    if (typeof messageLike !== "string") {
      return false;
    }

    if (Date.now() < this.runtimeMonsterKillHeuristicSuppressionUntilMs) {
      return false;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized || !this.isMonsterDefeatMessage(normalized)) {
      return false;
    }

    const now = Date.now();
    if (
      normalized === this.lastParsedDefeatMessage &&
      now - this.lastParsedDefeatAtMs < 120
    ) {
      return true;
    }

    this.lastParsedDefeatMessage = normalized;
    this.lastParsedDefeatAtMs = now;
    this.dependencies.audioHapticsPlatform.triggerPlayerKillRumble();
    if (this.tryTriggerPointerMonsterDefeatSpray()) {
      return true;
    }
    this.tryTriggerDirectionalMonsterDefeatSpray();
    return true;
  }

  captureOtherMonsterKilledSoundFromMessage(
    messageLike: unknown,
    playerKillHandled: boolean,
  ): void {
    if (playerKillHandled || typeof messageLike !== "string") {
      return;
    }
    if (Date.now() < this.runtimeMonsterKillHeuristicSuppressionUntilMs) {
      return;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized || !this.isAnyKillMessage(normalized)) {
      return;
    }
    this.dependencies.audioHapticsPlatform.messageSoundHooks.playOtherMonsterKilledSound();
  }

  queuePendingCharacterDamage(amount: number): void {
    const sanitized = Math.max(1, Math.round(Math.abs(amount)));
    const now = Date.now();
    this.pendingCharacterDamageQueue.push({
      amount: sanitized,
      createdAtMs: now,
      expectedDirection: this.getRecentDirectionalAttackContext(now),
      expectedTile: this.getRecentPointerAttackTarget(now),
    });

    if (this.pendingCharacterDamageQueue.length > 8) {
      this.pendingCharacterDamageQueue.splice(
        0,
        this.pendingCharacterDamageQueue.length - 8,
      );
    }
  }

  prunePendingCharacterDamage(nowMs: number): void {
    this.pendingCharacterDamageQueue = this.pendingCharacterDamageQueue.filter(
      (entry) =>
        nowMs - entry.createdAtMs <= this.pendingCharacterDamageMaxAgeMs,
    );
  }

  tryTriggerDirectionalMonsterHitSpray(amount: number): boolean {
    const now = Date.now();
    const context = this.getRecentDirectionalAttackContext(now);
    if (!context) {
      return false;
    }

    const target = this.findDirectionalMonsterTarget(context);
    if (!target) {
      return false;
    }

    this.triggerDamageEffectsAtTile(target.x, target.y, amount, "hit");
    return true;
  }

  tryTriggerDirectionalMonsterDefeatSpray(): boolean {
    const context = this.getLatestDirectionalAttackContext();
    if (!context) {
      return false;
    }

    const target = this.findDirectionalMonsterTarget(context);
    if (target) {
      this.triggerDamageEffectsAtTile(target.x, target.y, 1, "defeat");
      return true;
    }

    const fallbackX = context.originX + context.dx;
    const fallbackY = context.originY + context.dy;
    this.triggerDamageEffectsAtTile(fallbackX, fallbackY, 1, "defeat");
    return true;
  }

  captureDamageFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }
    if (this.isMonsterDefeatMessage(normalized)) {
      return;
    }

    const explicitPlayerHit = this.isPlayerHitMonsterMessage(normalized);
    const playerAttack =
      explicitPlayerHit || this.isPlayerAttackMessage(normalized);
    if (!playerAttack) {
      return;
    }

    let amount = this.extractDamageAmountFromMessage(normalized);
    if (!amount) {
      // No explicit number from NetHack? still produce a lightweight hit cue.
      amount = 1;
    }
    if (!amount) {
      return;
    }

    const now = Date.now();
    if (
      normalized === this.lastParsedDamageMessage &&
      now - this.lastParsedDamageAtMs < 120
    ) {
      return;
    }
    this.lastParsedDamageMessage = normalized;
    this.lastParsedDamageAtMs = now;
    this.dependencies.audioHapticsPlatform.triggerOutgoingDamageRumble();

    if (this.tryTriggerPointerMonsterHitSpray(amount)) {
      return;
    }

    if (this.tryTriggerDirectionalMonsterHitSpray(amount)) {
      return;
    }

    this.queuePendingCharacterDamage(amount);
  }

  tryResolvePendingCharacterDamage(tile: any): void {
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const now = Date.now();
    this.prunePendingCharacterDamage(now);
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const behavior = this.dependencies.worldClassification.classifyTilePayload(tile);
    if (
      !behavior ||
      behavior.isPlayerGlyph ||
      !this.dependencies.worldClassification.isDamageFlashableBehavior(behavior)
    ) {
      return;
    }

    if (typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }

    const queueIndex = this.pendingCharacterDamageQueue.findIndex((entry) => {
      if (
        entry.expectedTile &&
        entry.expectedTile.x === tile.x &&
        entry.expectedTile.y === tile.y
      ) {
        return true;
      }
      return this.isTileInDirectionalAttackPath(
        tile.x,
        tile.y,
        entry.expectedDirection,
      );
    });
    if (queueIndex < 0) {
      return;
    }

    const [nextDamage] = this.pendingCharacterDamageQueue.splice(queueIndex, 1);
    if (!nextDamage) {
      return;
    }

    this.triggerDamageEffectsAtTile(tile.x, tile.y, nextDamage.amount);
  }

  triggerDamageEffectsAtTile(
    x: number,
    y: number,
    amount: number,
    variant: "hit" | "defeat" = "hit",
    options: DamageEffectOptions = {},
  ): void {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(amount)
    ) {
      return;
    }

    const damage = Math.max(1, Math.round(Math.abs(amount)));
    this.dependencies.audioHapticsPlatform.messageSoundHooks.playDamageEffectSound(variant);
    const key = `${x},${y}`;
    const hadElevatedBillboard = this.dependencies.entityBillboards.monsterBillboards.has(key);
    if (variant === "defeat") {
      if (this.dependencies.engineState.clientOptions.monsterShatter) {
        const shatterOptions: MonsterBillboardShatterOptions = {
          ...options.billboardShatter,
        };
        if (
          typeof shatterOptions.directionX !== "number" &&
          typeof options.directionX === "number"
        ) {
          shatterOptions.directionX = options.directionX;
        }
        if (
          typeof shatterOptions.directionY !== "number" &&
          typeof options.directionY === "number"
        ) {
          shatterOptions.directionY = options.directionY;
        }
        this.dependencies.billboardShatter.spawnMonsterBillboardShatterEffectAtTile(x, y, shatterOptions);
      }
    }
    const useMonsterBillboardFlash =
      this.dependencies.damageFlashes.shouldUseMonsterBillboardDamageFlash(key);
    const isPlayerTarget = x === this.dependencies.playerMovement.playerPos.x && y === this.dependencies.playerMovement.playerPos.y;
    const suppressPlayerTileFlash =
      isPlayerTarget && this.dependencies.engineState.clientOptions.tilesetMode === "tiles";
    const usePlayerBillboardFlash =
      suppressPlayerTileFlash && hadElevatedBillboard;
    const useBillboardFlash =
      useMonsterBillboardFlash || usePlayerBillboardFlash;
    const suppressTileFlashForTilesBillboard =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" && hadElevatedBillboard;
    if (variant === "hit" || variant === "defeat") {
      if (useBillboardFlash) {
        this.dependencies.damageFlashes.stopGlyphDamageFlash(key);
        this.dependencies.damageFlashes.startMonsterBillboardDamageFlash(key);
      } else if (
        !suppressPlayerTileFlash &&
        !suppressTileFlashForTilesBillboard
      ) {
        this.dependencies.damageFlashes.startGlyphDamageFlash(key);
      } else {
        this.dependencies.damageFlashes.stopGlyphDamageFlash(key);
      }
    }
    if (
      isPlayerTarget &&
      variant === "hit" &&
      this.dependencies.engineState.clientOptions.damageNumbers
    ) {
      this.dependencies.damageNumbers.spawnPlayerDamageNumberParticle(x, y, damage);
    }
    if (this.dependencies.engineState.clientOptions.tileShakeOnHit) {
      this.dependencies.damageFlashes.startGlyphDamageShake(x, y, variant, {
        spriteOnly: false,
      });
    }
    if (this.dependencies.engineState.clientOptions.bloodMist || this.dependencies.engineState.clientOptions.bloodGround) {
      this.dependencies.bloodParticles.spawnBloodEffects(x, y, damage, variant, {
        directionX: options.directionX,
        directionY: options.directionY,
        horizontalSpeedMultiplier: options.bloodMistHorizontalSpeedMultiplier,
        mistParticleCountMultiplier: options.bloodMistCountMultiplier,
        radialSpread: options.radialBloodMistSpread,
        verticalSpeedMultiplier: options.bloodMistVerticalSpeedMultiplier,
      });
    }
  }

  clearDamageEffects(): void {
    const flashKeys = Array.from(this.dependencies.damageFlashes.glyphDamageFlashes.keys());
    for (const key of flashKeys) {
      this.dependencies.damageFlashes.stopGlyphDamageFlash(key);
    }
    const billboardFlashKeys = Array.from(
      this.dependencies.damageFlashes.monsterBillboardDamageFlashes.keys(),
    );
    for (const key of billboardFlashKeys) {
      this.dependencies.damageFlashes.stopMonsterBillboardDamageFlash(key);
    }

    const shakeKeys = Array.from(this.dependencies.damageFlashes.glyphDamageShakes.keys());
    for (const key of shakeKeys) {
      this.dependencies.damageFlashes.stopGlyphDamageShake(key);
    }

    for (let i = this.dependencies.bloodParticles.damageParticles.length - 1; i >= 0; i -= 1) {
      this.dependencies.bloodParticles.disposeDamageParticle(i);
    }
    for (
      let i = this.dependencies.bloodParticles.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      this.dependencies.bloodParticles.disposeMonsterBillboardShardParticle(i);
    }
    for (let i = this.dependencies.damageNumbers.playerDamageNumberParticles.length - 1; i >= 0; i -= 1) {
      this.dependencies.damageNumbers.disposePlayerDamageNumberParticle(i);
    }
    this.dependencies.damageNumbers.clearPlayerUiNumberParticles();

    this.pendingCharacterDamageQueue = [];
    this.dependencies.audioHapticsPlatform.clearPendingIncomingDamageRumble();
    this.lastDirectionalAttackContext = null;
    this.pendingFpsHeldWeaponMeleeSwipeContext = null;
    this.pendingPointerAttackTargetContext = null;
    this.suppressNextFpsHeldWeaponMissedAttackMessageSound = false;
    this.lastParsedDamageMessage = "";
    this.lastParsedDamageAtMs = 0;
    this.lastParsedDefeatMessage = "";
    this.lastParsedDefeatAtMs = 0;
    this.runtimeMonsterKillHeuristicSuppressionUntilMs = 0;
    this.dependencies.runtimeEntityTracking.runtimeTrackedPlayerEntitySeen = false;
    this.dependencies.minimap.minimapTrackedPlayerTileKey = null;
    this.dependencies.camera.normalModePlayerMoveCameraFollowActive = false;
    this.dependencies.runtimeEntityTracking.runtimeMonsterTileKeyById.clear();
    this.dependencies.runtimeEntityTracking.runtimeMonsterIdByTileKey.clear();
    this.dependencies.runtimeEntityTracking.pendingRuntimeMonsterVacatedTileKeyById.clear();
    this.dependencies.runtimeEntityTracking.runtimeMonsterLastSeenStateById.clear();
    this.dependencies.entityMovement.clearEntityMoveTransitions();
    this.dependencies.audioHapticsPlatform.pendingPlayerFootstepSoundArmed = false;
    this.dependencies.movementInput.clearPlayerCliparoundInputCooldown();
    this.dependencies.audioHapticsPlatform.messageSoundHooks.reset();
  }
}
