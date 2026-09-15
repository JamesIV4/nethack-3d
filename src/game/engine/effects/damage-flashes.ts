import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import type {
  GlyphDamageFlashState,
  MonsterBillboardDamageFlashState,
  GlyphDamageShakeState
} from "../shared/types";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { GlyphTextures } from "../rendering/glyph-textures";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface DamageFlashesDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "elevatedMonsterZ"
    | "entityBlobShadows"
    | "monsterBillboards"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "drawGlyphTextureToCanvas"
    | "glyphOverlayMap"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
  >;
}

/** Glyph and billboard damage flash/shake animation state */
export class DamageFlashes {
  constructor(private readonly dependencies: DamageFlashesDependencies) {}

  readonly glyphDamageFlashDurationMs: number = 180;

  readonly monsterBillboardDamageFlashDurationMs: number = 320;

  readonly glyphDamageFlashTextureSize: number = 256;

  readonly glyphDamageFlashRed = new THREE.Color("#ff2d2d");

  readonly glyphDamageFlashWhite = new THREE.Color("#ffffff");

  readonly glyphDamageFlashColor = new THREE.Color("#ffffff");

  glyphDamageFlashes: Map<string, GlyphDamageFlashState> = new Map();

  monsterBillboardDamageFlashes: Map<
    string,
    MonsterBillboardDamageFlashState
  > = new Map();

  glyphDamageShakes: Map<string, GlyphDamageShakeState> = new Map();

  readonly glyphDamageShakeDurationMs: number = 155;

  readonly glyphDefeatShakeDurationMs: number = 240;

  readonly glyphDamageShakeAmplitude: number = TILE_SIZE * 0.08;

  readonly glyphDefeatShakeAmplitude: number = TILE_SIZE * 0.14;

  startGlyphDamageFlash(key: string): void {
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
    if (
      !mesh ||
      !overlay ||
      !overlay.texture ||
      !mesh.userData ||
      !mesh.userData.isDamageFlashableCharacter
    ) {
      return;
    }

    const useOverlayTint =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" &&
      Boolean(mesh.userData.isPlayerGlyph);
    const glyphChar =
      typeof mesh.userData.glyphChar === "string"
        ? mesh.userData.glyphChar
        : "";
    if (!useOverlayTint && !glyphChar.trim()) {
      return;
    }

    const baseColorHex =
      typeof mesh.userData.glyphBaseColorHex === "string" &&
      mesh.userData.glyphBaseColorHex
        ? mesh.userData.glyphBaseColorHex
        : overlay.baseColorHex;
    const darkenFactor =
      typeof mesh.userData.glyphDarkenFactor === "number"
        ? THREE.MathUtils.clamp(mesh.userData.glyphDarkenFactor, 0, 1)
        : 1;
    const nextMode = useOverlayTint ? "overlay_tint" : "glyph_texture";

    let state = this.glyphDamageFlashes.get(key);
    if (!state || state.mode !== nextMode) {
      if (state?.texture) {
        state.texture.dispose();
      }

      if (nextMode === "glyph_texture") {
        const canvas = document.createElement("canvas");
        const size = this.glyphDamageFlashTextureSize;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        state = {
          key,
          mode: nextMode,
          canvas,
          context,
          texture,
          elapsedMs: 0,
          durationMs: this.glyphDamageFlashDurationMs,
          baseColorHex,
          glyphChar,
          darkenFactor,
        };
      } else {
        state = {
          key,
          mode: nextMode,
          canvas: null,
          context: null,
          texture: null,
          elapsedMs: 0,
          durationMs: this.glyphDamageFlashDurationMs,
          baseColorHex,
          glyphChar,
          darkenFactor,
        };
      }
      this.glyphDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.baseColorHex = baseColorHex;
      state.glyphChar = glyphChar;
      state.darkenFactor = darkenFactor;
    }

    overlay.material.map =
      state.mode === "glyph_texture" && state.texture
        ? state.texture
        : overlay.texture;
    overlay.material.needsUpdate = true;
    this.renderGlyphDamageFlash(state, 1);
  }

  getGlyphDamageFlashIntensity(state: GlyphDamageFlashState): number {
    const progress = THREE.MathUtils.clamp(
      state.elapsedMs / state.durationMs,
      0,
      1,
    );
    return Math.exp(-8.5 * progress);
  }

