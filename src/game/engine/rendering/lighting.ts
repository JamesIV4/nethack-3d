import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import type { BloodGround } from "../effects/blood-ground";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "./render-pipeline";

export interface LightingDependencies {
  readonly bloodGround: Pick<
    BloodGround,
    "bloodGroundSpecularReferenceStrength"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
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
}

/** Lighting resources, player light, vignette shader and light-center smoothing */
export class Lighting {
  constructor(private readonly dependencies: LightingDependencies) {}

  lightingOverlayMesh: THREE.Mesh | null = null;

  lightingOverlayTexture: THREE.CanvasTexture | null = null;

  lightingWallOverlayMesh: THREE.Mesh | null = null;

  lightingWallOverlayTexture: THREE.CanvasTexture | null = null;

  readonly lightingCenterHalfLifeMs: number = 95;

  readonly lightingCenterEpsilonTiles: number = 0.001;

  lightingCenterCurrent = new THREE.Vector2();

  lightingCenterTarget = new THREE.Vector2();

  lightingCenterInitialized: boolean = false;

  readonly lightingVignetteMaxDarkAlpha: number = 0.82;

  ambientLight: THREE.AmbientLight | null = null;

  directionalLight: THREE.DirectionalLight | null = null;

  fpsPlayerLight: THREE.PointLight | null = null;

  markLightingDirty(): void {
    // Lighting currently tracks from shared vignette uniforms, so this is a no-op.
  }

  updateLightingCenter(deltaSeconds: number): void {
    if (this.dependencies.movementInput.isFpsMode()) {
      // In FPS mode, keep the vignette centered on the camera/player position in world space.
      // (World space in this renderer uses X/Y as the horizontal plane.)
      this.vignetteUniforms.uLightingCenter.value.set(
        this.dependencies.camera.camera.position.x,
        this.dependencies.camera.camera.position.y,
        0,
      );
      this.vignetteUniforms.uIsFpsMode.value = true;
      return;
    }

    this.lightingCenterTarget.set(this.dependencies.playerMovement.playerPos.x, this.dependencies.playerMovement.playerPos.y);
    if (!this.lightingCenterInitialized) {
      this.lightingCenterCurrent.copy(this.lightingCenterTarget);
      this.lightingCenterInitialized = true;
      // Initialize uniforms right away
      this.vignetteUniforms.uLightingCenter.value.set(
        this.lightingCenterCurrent.x * TILE_SIZE,
        -this.lightingCenterCurrent.y * TILE_SIZE,
        0,
      );
      this.vignetteUniforms.uIsFpsMode.value = false;
      return;
    }

    const deltaMs = Math.max(0, deltaSeconds * 1000);
    if (deltaMs > 0) {
      const lerpAlpha =
        1 - Math.exp((-Math.LN2 * deltaMs) / this.lightingCenterHalfLifeMs);
      this.lightingCenterCurrent.lerp(this.lightingCenterTarget, lerpAlpha);
    }

    if (
      this.lightingCenterCurrent.distanceToSquared(this.lightingCenterTarget) <=
      this.lightingCenterEpsilonTiles * this.lightingCenterEpsilonTiles
    ) {
      this.lightingCenterCurrent.copy(this.lightingCenterTarget);
    }

    // --- NEW: Update the globally shared uniforms for the shaders ---
    this.vignetteUniforms.uLightingCenter.value.set(
      this.lightingCenterCurrent.x * TILE_SIZE,
      -this.lightingCenterCurrent.y * TILE_SIZE,
      0,
    );
    this.vignetteUniforms.uIsFpsMode.value = false;
  }

  disposeLightingOverlay(): void {
    if (this.lightingOverlayMesh) {
      this.dependencies.renderPipeline.scene.remove(this.lightingOverlayMesh);
      this.lightingOverlayMesh.geometry.dispose();
      const material = this.lightingOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingOverlayMesh = null;
    }
    if (this.lightingWallOverlayMesh) {
      this.dependencies.renderPipeline.scene.remove(this.lightingWallOverlayMesh);
      this.lightingWallOverlayMesh.geometry.dispose();
      const material = this.lightingWallOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingWallOverlayMesh = null;
    }

    if (this.lightingOverlayTexture) {
      this.lightingOverlayTexture.dispose();
      this.lightingOverlayTexture = null;
    }
    if (this.lightingWallOverlayTexture) {
      this.lightingWallOverlayTexture.dispose();
      this.lightingWallOverlayTexture = null;
    }
  }

