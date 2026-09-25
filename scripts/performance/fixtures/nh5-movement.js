// Bundled by the local CPU benchmark. Synthetic scene; no game commands or device access.
import * as THREE from "three";
import { createEngineSystems } from "./src/game/engine/create-engine-systems";
import { normalizeNh3dClientOptions } from "./src/game/ui-types";
import { getDefaultFloorGlyph, getDefaultDarkWallGlyph, getDefaultDarkFloorGlyph } from "./src/game/glyphs/behavior";
import { setActiveGlyphCatalog } from "./src/game/glyphs/registry";
window.runMovementWork = async () => {
  await setActiveGlyphCatalog("5.0");
  const s=createEngineSystems(new Proxy({}, {get:()=>()=>{}}));
  s.engineState.uiAdapter=new Proxy({}, {get:()=>()=>{}});
  s.engineState.clientOptions=normalizeNh3dClientOptions({tilesetMode:"tiles",fpsMode:true,darkCorridorWalls367:true,blockAmbientOcclusion:true});
  s.engineState.playMode="fps";
  s.engineState.characterCreationConfig={runtimeVersion:"5.0",mode:"create"};
  s.renderPipeline.scene=new THREE.Scene();
  s.renderPipeline.renderer={xr:{isPresenting:false},capabilities:{getMaxAnisotropy:()=>1}};
  s.camera.camera=new THREE.PerspectiveCamera();
  s.playerMovement.hasSeenPlayerPosition=true;
  const atlas=document.createElement("canvas");atlas.width=1280;atlas.height=1248;
  const ctx=atlas.getContext("2d");ctx.fillStyle="#617477";ctx.fillRect(0,0,atlas.width,atlas.height);
  s.tilesetAssets.tilesetTexture=new THREE.CanvasTexture(atlas);
  s.tilesetAssets.loadedTilesetTileLayoutVersion="5.0";
  s.playerMovement.playerPos={x:10,y:10};
  const floor=getDefaultFloorGlyph(), dark=getDefaultDarkFloorGlyph(), wall=getDefaultDarkWallGlyph();
  const wallTile=(x,y)=>x%10===0||y%5===0;
  const tile=(x,y,dim)=>({x,y,glyph:wallTile(x,y)?wall:dim?dark:floor,char:wallTile(x,y)?"|":dim?"#":"."});
  for(let y=1;y<20;y++)for(let x=1;x<79;x++)s.tileUpdates.enqueueTileUpdate(tile(x,y,false));
  s.tileUpdates.flushPendingTileUpdates(true);
  s.renderPipeline.renderer.xr.isPresenting=true;
  const timings=[],methods={};
  for(const [owner,key] of [["tileUpdates","flushPendingTileUpdatesForPlayerPositionReconcile"],["tileRendering","updateTile"],["floorOcclusion","updateFloorBlockAmbientOcclusionAt"],["wallGeometry","refreshFpsWallChamferGeometryAt"],["glyphTextures","createTileTexture"],["darkCorridorInference","reconcileInferredDarkCorridorWalls"],["wallOverlays","updateWallSideTileOverlay"],["tileUpdates","processPendingTileUpdate"]]){
    const original=s[owner][key];if(typeof original!=="function")continue;
    const record=methods[owner+"."+key]={calls:0,totalMs:0,maxMs:0};
    s[owner][key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const dt=performance.now()-start;record.calls++;record.totalMs+=dt;record.maxMs=Math.max(record.maxMs,dt);}};
  }
  for(let i=0;i<24;i++) {
    const old=s.playerMovement.playerPos,next={x:11+i%6,y:12};
    const begin=performance.now();
    for(let y=9;y<16;y++)for(let x=next.x-3;x<=next.x+3;x++)s.tileUpdates.enqueueTileUpdate(tile(x,y,i%2===0));
    s.playerMovement.playerPos=next;
    s.tileUpdates.flushPendingTileUpdatesForPlayerPositionReconcile(old.x,old.y,next.x,next.y);
    s.tileUpdates.refreshTilesAfterPlayerPositionUpdate(old.x,old.y,next.x,next.y);
    s.tileUpdates.flushPendingDarkCorridorInference(true);
    let frames=0;while(s.tileUpdates.tileFlushScheduled && frames++<100)s.tileUpdates.flushPendingTileUpdatesForFrame();
    timings.push(performance.now()-begin);
  }
  return {runtime:"5.0",tiles:s.tileRendering.tileMap.size,steps:24,totalMs:timings.reduce((a,b)=>a+b,0),meanMs:timings.reduce((a,b)=>a+b,0)/24,maxMs:Math.max(...timings),methods,sceneGeometry:[...s.tileRendering.tileMap].sort(([a],[b])=>a.localeCompare(b)).map(([key,mesh])=>({key,position:mesh.position.toArray(),scale:mesh.scale.toArray(),geometry:[...mesh.geometry.attributes.position.array]}))};
};
