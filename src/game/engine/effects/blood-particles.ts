import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import type { BloodMistParticle, BillboardShardParticle } from "../shared/types";
import type { BloodGround } from "./blood-ground";
import type { EngineState } from "../runtime/engine-state";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TileRendering } from "../rendering/tile-rendering";

export interface BloodParticlesDependencies {
  readonly bloodGround: Pick<
    BloodGround,
    "paintBloodGroundFromDirectHit"
    | "paintBloodGroundFromParticleImpact"
    | "paintBloodGroundFromShardImpact"
    | "resolveBloodGroundLowFpsScale"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
}

/** Blood mist and billboard shard particle motion, impact collisions and cleanup */
export class BloodParticles {
  constructor(private readonly dependencies: BloodParticlesDependencies) {}

  damageParticles: BloodMistParticle[] = [];

  monsterBillboardShardParticles: BillboardShardParticle[] = [];

  bloodMistTexture: THREE.CanvasTexture | null = null;

  readonly bloodParticleHitLifetimeMs: number = 620;

  readonly bloodParticleDefeatLifetimeMs: number = 1250;

  readonly bloodParticleHitCountMin: number = 5;

  readonly bloodParticleHitCountMax: number = 10;

  readonly bloodParticleDefeatCountMin: number = 18;

  readonly bloodParticleDefeatCountMax: number = 32;

  readonly playerDeathBloodMistCountMultiplier: number = 5;

  readonly bloodParticleSpawnJitter: number = 0.12;

  readonly damageParticleGravity: number = 67;

  readonly damageParticleDrag: number = 4.2;

  readonly monsterBillboardShardLifetimeMs: number = 3000;

  readonly monsterBillboardShardFadeStartMs: number = 1500;

  readonly monsterBillboardShardGravity: number = this.dependencies.movementInput.isFpsMode()
    ? 23
    : 23;

  readonly monsterBillboardShardDrag: number = 2.9;

  readonly monsterBillboardShardWallBounce: number = 2.5;

  readonly monsterBillboardShardFloorBounce: number = 0.28;

  readonly monsterBillboardShardGroundFriction: number = 0.72;

  readonly monsterBillboardShardAngularAirDamping: number = 0.985;

  readonly monsterBillboardShardAngularGroundDamping: number = 0.22;

  readonly monsterBillboardShardFlatSettleMs: number = 220;

  readonly monsterBillboardShardImpulseTowardPlayer: number =
    TILE_SIZE * 0.17;

  readonly monsterBillboardShardBaseHorizontalSpeed: number = -1;

  readonly monsterBillboardShardHorizontalVariance: number = 4;

  readonly monsterBillboardShardVerticalBaseSpeed: number = -2.5;

  readonly monsterBillboardShardVerticalVariance: number = 5;

  readonly monsterBillboardShardMaxPieces: number = 18;

  readonly playerDeathBillboardSplitCount: number = 3;

  readonly monsterBillboardShardBoundaryRedChancePercent: number = 40;

  readonly monsterBillboardShardBoundaryRedBleedChancePercent: number = 42;

  readonly monsterBillboardShardBoundaryRed2x2ChancePercent: number = 30;

  readonly monsterBillboardShardAngularAxis = new THREE.Vector3();

  readonly monsterBillboardShardDeltaQuaternion =
    new THREE.Quaternion();

  readonly damageParticleFloorZ: number = 0.02;

  readonly damageParticleWallBounce: number = 0.46;

  disposeBloodMistTexture(): void {
    this.bloodMistTexture?.dispose();
    this.bloodMistTexture = null;
  }

  getBloodMistTexture(): THREE.CanvasTexture {
    if (this.bloodMistTexture) {
      return this.bloodMistTexture;
    }

    // Intentionally low-resolution so blood particles render with a pixelated look.
    const size = 10;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create blood mist canvas context");
    }