  configureBaseLightingForPlayMode(): void {
    if (!this.ambientLight || !this.directionalLight) {
      return;
    }

    this.vignetteUniforms.uMaxDarkAlpha.value = this.dependencies.engineState.clientOptions
      .lightingEnabled
      ? this.lightingVignetteMaxDarkAlpha
      : 0;

    if (!this.dependencies.engineState.clientOptions.lightingEnabled) {
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 1;
      this.directionalLight.intensity = 0;
      if (this.fpsPlayerLight) {
        this.fpsPlayerLight.visible = false;
      }
      return;
    }

    this.ambientLight.color.setHex(0x404040);
    if (this.dependencies.movementInput.isFpsMode()) {
      this.ambientLight.intensity = 0.72;
      this.directionalLight.intensity = 1.25;
      if (!this.fpsPlayerLight) {
        this.fpsPlayerLight = new THREE.PointLight(0xfff4d8, 2.8, 14, 1.35);
        this.fpsPlayerLight.castShadow = false;
        this.dependencies.renderPipeline.scene.add(this.fpsPlayerLight);
      }
      this.fpsPlayerLight.intensity = 2.8;
      this.fpsPlayerLight.distance = 14;
      this.fpsPlayerLight.decay = 1.35;
      this.fpsPlayerLight.visible = true;
      this.updateFpsPlayerLightPosition();
      return;
    }

    this.ambientLight.intensity = 0.4;
    this.directionalLight.intensity = 0.8;
    if (this.fpsPlayerLight) {
      this.fpsPlayerLight.visible = false;
    }
  }

  updateFpsPlayerLightPosition(): void {
    if (!this.fpsPlayerLight || !this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    this.fpsPlayerLight.position.copy(this.dependencies.camera.camera.position);
    this.fpsPlayerLight.position.z = this.dependencies.camera.camera.position.z + 0.04;
  }


  // --- Shader Uniforms for Vignette ---
  vignetteUniforms = {
    uLightingCenter: { value: new THREE.Vector3(0, 0, 0) },
    uLightingRadius: { value: 20.0 * TILE_SIZE },
    uFalloffPower: { value: 1.08 },
    uMaxDarkAlpha: { value: this.lightingVignetteMaxDarkAlpha },
    uIsFpsMode: { value: false },
    uBloodGroundStrength: { value: this.dependencies.engineState.clientOptions.bloodStrength },
    uBloodGroundSpecularReferenceStrength: {
      value: this.dependencies.bloodGround.bloodGroundSpecularReferenceStrength,
    },
  };

  patchMaterialForVignette(
    material: THREE.Material,
    options: {
      bloodGroundDiscardEmptyTexels?: boolean;
      bloodGroundSpecularEffectTexelSize?: THREE.Vector2;
    } = {},
  ): void {
    const bloodGroundDiscardEmptyTexels =
      options.bloodGroundDiscardEmptyTexels === true;
    const bloodGroundSpecularEffectTexelSize =
      options.bloodGroundSpecularEffectTexelSize;
    const shaderKeySuffix = bloodGroundSpecularEffectTexelSize
      ? `_blood_ground_specular_v2_${bloodGroundSpecularEffectTexelSize.x.toFixed(
          8,
        )}_${bloodGroundSpecularEffectTexelSize.y.toFixed(8)}`
      : "";
    const bloodGroundGuardKeySuffix = bloodGroundDiscardEmptyTexels
      ? "_blood_ground_color_guard_v1"
      : "";
    // Force Three.js to compile a unique shader for this patch
    material.customProgramCacheKey = () =>
      `vignette_patch_v9${shaderKeySuffix}${bloodGroundGuardKeySuffix}`;

    material.onBeforeCompile = (shader) => {
      // Bind our class-level uniforms to this specific shader
      shader.uniforms.uLightingCenter = this.vignetteUniforms.uLightingCenter;
      shader.uniforms.uLightingRadius = this.vignetteUniforms.uLightingRadius;
      shader.uniforms.uFalloffPower = this.vignetteUniforms.uFalloffPower;
      shader.uniforms.uMaxDarkAlpha = this.vignetteUniforms.uMaxDarkAlpha;
      shader.uniforms.uIsFpsMode = this.vignetteUniforms.uIsFpsMode;
      shader.uniforms.uBloodGroundStrength =
        this.vignetteUniforms.uBloodGroundStrength;
      shader.uniforms.uBloodGroundSpecularReferenceStrength =
        this.vignetteUniforms.uBloodGroundSpecularReferenceStrength;

      // Inject varying into Vertex Shader
      shader.vertexShader = `
        varying vec3 vWorldPos;
        ${shader.vertexShader}
      `;

      // Branch based on material type (Standard Meshes vs Sprites)
      if (shader.vertexShader.includes("#include <project_vertex>")) {
        // --- 3D MESHES ---
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
          vec4 tempWorldPosition = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            tempWorldPosition = instanceMatrix * tempWorldPosition;
          #endif
          vWorldPos = (modelMatrix * tempWorldPosition).xyz;`,
        );
      } else if (shader.vertexShader.includes("#include <fog_vertex>")) {
        // --- 2D SPRITES / BILLBOARDS ---
        shader.vertexShader = shader.vertexShader.replace(
          "#include <fog_vertex>",
          `#include <fog_vertex>
          // modelMatrix[3] is the translation column (vec4). Extract xyz for world position.
          vWorldPos = modelMatrix[3].xyz;`,
        );
      }

      let damageFlashLogic = "float uDamageFlash = 0.0;";

      // If it's a sprite, intercept the diffuse color (material.color)
      if (material instanceof THREE.SpriteMaterial) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 diffuseColor = vec4( diffuse, opacity );
           // When color is set to red, green drops to 0. Calculate flash intensity from that.
           float uDamageFlashAmount = clamp(1.0 - diffuse.g, 0.0, 1.0);
           // Reset the base multiplier to white so the texture isn't darkened
           diffuseColor.rgb = vec3(1.0); 
          `,
        );
        damageFlashLogic = "float uDamageFlash = uDamageFlashAmount;";
      }

      if (bloodGroundDiscardEmptyTexels) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          #ifdef USE_MAP
            float bloodGroundColorCoverage = max(
              max(diffuseColor.r, diffuseColor.g),
              diffuseColor.b
            );
            if (bloodGroundColorCoverage < 0.0019607843) discard;
          #endif`,
        );
      }

