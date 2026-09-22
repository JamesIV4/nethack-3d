import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { LootForeground, isPlayerTileLoot } from "./loot-foreground";

it("masks visible loot with its alpha texture and restores original ownership on failure", () => {
  const world = new THREE.Scene(); world.scale.x = .6; world.updateMatrixWorld();
  const sprite = new THREE.Sprite(); sprite.visible = false; sprite.userData.entityType = "loot";
  sprite.userData.tileX = 1; sprite.userData.tileY = 1;
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({map:texture,transparent:true});
  const proxy = new THREE.Mesh(new THREE.PlaneGeometry(),material); world.add(proxy);
  sprite.userData.fpsPitchLockedProxyMesh = proxy;
  const mask = new LootForeground(); mask.prepare(new Map([["1,1",sprite]]),true,{x:1,y:1});
  expect(mask.active).toBe(true);
  let derived: THREE.Material | null = null;
  const renderer = { render: (scene: THREE.Scene) => {
    expect(scene.matrix.elements).toEqual(world.matrixWorld.elements);
    scene.updateMatrixWorld();
    expect(proxy.matrixWorld.elements[0]).toBeCloseTo(.6);
    expect(scene.children).toEqual([proxy]);
    derived = proxy.material;
    expect(proxy.material.map).toBe(texture);
    expect(proxy.material.alphaTest).toBeGreaterThan(0);
    expect(proxy.material.depthTest).toBe(true); expect(proxy.material.depthWrite).toBe(false);
    const shader = {fragmentShader:THREE.ShaderLib.basic.fragmentShader,vertexShader:THREE.ShaderLib.basic.vertexShader,uniforms:{}} as Parameters<THREE.Material["onBeforeCompile"]>[0];
    proxy.material.onBeforeCompile(shader,renderer as unknown as THREE.WebGLRenderer);
    expect(shader.fragmentShader.indexOf("#include <alphatest_fragment>")).toBeLessThan(shader.fragmentShader.indexOf("gl_FragColor.a = 0.75"));
    throw new Error("draw failure");
  } };
  expect(()=>mask.render(renderer as unknown as THREE.WebGLRenderer,new THREE.Camera(),world)).toThrow("draw failure");
  expect(proxy.material).toBe(material); expect(proxy.parent).toBe(world);
  const dispose=vi.spyOn(derived!,"dispose");
  mask.prepare(new Map(),false,null); expect(mask.active).toBe(false); expect(dispose).toHaveBeenCalledOnce();
  expect(material.map).toBe(texture); mask.dispose();
});

it("excludes hidden loot and monsters from the hotbar layer", () => {
  const world=new THREE.Scene(), loot=new THREE.Sprite(), monster=new THREE.Sprite();
  loot.userData.entityType="loot";loot.visible=false;world.add(loot,monster);
  const layer=new LootForeground();layer.prepare(new Map([["a",loot],["b",monster]]),true,{x:1,y:1});
  expect(layer.active).toBe(false); layer.dispose();
});

it("switches hotbar render and hit priority only at the authoritative player tile", () => {
  const world=new THREE.Scene(), loot=new THREE.Sprite();
  loot.userData={entityType:"loot",tileX:3,tileY:6}; world.add(loot);
  const layer=new LootForeground(), sprites=new Map([["3,6",loot]]);
  for (const player of [{x:2,y:6},{x:3,y:6},{x:4,y:6},{x:3,y:7}]) {
    layer.prepare(sprites,true,player);
    expect(layer.active).toBe(player.x===3 && player.y===6);
    expect(isPlayerTileLoot(loot,player)).toBe(layer.active);
  }
  layer.prepare(sprites,true,null);expect(layer.active).toBe(false);
  layer.dispose();
});
