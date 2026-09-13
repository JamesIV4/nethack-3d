import type { Material } from "three";

/** Tabletop clipping bounds only the dungeon, not tracking-space UI and pointers. */
export function withoutWorldClipping<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <clipping_planes_vertex>", "");
    shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", "");
  };
  return material;
}