      let bloodGroundSpecularPrefix = "";
      let bloodGroundSpecularLogic = "";
      if (bloodGroundSpecularEffectTexelSize) {
        shader.uniforms.uBloodGroundSpecularEffectTexelSize = {
          value: bloodGroundSpecularEffectTexelSize.clone(),
        };
        bloodGroundSpecularPrefix = `
        uniform vec2 uBloodGroundSpecularEffectTexelSize;
        uniform float uBloodGroundStrength;
        uniform float uBloodGroundSpecularReferenceStrength;

        float bloodGroundSpecularHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float bloodGroundSpecularNoise(vec2 pixelCoord, float scale, float seed) {
          vec2 p = pixelCoord * scale + vec2(seed, seed * 1.37);
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = bloodGroundSpecularHash(i);
          float b = bloodGroundSpecularHash(i + vec2(1.0, 0.0));
          float c = bloodGroundSpecularHash(i + vec2(0.0, 1.0));
          float d = bloodGroundSpecularHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        `;
        bloodGroundSpecularLogic = `
        #ifdef USE_MAP
          float bloodGroundOpacityT = clamp(gl_FragColor.a, 0.0, 1.0);
          float bloodGroundVisibleT = smoothstep(0.004, 0.04, bloodGroundOpacityT);
          float bloodGroundVisualAlphaForSpec = max(bloodGroundOpacityT, 0.001);
          float bloodGroundDensityFromVisualAlpha = pow(
            clamp(bloodGroundVisualAlphaForSpec / 0.94, 0.0, 1.0),
            1.3157895
          ) / max(uBloodGroundStrength, 0.001);
          float bloodGroundReferenceOpacityT =
            pow(
              clamp(
                bloodGroundDensityFromVisualAlpha *
                  uBloodGroundSpecularReferenceStrength,
                0.0,
                1.0
              ),
              0.76
            ) *
            0.94;
          float bloodGroundInteriorBlendCompensation = clamp(
            bloodGroundReferenceOpacityT / bloodGroundVisualAlphaForSpec,
            1.0,
            2.25
          );
          vec2 bloodGroundSpecularTexel = max(
            uBloodGroundSpecularEffectTexelSize,
            vec2(0.000001)
          );
          vec2 bloodGroundPixelCoord = vMapUv / bloodGroundSpecularTexel;
          float bloodGroundFineNoise = bloodGroundSpecularNoise(
            bloodGroundPixelCoord,
            0.1075,
            13.0
          );
          float bloodGroundBroadNoise = bloodGroundSpecularNoise(
            bloodGroundPixelCoord,
            0.04,
            37.0
          );
          float bloodGroundPooledNoise = mix(
            bloodGroundFineNoise,
            bloodGroundBroadNoise,
            0.38
          );
          float bloodGroundDepthNoise = bloodGroundSpecularNoise(
            bloodGroundPixelCoord,
            0.023,
            71.0
          );

          float bloodGroundAlphaLeft = texture2D(
            map,
            clamp(
              vMapUv - vec2(bloodGroundSpecularTexel.x, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundAlphaRight = texture2D(
            map,
            clamp(
              vMapUv + vec2(bloodGroundSpecularTexel.x, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundAlphaDown = texture2D(
            map,
            clamp(
              vMapUv - vec2(0.0, bloodGroundSpecularTexel.y),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundAlphaUp = texture2D(
            map,
            clamp(
              vMapUv + vec2(0.0, bloodGroundSpecularTexel.y),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          vec2 bloodGroundInteriorFadeStep = bloodGroundSpecularTexel * 3.0;
          float bloodGroundFadeNearAlphaLeft = texture2D(
            map,
            clamp(
              vMapUv - vec2(bloodGroundInteriorFadeStep.x, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeNearAlphaRight = texture2D(
            map,
            clamp(
              vMapUv + vec2(bloodGroundInteriorFadeStep.x, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeNearAlphaDown = texture2D(
            map,
            clamp(
              vMapUv - vec2(0.0, bloodGroundInteriorFadeStep.y),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeNearAlphaUp = texture2D(
            map,
            clamp(
              vMapUv + vec2(0.0, bloodGroundInteriorFadeStep.y),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeMidAlphaLeft = texture2D(
            map,
            clamp(
              vMapUv - vec2(bloodGroundInteriorFadeStep.x * 3.0, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeMidAlphaRight = texture2D(
            map,
            clamp(
              vMapUv + vec2(bloodGroundInteriorFadeStep.x * 3.0, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeMidAlphaDown = texture2D(
            map,
            clamp(
              vMapUv - vec2(0.0, bloodGroundInteriorFadeStep.y * 3.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeMidAlphaUp = texture2D(
            map,
            clamp(
              vMapUv + vec2(0.0, bloodGroundInteriorFadeStep.y * 3.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeFarAlphaLeft = texture2D(
            map,
            clamp(
              vMapUv - vec2(bloodGroundInteriorFadeStep.x * 5.0, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeFarAlphaRight = texture2D(
            map,
            clamp(
              vMapUv + vec2(bloodGroundInteriorFadeStep.x * 5.0, 0.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeFarAlphaDown = texture2D(
            map,
            clamp(
              vMapUv - vec2(0.0, bloodGroundInteriorFadeStep.y * 5.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundFadeFarAlphaUp = texture2D(
            map,
            clamp(
              vMapUv + vec2(0.0, bloodGroundInteriorFadeStep.y * 5.0),
              vec2(0.0),
              vec2(1.0)
            )
          ).a;
          float bloodGroundNeighborMin = min(
            min(bloodGroundAlphaLeft, bloodGroundAlphaRight),
            min(bloodGroundAlphaDown, bloodGroundAlphaUp)
          );
          float bloodGroundInnerEdgeDrop = max(
            bloodGroundOpacityT - bloodGroundNeighborMin,
            0.0
          );
          vec4 bloodGroundFadeNearRing = vec4(
            bloodGroundFadeNearAlphaLeft,
            bloodGroundFadeNearAlphaRight,
            bloodGroundFadeNearAlphaDown,
            bloodGroundFadeNearAlphaUp
          );
          vec4 bloodGroundFadeMidRing = vec4(
            bloodGroundFadeMidAlphaLeft,
            bloodGroundFadeMidAlphaRight,
            bloodGroundFadeMidAlphaDown,
            bloodGroundFadeMidAlphaUp
          );
          vec4 bloodGroundFadeFarRing = vec4(
            bloodGroundFadeFarAlphaLeft,
            bloodGroundFadeFarAlphaRight,
            bloodGroundFadeFarAlphaDown,
            bloodGroundFadeFarAlphaUp
          );
          float bloodGroundFadeNearDrop = max(
            bloodGroundOpacityT - dot(bloodGroundFadeNearRing, vec4(0.25)),
            0.0
          );
          float bloodGroundFadeMidDrop = max(
            bloodGroundOpacityT - dot(bloodGroundFadeMidRing, vec4(0.25)),
            0.0
          );
          float bloodGroundFadeFarDrop = max(
            bloodGroundOpacityT - dot(bloodGroundFadeFarRing, vec4(0.25)),
            0.0
          );
          float bloodGroundRimScale = uIsFpsMode ? 2.0 : 3.0;
          vec2 bloodGroundRimNearStep =
            bloodGroundInteriorFadeStep * bloodGroundRimScale;
          vec2 bloodGroundRimMidStep =
            bloodGroundInteriorFadeStep * 3.0 * bloodGroundRimScale;
          vec4 bloodGroundRimNearRing = vec4(
            texture2D(
              map,
              clamp(
                vMapUv - vec2(bloodGroundRimNearStep.x, 0.0),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv + vec2(bloodGroundRimNearStep.x, 0.0),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv - vec2(0.0, bloodGroundRimNearStep.y),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv + vec2(0.0, bloodGroundRimNearStep.y),
                vec2(0.0),
                vec2(1.0)
              )
            ).a
          );
          vec4 bloodGroundRimMidRing = vec4(
            texture2D(
              map,
              clamp(
                vMapUv - vec2(bloodGroundRimMidStep.x, 0.0),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv + vec2(bloodGroundRimMidStep.x, 0.0),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv - vec2(0.0, bloodGroundRimMidStep.y),
                vec2(0.0),
                vec2(1.0)
              )
            ).a,
            texture2D(
              map,
              clamp(
                vMapUv + vec2(0.0, bloodGroundRimMidStep.y),
                vec2(0.0),
                vec2(1.0)
              )
            ).a
          );
          float bloodGroundRimNearDrop = max(
            bloodGroundOpacityT - dot(bloodGroundRimNearRing, vec4(0.25)),
            0.0
          );
          float bloodGroundRimMidDrop = max(
            bloodGroundOpacityT - dot(bloodGroundRimMidRing, vec4(0.25)),
            0.0
          );
          float bloodGroundInteriorEdgeReach =
            smoothstep(0.02, 0.22, bloodGroundFadeNearDrop) * 0.52 +
            smoothstep(0.02, 0.22, bloodGroundFadeMidDrop) * 0.32 +
            smoothstep(0.02, 0.22, bloodGroundFadeFarDrop) * 0.16;
          float bloodGroundInteriorFadeT = smoothstep(
            0.0,
            1.0,
            clamp(1.0 - bloodGroundInteriorEdgeReach, 0.0, 1.0)
          );

          float bloodGroundPooledPhase = smoothstep(
            0.55,
            0.9,
            bloodGroundOpacityT
          );

          float bloodGroundPooledSheen =
            bloodGroundPooledPhase *
            (0.026 + bloodGroundDepthNoise * 0.012);
          float bloodGroundCompensatedInnerEdgeDrop = clamp(
            bloodGroundInnerEdgeDrop * bloodGroundInteriorBlendCompensation,
            0.0,
            1.0
          );
          float bloodGroundCompensatedRimNearDrop = clamp(
            bloodGroundRimNearDrop * bloodGroundInteriorBlendCompensation,
            0.0,
            1.0
          );
          float bloodGroundCompensatedRimMidDrop = clamp(
            bloodGroundRimMidDrop * bloodGroundInteriorBlendCompensation,
            0.0,
            1.0
          );
          float bloodGroundRimTightT = smoothstep(
            0.03,
            0.16,
            bloodGroundCompensatedInnerEdgeDrop
          );
          float bloodGroundRimNearT = smoothstep(
            0.02,
            0.24,
            bloodGroundCompensatedRimNearDrop
          );
          float bloodGroundRimMidT = smoothstep(
            0.025,
            0.28,
            bloodGroundCompensatedRimMidDrop
          );
          float bloodGroundEdgeTension =
            (
              bloodGroundRimTightT * 0.52 +
              bloodGroundRimNearT * 0.35 +
              bloodGroundRimMidT * 0.13
            ) *
            (0.42 + bloodGroundPooledNoise * 0.58);
          float bloodGroundPooledTensionEdge =
            bloodGroundPooledPhase *
            bloodGroundEdgeTension *
            bloodGroundInteriorBlendCompensation;
          float bloodGroundPooledInteriorT =
            bloodGroundPooledPhase *
            bloodGroundInteriorFadeT;
          float bloodGroundInteriorSheenCompensation = mix(
            1.0,
            bloodGroundInteriorBlendCompensation,
            bloodGroundInteriorFadeT
          );
          float bloodGroundPoolCoreT =
            bloodGroundPooledInteriorT *
            smoothstep(0.7, 0.96, bloodGroundOpacityT);
          float bloodGroundCompensatedPooledInteriorT = clamp(
            bloodGroundPooledInteriorT * bloodGroundInteriorBlendCompensation,
            0.0,
            1.0
          );
          float bloodGroundCompensatedPoolCoreT = clamp(
            bloodGroundPoolCoreT * bloodGroundInteriorBlendCompensation,
            0.0,
            1.0
          );
          float bloodGroundDepthDarken =
            bloodGroundCompensatedPooledInteriorT *
              (0.028 + (1.0 - bloodGroundDepthNoise) * 0.048) +
            bloodGroundCompensatedPoolCoreT *
              (0.019 + (1.0 - bloodGroundDepthNoise) * 0.034);
          gl_FragColor.rgb *= 1.0 - bloodGroundDepthDarken;
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            vec3(0.24, 0.0, 0.01),
            bloodGroundCompensatedPooledInteriorT *
              (0.019 + (1.0 - bloodGroundDepthNoise) * 0.034) +
              bloodGroundCompensatedPoolCoreT *
              (0.013 + (1.0 - bloodGroundDepthNoise) * 0.023)
          );
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            vec3(0.58, 0.015, 0.006),
            bloodGroundCompensatedPooledInteriorT * bloodGroundDepthNoise * 0.012
          );
          float bloodGroundPooledSurfaceSheen =
            bloodGroundCompensatedPooledInteriorT *
            (
              0.01 +
              bloodGroundDepthNoise * 0.012 +
              bloodGroundBroadNoise * 0.006
            ) *
            0.72;
          float bloodGroundHighlight =
            bloodGroundVisibleT *
            (
              bloodGroundPooledSheen * bloodGroundInteriorSheenCompensation +
              bloodGroundPooledSurfaceSheen +
              bloodGroundPooledTensionEdge * 0.12
            );
          vec3 bloodGroundHighlightColor = mix(
            vec3(1.0, 0.58, 0.38),
            vec3(1.0, 0.84, 0.62),
            bloodGroundPooledPhase
          );
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            bloodGroundHighlightColor,
            clamp(bloodGroundHighlight, 0.0, 0.34)
          );
          gl_FragColor.rgb +=
            bloodGroundHighlightColor *
            clamp(bloodGroundHighlight * 0.45, 0.0, 0.14);
        #endif`;
      }

