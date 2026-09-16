import * as THREE from "three";
import { startupMenuRainAlphabet } from "../../ui/app/startup/rain";
import { getXrSettings } from "./settings";

export const MENU_BACKGROUND = 0x000011;
export const RAIN_FADE_SECONDS = 2;
export const RAIN_CAPACITY = 12000;
export const RAIN_RADIUS = 48;
export const RAIN_HEIGHT = 90;

export function rainVisibility(current: number, visible: boolean, seconds: number): number {
  return THREE.MathUtils.clamp(current + (visible ? 1 : -1) * seconds / RAIN_FADE_SECONDS, 0, 1);
}

/** One instanced draw for the entire surrounding field; glyphs face each XR eye. */
export class MenuRain {
  readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly visibility = new THREE.InstancedBufferAttribute(new Float32Array(RAIN_CAPACITY), 1);
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.ShaderMaterial;
  private lastTime: number | null = null;

  constructor() {
    this.scene.background = new THREE.Color(MENU_BACKGROUND);
    const canvas = document.createElement("canvas");
    // Double-sized atlas cells reserve room for the desktop-style soft halos.
    // Keep the font size unchanged and enlarge the quad to preserve glyph size.
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "48px monospace"; ctx.fillStyle = "white";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    startupMenuRainAlphabet.forEach((glyph, i) => {
      const x = (i % 8) * 128 + 64, y = Math.floor(i / 8) * 128 + 64;
      // Bake both glow widths once, retaining one instanced draw at runtime.
      for (const [blur, opacity] of [[9, .14], [4, .36], [0, .22]]) {
        ctx.filter = blur ? `blur(${blur}px)` : "none";
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillText(glyph, x, y);
      }
    });
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.minFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute("position", quad.attributes.position);
    this.geometry.setAttribute("uv", quad.attributes.uv);
    const positions = new Float32Array(RAIN_CAPACITY * 3), variation = new Float32Array(RAIN_CAPACITY * 3);
    for (let i = 0; i < RAIN_CAPACITY; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(9 + Math.random() * (RAIN_RADIUS ** 2 - 9));
      positions.set([Math.cos(angle) * radius, Math.random() * RAIN_HEIGHT, Math.sin(angle) * radius], i * 3);
      variation.set([0.65 + Math.random() * .7, .56 + Math.random() * 1.2, Math.random() * 1000], i * 3);
    }
    this.geometry.setAttribute("rainPosition", new THREE.InstancedBufferAttribute(positions, 3));
    this.geometry.setAttribute("variation", new THREE.InstancedBufferAttribute(variation, 3));
    this.visibility.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("visibility", this.visibility);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { atlas: { value: this.texture }, tint: { value: new THREE.Color(0x8dd7ff) }, travel: { value: 0 }, changes: { value: 0 }, speed: { value: 1 }, center: { value: new THREE.Vector3() } },
      vertexShader: `
        attribute vec3 rainPosition;
        attribute vec3 variation;
        attribute float visibility;
        uniform float travel, changes, speed;
        uniform vec3 center;
        varying vec2 glyphUv;
        varying vec2 nextGlyphUv;
        varying float glyphBlend;
        varying float alpha;
        float glyphAt(float step, float seed, float cycle) {
          return floor(fract(sin(seed + step * 12.9898 + cycle * 78.233) * 43758.5453) * ${startupMenuRainAlphabet.length.toFixed(1)});
        }
        void main() {
          float fallen = mod(rainPosition.y + travel * variation.x, ${RAIN_HEIGHT.toFixed(1)});
          float cycle = floor((rainPosition.y + travel * variation.x) / ${RAIN_HEIGHT.toFixed(1)});
          float phase = changes + variation.z;
          float glyph = glyphAt(floor(phase), variation.z, cycle);
          float nextGlyph = glyphAt(floor(phase) + 1.0, variation.z, cycle);
          glyphUv = (vec2(mod(glyph, 8.0), 7.0 - floor(glyph / 8.0)) + uv) / 8.0;
          nextGlyphUv = (vec2(mod(nextGlyph, 8.0), 7.0 - floor(nextGlyph / 8.0)) + uv) / 8.0;
          glyphBlend = smoothstep(.8, 1.0, fract(phase));
          float fadeDistance = max(.001, speed * variation.x * ${RAIN_FADE_SECONDS.toFixed(1)});
          alpha = visibility * min(1.0, min(fallen, ${RAIN_HEIGHT.toFixed(1)} - fallen) / fadeDistance);
          alpha *= mix(.18, .54, fract(variation.z));
          vec3 offset = center + vec3(rainPosition.x, ${RAIN_HEIGHT / 2}.0 - fallen, rainPosition.z);
          vec4 view = modelViewMatrix * vec4(offset, 1.0);
          view.xy += position.xy * variation.y * 2.0;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        uniform sampler2D atlas;
        uniform vec3 tint;
        varying vec2 glyphUv;
        varying vec2 nextGlyphUv;
        varying float glyphBlend;
        varying float alpha;
        void main() {
          float glyphAlpha = mix(texture2D(atlas, glyphUv).a, texture2D(atlas, nextGlyphUv).a, glyphBlend);
          gl_FragColor = vec4(tint, glyphAlpha * alpha);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  recenter(position: THREE.Vector3): void { this.material.uniforms.center.value.copy(position); }

  update(time: number): void {
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(.1, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const settings = getXrSettings();
    this.material.uniforms.travel.value += dt * settings.rainFallSpeed;
    this.material.uniforms.changes.value += dt * settings.rainChangeRate;
    this.material.uniforms.speed.value = settings.rainFallSpeed;
    let count = settings.rainCount;
    for (let i = 0; i < RAIN_CAPACITY; i++) {
      const fade = rainVisibility(this.visibility.getX(i), i < settings.rainCount, dt);
      this.visibility.setX(i, fade);
      if (fade > 0) count = Math.max(count, i + 1);
    }
    this.geometry.instanceCount = count;
    this.visibility.needsUpdate = true;
  }

  reset(): void { this.lastTime = null; this.visibility.array.fill(0); }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); this.texture.dispose(); }
}