    context.clearRect(0, 0, size, size);
    const gradient = context.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.015,
      size * 0.5,
      size * 0.5,
      size * 0.34,
    );
    const lightColor = new THREE.Color(this.dependencies.engineState.clientOptions.bloodMistColorHex);
    const darkColor = lightColor.clone().lerp(new THREE.Color(0x000000), 0.74);
    const strengthAlphaScale = THREE.MathUtils.clamp(
      this.dependencies.engineState.clientOptions.bloodStrength / 2.5,
      0.3,
      1.6,
    );
    const buildMistColorStop = (mixT: number, alpha: number): string => {
      const mixedColor = lightColor.clone().lerp(darkColor, mixT);
      const r = Math.round(mixedColor.r * 255);
      const g = Math.round(mixedColor.g * 255);
      const b = Math.round(mixedColor.b * 255);
      const adjustedAlpha = Number(
        THREE.MathUtils.clamp(alpha * strengthAlphaScale, 0, 1).toFixed(3),
      );
      return `rgba(${r}, ${g}, ${b}, ${adjustedAlpha})`;
    };
    gradient.addColorStop(0, buildMistColorStop(0.08, 1));
    gradient.addColorStop(0.22, buildMistColorStop(0.42, 0.99));
    gradient.addColorStop(0.58, buildMistColorStop(0.78, 0.73));
    gradient.addColorStop(0.9, buildMistColorStop(1, 0.13));
    gradient.addColorStop(1, buildMistColorStop(1, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = 1;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    this.bloodMistTexture = texture;
    return texture;
  }

  spawnBloodEffects(
    tileX: number,
    tileY: number,
    damage: number,
    variant: "hit" | "defeat",
    options: {
      directionX?: number;
      directionY?: number;
      horizontalSpeedMultiplier?: number;
      mistParticleCountMultiplier?: number;
      radialSpread?: boolean;
      verticalSpeedMultiplier?: number;
    } = {},
  ): void {
    const sanitized = Math.max(1, Math.round(Math.abs(damage)));
    const sprayDirection = new THREE.Vector2(
      typeof options.directionX === "number" &&
        Number.isFinite(options.directionX)
        ? options.directionX
        : tileX - this.dependencies.playerMovement.playerPos.x,
      typeof options.directionY === "number" &&
        Number.isFinite(options.directionY)
        ? options.directionY
        : -(tileY - this.dependencies.playerMovement.playerPos.y),
    );
    if (sprayDirection.lengthSq() < 0.0001) {
      const randomAngle = Math.random() * Math.PI * 2;
      sprayDirection.set(Math.cos(randomAngle), Math.sin(randomAngle));
    } else {
      sprayDirection.normalize();
    }

    if (this.dependencies.engineState.clientOptions.bloodGround) {
      this.dependencies.bloodGround.paintBloodGroundFromDirectHit(
        tileX,
        tileY,
        sanitized,
        variant,
        sprayDirection.x,
        sprayDirection.y,
      );
    }
    if (!this.dependencies.engineState.clientOptions.bloodMist) {
      return;
    }

    const texture = this.getBloodMistTexture();
    const radialSpread = options.radialSpread === true;

    const spreadRadians = radialSpread
      ? Math.PI * 2
      : variant === "defeat"
        ? THREE.MathUtils.degToRad(52)
        : THREE.MathUtils.degToRad(32);
    const count =
      variant === "defeat"
        ? THREE.MathUtils.randInt(
            this.bloodParticleDefeatCountMin,
            this.bloodParticleDefeatCountMax,
          )
        : THREE.MathUtils.randInt(
            this.bloodParticleHitCountMin,
            this.bloodParticleHitCountMax,
          );
    const mistParticleCountMultiplier =
      typeof options.mistParticleCountMultiplier === "number" &&
      Number.isFinite(options.mistParticleCountMultiplier)
        ? Math.max(0.1, options.mistParticleCountMultiplier)
        : 1;
    const horizontalSpeedMultiplier =
      typeof options.horizontalSpeedMultiplier === "number" &&
      Number.isFinite(options.horizontalSpeedMultiplier)
        ? Math.max(0.1, options.horizontalSpeedMultiplier)
        : 1;
    const verticalSpeedMultiplier =
      typeof options.verticalSpeedMultiplier === "number" &&
      Number.isFinite(options.verticalSpeedMultiplier)
        ? Math.max(0.1, options.verticalSpeedMultiplier)
        : 1;
    const particleCount = Math.max(
      1,
      Math.round(
        (count + (variant === "defeat" ? Math.min(12, sanitized) : 0)) *
          mistParticleCountMultiplier,
      ),
    );
    const baseLifetimeMs =
      variant === "defeat"
        ? this.bloodParticleDefeatLifetimeMs
        : this.bloodParticleHitLifetimeMs;
    const lifetimeJitterMs = variant === "defeat" ? 580 : 260;
    const baseHorizontalSpeed = variant === "defeat" ? 4.2 : 3.1;
    const horizontalBoost = variant === "defeat" ? 0.24 : 0.16;
    const baseVerticalSpeed = variant === "defeat" ? 3.1 : 2.3;
    const horizontalVarianceScale = variant === "defeat" ? 1.35 : 1.1;
    const horizontalVarianceJitter = variant === "defeat" ? 1.4 : 0.9;
    const minScale = variant === "defeat" ? 0.086 : 0.049;
    const maxScale = variant === "defeat" ? 0.214 : 0.118;

    for (let i = 0; i < particleCount; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      material.opacity = variant === "defeat" ? 0.95 : 0.88;

      const sprite = new THREE.Sprite(material);
      const sizeFactor = Math.pow(Math.random(), 1.35);
      const baseScaleValue = THREE.MathUtils.lerp(
        minScale,
        maxScale,
        sizeFactor,
      );
      const baseScale = new THREE.Vector2(
        baseScaleValue * (0.82 + Math.random() * 0.36),
        baseScaleValue * (0.82 + Math.random() * 0.36),
      );
      sprite.scale.set(baseScale.x, baseScale.y, 1);
      sprite.position.set(
        tileX * TILE_SIZE +
          (Math.random() - 0.5) * this.bloodParticleSpawnJitter,
        -tileY * TILE_SIZE +
          (Math.random() - 0.5) * this.bloodParticleSpawnJitter,
        this.damageParticleFloorZ + 0.16 + Math.random() * 0.24,
      );
      sprite.renderOrder = 930;
      this.dependencies.renderPipeline.scene.add(sprite);

      const directionAngle = radialSpread
        ? Math.random() * spreadRadians
        : Math.atan2(sprayDirection.y, sprayDirection.x) +
          (Math.random() - 0.5) * spreadRadians;
      const horizontalSpeed =
        (baseHorizontalSpeed +
          Math.random() * (baseHorizontalSpeed * horizontalVarianceScale) +
          (Math.random() - 0.5) * horizontalVarianceJitter +
          sanitized * horizontalBoost +
          (1 - sizeFactor) * (variant === "defeat" ? 2.6 : 1.9)) *
        horizontalSpeedMultiplier;
      const verticalSpeed =
        (baseVerticalSpeed +
          Math.random() * (variant === "defeat" ? 3.2 : 2.2) +
          (1 - sizeFactor) * (variant === "defeat" ? 1.9 : 1.2)) *
        verticalSpeedMultiplier;

      this.damageParticles.push({
        sprite,
        velocity: new THREE.Vector3(
          Math.cos(directionAngle) * horizontalSpeed,
          Math.sin(directionAngle) * horizontalSpeed,
          verticalSpeed,
        ),
        ageMs: 0,
        lifetimeMs: baseLifetimeMs + Math.random() * lifetimeJitterMs,
        radius: baseScaleValue * 0.52,
        baseScale,
        groundImpactCount: 0,
      });
    }
  }

  disposeMonsterBillboardShardParticle(index: number): void {
    if (index < 0 || index >= this.monsterBillboardShardParticles.length) {
      return;
    }

    const [particle] = this.monsterBillboardShardParticles.splice(index, 1);
    this.dependencies.renderPipeline.scene.remove(particle.mesh);
    if (particle.mesh.material.map) {
      particle.mesh.material.map.dispose();
    }
    particle.mesh.material.dispose();
    particle.mesh.geometry.dispose();
  }

  disposeDamageParticle(index: number): void {
    if (index < 0 || index >= this.damageParticles.length) {
      return;
    }

    const [particle] = this.damageParticles.splice(index, 1);
    this.dependencies.renderPipeline.scene.remove(particle.sprite);

    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map && material.map !== this.bloodMistTexture) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  resolveCollidableParticleAgainstWallTile(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    tileX: number,
    tileY: number,
    wallBounce: number,
  ): boolean {
    const half = TILE_SIZE / 2;
    const centerX = tileX * TILE_SIZE;
    const centerY = -tileY * TILE_SIZE;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;

    const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
    const closestY = THREE.MathUtils.clamp(position.y, minY, maxY);
    let nx = position.x - closestX;
    let ny = position.y - closestY;
    const distSq = nx * nx + ny * ny;

    if (distSq >= radius * radius) {
      return false;
    }

    let penetration = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      nx /= dist;
      ny /= dist;
      penetration = radius - dist;
    } else {
      const toLeft = position.x - minX;
      const toRight = maxX - position.x;
      const toBottom = position.y - minY;
      const toTop = maxY - position.y;
      const minPenetration = Math.min(toLeft, toRight, toBottom, toTop);

      if (minPenetration === toLeft) {
        nx = -1;
        ny = 0;
        penetration = toLeft + radius;
      } else if (minPenetration === toRight) {
        nx = 1;
        ny = 0;
        penetration = toRight + radius;
      } else if (minPenetration === toBottom) {
        nx = 0;
        ny = -1;
        penetration = toBottom + radius;
      } else {
        nx = 0;
        ny = 1;
        penetration = toTop + radius;
      }
    }

    position.x += nx * penetration;
    position.y += ny * penetration;

    const velocityIntoWall = velocity.x * nx + velocity.y * ny;
    if (velocityIntoWall < 0) {
      const bounce = (1 + wallBounce) * velocityIntoWall;
      velocity.x -= bounce * nx;
      velocity.y -= bounce * ny;
      velocity.x *= 0.78;
      velocity.y *= 0.78;
    }

    return true;
  }

  resolveCollidableParticleWallCollision(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    wallBounce: number,
  ): void {
    if (position.z > WALL_HEIGHT + 0.22) {
      return;
    }

    const approxTileX = Math.round(position.x / TILE_SIZE);
    const approxTileY = Math.round(-position.y / TILE_SIZE);

    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.dependencies.tileRendering.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolveCollidableParticleAgainstWallTile(
          position,
          velocity,
          radius,
          x,
          y,
          wallBounce,
        );
      }
    }
  }

  resolveDamageParticleWallCollision(
    particle: BloodMistParticle,
  ): void {
    this.resolveCollidableParticleWallCollision(
      particle.sprite.position,
      particle.velocity,
      particle.radius,
      this.damageParticleWallBounce,
    );
  }

  resolveMonsterBillboardShardWallCollision(
    particle: BillboardShardParticle,
  ): void {
    this.resolveCollidableParticleWallCollision(
      particle.mesh.position,
      particle.velocity,
      particle.radius,
      this.monsterBillboardShardWallBounce,
    );
  }

  updateDamageParticles(deltaSeconds: number): void {
    if (!this.damageParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-this.damageParticleDrag * deltaSeconds);
    const lowFpsBloodScale = this.dependencies.bloodGround.resolveBloodGroundLowFpsScale(deltaSeconds);

    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.damageParticles[i];
      particle.ageMs += deltaMs;
      const speed = particle.velocity.length();
      const travelPerFrame = speed * deltaSeconds;
      const subSteps = THREE.MathUtils.clamp(
        Math.ceil(travelPerFrame / (TILE_SIZE * 0.35)),
        1,
        4,
      );
      const stepSeconds = deltaSeconds / subSteps;
      const dragPerStep = Math.pow(drag, 1 / subSteps);

      for (let step = 0; step < subSteps; step += 1) {
        particle.velocity.z -= this.damageParticleGravity * stepSeconds;
        particle.velocity.x *= dragPerStep;
        particle.velocity.y *= dragPerStep;

        particle.sprite.position.x += particle.velocity.x * stepSeconds;
        particle.sprite.position.y += particle.velocity.y * stepSeconds;
        particle.sprite.position.z += particle.velocity.z * stepSeconds;

        this.resolveDamageParticleWallCollision(particle);

        if (particle.sprite.position.z < this.damageParticleFloorZ) {
          const impactSpeed = particle.velocity.length();
          if (particle.velocity.z < -0.12) {
            this.dependencies.bloodGround.paintBloodGroundFromParticleImpact(
              particle.sprite.position.x,
              particle.sprite.position.y,
              particle.velocity.x,
              particle.velocity.y,
              impactSpeed,
              particle.radius,
              particle.groundImpactCount,
              lowFpsBloodScale,
            );
            particle.groundImpactCount += 1;
          }
          particle.sprite.position.z = this.damageParticleFloorZ;
          if (particle.velocity.z < 0) {
            particle.velocity.z *= -0.22;
          }
          particle.velocity.x *= 0.82;
          particle.velocity.y *= 0.82;
        }
      }

      const material = particle.sprite.material;
      if (!(material instanceof THREE.SpriteMaterial)) {
        this.disposeDamageParticle(i);
        continue;
      }

      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );
      material.opacity = Math.max(0, 1 - Math.pow(lifeT, 2.1));

      const scaleBoost = 1 + lifeT * 0.34;
      particle.sprite.scale.set(
        particle.baseScale.x * scaleBoost,
        particle.baseScale.y * scaleBoost,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeDamageParticle(i);
      }
    }
  }

  updateMonsterBillboardShardParticles(deltaSeconds: number): void {
    if (!this.monsterBillboardShardParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-this.monsterBillboardShardDrag * deltaSeconds);
    const lowFpsBloodScale = this.dependencies.bloodGround.resolveBloodGroundLowFpsScale(deltaSeconds);

    for (
      let i = this.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      const particle = this.monsterBillboardShardParticles[i];
      particle.ageMs += deltaMs;

      const speed = particle.velocity.length();
      const travelPerFrame = speed * deltaSeconds;
      const subSteps = THREE.MathUtils.clamp(
        Math.ceil(travelPerFrame / (TILE_SIZE * 0.35)),
        1,
        4,
      );
      const stepSeconds = deltaSeconds / subSteps;
      const dragPerStep = Math.pow(drag, 1 / subSteps);

      for (let step = 0; step < subSteps; step += 1) {
        let onFloor = false;
        if (!particle.settled) {
          particle.velocity.z -=
            this.monsterBillboardShardGravity * stepSeconds;
        }
        particle.velocity.x *= dragPerStep;
        particle.velocity.y *= dragPerStep;

        particle.mesh.position.x += particle.velocity.x * stepSeconds;
        particle.mesh.position.y += particle.velocity.y * stepSeconds;
        particle.mesh.position.z += particle.velocity.z * stepSeconds;

        this.resolveMonsterBillboardShardWallCollision(particle);

        if (particle.mesh.position.z < this.damageParticleFloorZ) {
          const impactSpeed = particle.velocity.length();
          if (particle.velocity.z < -0.14) {
            this.dependencies.bloodGround.paintBloodGroundFromShardImpact(
              particle,
              impactSpeed,
              lowFpsBloodScale,
            );
            particle.groundImpactCount += 1;
          }
          onFloor = true;
          particle.mesh.position.z = this.damageParticleFloorZ;
          particle.floorContactMs += stepSeconds * 1000;
          if (particle.velocity.z < 0) {
            particle.velocity.z *= -this.monsterBillboardShardFloorBounce;
            if (Math.abs(particle.velocity.z) < 0.44) {
              particle.velocity.z = 0;
            }
          }
          particle.velocity.x *= this.monsterBillboardShardGroundFriction;
          particle.velocity.y *= this.monsterBillboardShardGroundFriction;

          const angularGroundDrag = Math.pow(
            this.monsterBillboardShardAngularGroundDamping,
            stepSeconds * 60,
          );
          particle.angularVelocity.multiplyScalar(angularGroundDrag);
          const settleT = THREE.MathUtils.clamp(
            particle.floorContactMs / this.monsterBillboardShardFlatSettleMs,
            0,
            1,
          );
          particle.mesh.quaternion.slerp(
            particle.flatOrientation,
            0.12 + 0.64 * settleT,
          );
          if (
            settleT >= 1 &&
            particle.velocity.lengthSq() < 0.055 * 0.055 &&
            particle.angularVelocity.lengthSq() < 0.18 * 0.18
          ) {
            particle.settled = true;
            particle.velocity.set(0, 0, 0);
            particle.angularVelocity.set(0, 0, 0);
            particle.mesh.quaternion.copy(particle.flatOrientation);
          }
        } else {
          particle.floorContactMs = 0;
          particle.angularVelocity.multiplyScalar(
            this.monsterBillboardShardAngularAirDamping,
          );
        }

        if (
          particle.angularVelocity.lengthSq() > 1e-6 &&
          !particle.settled &&
          !onFloor
        ) {
          const angularSpeed = particle.angularVelocity.length();
          this.monsterBillboardShardAngularAxis
            .copy(particle.angularVelocity)
            .multiplyScalar(1 / angularSpeed);
          this.monsterBillboardShardDeltaQuaternion.setFromAxisAngle(
            this.monsterBillboardShardAngularAxis,
            angularSpeed * stepSeconds,
          );
          particle.mesh.quaternion.multiply(
            this.monsterBillboardShardDeltaQuaternion,
          );
        }
      }

      const material = particle.mesh.material;
      if (particle.persistOnGround && particle.settled) {
        material.opacity = 0.98;
        particle.mesh.scale.set(particle.baseScale.x, particle.baseScale.y, 1);
        continue;
      }
      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );
      const fadeT = THREE.MathUtils.clamp(
        (particle.ageMs - particle.fadeStartMs) /
          Math.max(1, particle.lifetimeMs - particle.fadeStartMs),
        0,
        1,
      );
      material.opacity = Math.max(0, 1 - Math.pow(fadeT, 1.7));

      const scaleTaper = 1 - 0.2 * Math.pow(lifeT, 1.2);
      particle.mesh.scale.set(
        particle.baseScale.x * scaleTaper,
        particle.baseScale.y * scaleTaper,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeMonsterBillboardShardParticle(i);
      }
    }
  }

  clearBloodMistParticles(): void {
    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      this.disposeDamageParticle(i);
    }
  }

  clearMonsterBillboardShardParticles(): void {
    for (
      let i = this.monsterBillboardShardParticles.length - 1;
      i >= 0;
      i -= 1
    ) {
      this.disposeMonsterBillboardShardParticle(i);
    }
  }
}