      // Inject logic into Fragment Shader right at the end (before fog)
      shader.fragmentShader = `
        uniform vec3 uLightingCenter;
        uniform float uLightingRadius;
        uniform float uFalloffPower;
        uniform float uMaxDarkAlpha;
        uniform bool uIsFpsMode;
        varying vec3 vWorldPos;
        ${bloodGroundSpecularPrefix}
        ${shader.fragmentShader}
      `.replace(
        "#include <fog_fragment>",
        `${bloodGroundSpecularLogic}
        #include <fog_fragment>
        
        ${damageFlashLogic}
        if (uDamageFlash > 0.0) {
            // Mix in solid red while perfectly preserving original alpha/transparency
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.0, 0.0), uDamageFlash);
        }

        // Apply vignette in both normal and FPS modes.
        float radius = uIsFpsMode ? (uLightingRadius) : uLightingRadius;
        float dist = distance(vWorldPos.xy, uLightingCenter.xy);
        float t = clamp(dist / radius, 0.0, 1.0);
        float effectiveFalloff = uIsFpsMode ? (uFalloffPower / 2.0) : uFalloffPower;
        float alpha = pow(t, effectiveFalloff) * uMaxDarkAlpha;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), alpha);`,
      );
    };

    material.needsUpdate = true;
  }
}