  renderGlyphDamageFlash(
    state: GlyphDamageFlashState,
    intensity: number,
  ): void {
    const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(state.key);
    if (!overlay) {
      return;
    }

    const clamped = THREE.MathUtils.clamp(intensity, 0, 1);
    this.glyphDamageFlashColor
      .copy(this.glyphDamageFlashWhite)
      .lerp(this.glyphDamageFlashRed, clamped);
    if (state.mode === "overlay_tint") {
      overlay.material.map = overlay.texture;
      overlay.material.color.copy(this.glyphDamageFlashColor);
      overlay.material.needsUpdate = true;
      return;
    }

    if (!state.context || !state.canvas || !state.texture) {
      return;
    }

    const flashTextColor = `#${this.glyphDamageFlashColor.getHexString()}`;
    this.dependencies.glyphTextures.drawGlyphTextureToCanvas(
      state.context,
      state.canvas.width,
      state.baseColorHex,
      state.glyphChar,
      flashTextColor,
      state.darkenFactor,
    );
    state.texture.needsUpdate = true;
    overlay.material.map = state.texture;
    overlay.material.color.copy(this.glyphDamageFlashWhite);
    overlay.material.needsUpdate = true;
  }

  stopGlyphDamageFlash(key: string): void {
    const state = this.glyphDamageFlashes.get(key);
    if (!state) {
      return;
    }

    const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.map = overlay.texture;
      overlay.material.color.copy(this.glyphDamageFlashWhite);
      overlay.material.needsUpdate = true;
    }

