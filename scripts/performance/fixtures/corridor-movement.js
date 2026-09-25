// Bundled by the local CPU benchmark. Synthetic scene; no game commands or device access.
import * as THREE from "three";
import { createEngineSystems } from "./src/game/engine/create-engine-systems";
import { normalizeNh3dClientOptions } from "./src/game/ui-types";
import { getDefaultDarkFloorGlyph } from "./src/game/glyphs/behavior";
window.runMovementWork = () => {
  const s=createEngineSystems(new Proxy({}, {get:()=>()=>{}}));
  s.engineState.uiAdapter=new Proxy({}, {get:()=>()=>{}});
  s.engineState.clientOptions=normalizeNh3dClientOptions({tilesetMode:"tiles",fpsMode:true,darkCorridorWalls367:true,blockAmbientOcclusion:true});
  s.engineState.playMode="fps";
  s.engineState.characterCreationConfig={runtimeVersion:"3.6.7",mode:"create"};
  s.renderPipeline.scene=new THREE.Scene();
  s.renderPipeline.renderer={xr:{isPresenting:false},capabilities:{getMaxAnisotropy:()=>1}};
  s.camera.camera=new THREE.PerspectiveCamera();
  s.playerMovement.hasSeenPlayerPosition=true;
  const atlas=document.createElement("canvas");atlas.width=1280;atlas.height=1248;
  const ctx=atlas.getContext("2d");ctx.fillStyle="#617477";ctx.fillRect(0,0,atlas.width,atlas.height);
  s.tilesetAssets.tilesetTexture=new THREE.CanvasTexture(atlas);
  s.tilesetAssets.loadedTilesetTileLayoutVersion="3.6.7";
  const corridor=getDefaultDarkFloorGlyph();
  for(const y of [4,9,14])for(let x=2;x<74;x++)s.levelTerrainCache.lastKnownTerrain.set(`${x},${y}`,{glyph:corridor,char:"#"});
  let calls=0;const update=s.tileRendering.updateTile.bind(s.tileRendering);
  s.tileRendering.updateTile=(...args)=>{calls++;return update(...args);};
  const reconcile=(x,y)=>{s.playerMovement.playerPos={x,y};s.tileUpdates.flushPendingDarkCorridorInference(true);};
  for(const y of [4,9,14])for(let x=4;x<73;x+=4)reconcile(x,y);
  const timings=[];calls=0;
  for(let i=0;i<24;i++) {const begin=performance.now();reconcile(30+i%5,9);timings.push(performance.now()-begin);}
  const total=timings.reduce((a,b)=>a+b,0);
  return {inferredWalls:s.darkCorridorInference.inferredDarkCorridorWallTiles.size,tiles:s.tileRendering.tileMap.size,steps:timings.length,updateTileCalls:calls,totalMs:total,meanMs:total/timings.length,maxMs:Math.max(...timings),sceneGeometry:[...s.tileRendering.tileMap].sort(([a],[b])=>a.localeCompare(b)).map(([key,mesh])=>({key,position:mesh.position.toArray(),scale:mesh.scale.toArray(),geometry:[...mesh.geometry.attributes.position.array],normal:[...mesh.geometry.attributes.normal.array],uv:[...mesh.geometry.attributes.uv.array],index:mesh.geometry.index?[...mesh.geometry.index.array]:null,groups:mesh.geometry.groups}))};
};