    state.texture?.dispose();
    this.glyphDamageFlashes.delete(key);
  }

  shouldUseMonsterBillboardDamageFlash(key: string): boolean {
    if (this.dependencies.engineState.clientOptions.tilesetMode !== "tiles") {
      return false;
    }
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh || !mesh.userData?.isMonsterLikeCharacter) {
      return false;
    }
    return this.dependencies.entityBillboards.monsterBillboards.has(key);
  }

  startMonsterBillboardDamageFlash(key: string): void {
    const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
    if (!sprite) {
      return;
    }
    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      return;
    }

    let state = this.monsterBillboardDamageFlashes.get(key);
    if (!state) {
      state = {
        key,
        elapsedMs: 0,
        durationMs: this.monsterBillboardDamageFlashDurationMs,
      };
      this.monsterBillboardDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.durationMs = this.monsterBillboardDamageFlashDurationMs;
    }

    // Change to red directly on the billboard material.
    material.color.set(0xff0000);
  }

  stopMonsterBillboardDamageFlash(key: string): void {
    const state = this.monsterBillboardDamageFlashes.get(key);
    if (!state) {
      return;
    }

    const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
    if (sprite && sprite.material instanceof THREE.SpriteMaterial) {
      sprite.material.color.copy(this.glyphDamageFlashWhite);
    }

    this.monsterBillboardDamageFlashes.delete(key);
  }

  updateMonsterBillboardDamageFlashes(deltaSeconds: number): void {
    if (this.monsterBillboardDamageFlashes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.monsterBillboardDamageFlashes.entries());
    for (const [key, state] of entries) {
      const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
      if (!sprite || !(sprite.material instanceof THREE.SpriteMaterial)) {
        this.stopMonsterBillboardDamageFlash(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const intensity = Math.exp(-8.5 * progress);
      this.glyphDamageFlashColor
        .copy(this.glyphDamageFlashWhite)
        .lerp(this.glyphDamageFlashRed, intensity);
      sprite.material.color.copy(this.glyphDamageFlashColor);

      if (progress >= 1) {
        this.stopMonsterBillboardDamageFlash(key);
      }
    }
  }

  updateGlyphDamageFlashes(deltaSeconds: number): void {
    if (this.glyphDamageFlashes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.glyphDamageFlashes.entries());

    for (const [key, state] of entries) {
      if (!this.dependencies.tileRendering.tileMap.has(key) || !this.dependencies.glyphTextures.glyphOverlayMap.has(key)) {
        this.stopGlyphDamageFlash(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const intensity = this.getGlyphDamageFlashIntensity(state);
      this.renderGlyphDamageFlash(state, intensity);

      if (progress >= 1) {
        this.stopGlyphDamageFlash(key);
      }
    }
  }

  startGlyphDamageShake(
    tileX: number,
    tileY: number,
    variant: "hit" | "defeat",
    options?: { spriteOnly?: boolean },
  ): void {
    const key = `${tileX},${tileY}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
    const spriteOnly = options?.spriteOnly === true;
    if (!mesh && !sprite) {
      return;
    }
    if (spriteOnly && !sprite) {
      return;
    }

    const amplitude =
      variant === "defeat"
        ? this.glyphDefeatShakeAmplitude
        : this.glyphDamageShakeAmplitude;
    const durationMs =
      variant === "defeat"
        ? this.glyphDefeatShakeDurationMs
        : this.glyphDamageShakeDurationMs;

    const existing = this.glyphDamageShakes.get(key);
    if (existing) {
      existing.elapsedMs = 0;
      existing.durationMs = Math.max(existing.durationMs, durationMs);
      existing.amplitude = Math.max(existing.amplitude, amplitude);
      existing.spriteOnly = existing.spriteOnly && spriteOnly;
      return;
    }

    this.glyphDamageShakes.set(key, {
      key,
      tileX,
      tileY,
      elapsedMs: 0,
      durationMs,
      amplitude,
      seed: Math.random() * Math.PI * 2,
      spriteOnly,
    });
  }

  stopGlyphDamageShake(key: string): void {
    const state = this.glyphDamageShakes.get(key);
    if (!state) {
      return;
    }

    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (mesh && !state.spriteOnly) {
      const baseZ = mesh.userData?.isWall ? WALL_HEIGHT / 2 : 0;
      mesh.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        baseZ,
      );
    }
    const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
    if (sprite) {
      const spriteZ =
        typeof sprite.userData?.elevatedZ === "number"
          ? sprite.userData.elevatedZ
          : this.dependencies.entityBillboards.elevatedMonsterZ;
      sprite.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        spriteZ,
      );
    }
    const shadow = this.dependencies.entityBillboards.entityBlobShadows.get(key);
    if (shadow) {
      const shadowZ = mesh?.userData?.isWall ? WALL_HEIGHT + 0.03 : 0.028;
      shadow.position.set(
        state.tileX * TILE_SIZE,
        -state.tileY * TILE_SIZE,
        shadowZ,
      );
    }

    this.glyphDamageShakes.delete(key);
  }

  updateGlyphDamageShakes(deltaSeconds: number): void {
    if (this.glyphDamageShakes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.glyphDamageShakes.entries());

    for (const [key, state] of entries) {
      const mesh = this.dependencies.tileRendering.tileMap.get(key);
      const sprite = this.dependencies.entityBillboards.monsterBillboards.get(key);
      if (!mesh && !sprite) {
        this.glyphDamageShakes.delete(key);
        continue;
      }
      if (state.spriteOnly && !sprite) {
        this.glyphDamageShakes.delete(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const envelope = Math.pow(1 - progress, 2);
      const jitter = state.amplitude * envelope;
      const oscillationBase = state.elapsedMs / 1000;
      const offsetX =
        Math.sin(oscillationBase * 74 + state.seed) * jitter +
        Math.sin(oscillationBase * 33 + state.seed * 1.37) * jitter * 0.5;
      const offsetY =
        Math.cos(oscillationBase * 81 + state.seed * 0.91) * jitter +
        Math.cos(oscillationBase * 29 + state.seed * 1.71) * jitter * 0.4;
      if (!state.spriteOnly && mesh) {
        const baseZ = mesh.userData?.isWall ? WALL_HEIGHT / 2 : 0;
        mesh.position.set(
          state.tileX * TILE_SIZE + offsetX,
          -state.tileY * TILE_SIZE + offsetY,
          baseZ,
        );
      }
      if (sprite) {
        const spriteZ =
          typeof sprite.userData?.elevatedZ === "number"
            ? sprite.userData.elevatedZ
            : this.dependencies.entityBillboards.elevatedMonsterZ;
        sprite.position.set(
          state.tileX * TILE_SIZE + offsetX,
          -state.tileY * TILE_SIZE + offsetY,
          spriteZ,
        );
      }
      const shadow = this.dependencies.entityBillboards.entityBlobShadows.get(key);
      if (shadow) {
        const shadowZ = mesh?.userData?.isWall ? WALL_HEIGHT + 0.03 : 0.028;
        shadow.position.set(
          state.tileX * TILE_SIZE + offsetX * 0.4,
          -state.tileY * TILE_SIZE + offsetY * 0.4,
          shadowZ,
        );
      }

      if (progress >= 1) {
        this.stopGlyphDamageShake(key);
      }
    }
  }

  clearGlyphDamageShakes(): void {
    const shakeKeys = Array.from(this.glyphDamageShakes.keys());
    for (const key of shakeKeys) {
      this.stopGlyphDamageShake(key);
    }
  }
}
