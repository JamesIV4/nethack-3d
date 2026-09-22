import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { AimHighlights, type AimHighlightsDependencies } from "./aim-highlights";

it("uses controller tiles in VR, permits glance selection, and restores desktop view-based aim on exit",()=>{
  let fps=true,glance=false;
  const floor=new THREE.Mesh(),wall=new THREE.Mesh();wall.userData.isWall=true;
  const aim=vi.fn(()=>({dx:1,dy:0}));
  const owner=new AimHighlights({
    camera:{getFpsAimDirectionFromCamera:aim},movementInput:{isFpsMode:()=>fps,shouldUseFpsSelfTileDirectionTarget:()=>false},
    playerMovement:{playerPos:{x:2,y:2}},positionSelection:{isFpsFarLookViewActive:()=>glance},
    promptDialogs:{isAnyModalVisible:()=>false},questionMenus:{isInQuestion:false},directionPrompts:{isInDirectionQuestion:false},
    tilesetAssets:{shouldUseVultureTiles:()=>false},tileRendering:{tileMap:new Map([["0,0",floor],["6,4",floor],["3,2",floor],["7,4",wall]])},
  } as unknown as AimHighlightsDependencies);
  owner.fpsForwardHighlight=new THREE.Mesh();vi.spyOn(owner,"ensureFpsAimVisuals").mockImplementation(()=>{});
  owner.setXrTarget(true,{x:6,y:4});owner.updateFpsAimVisuals(0);
  expect(owner.fpsForwardHighlight.position.toArray()).toEqual([6,-4,.03]);expect(aim).not.toHaveBeenCalled();
  owner.setXrTarget(true,null);owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(false);
  owner.setXrTarget(true,{x:6,y:4},false,true);owner.updateFpsAimVisuals(1);
  expect(owner.fpsForwardHighlight.position.toArray()).toEqual([3,-2,.03]);aim.mockClear();
  owner.setXrTarget(true,{x:-1,y:0});owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(false);
  owner.setXrTarget(true,{x:6,y:5});owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(true);
  owner.setXrTarget(true,{x:5,y:5});owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(true);
  owner.setXrTarget(true,{x:6,y:6});owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(false);
  owner.setXrTarget(true,{x:8,y:4});owner.updateFpsAimVisuals(1);expect(owner.fpsForwardHighlight.visible).toBe(false);
  glance=true;owner.setXrTarget(true,{x:7,y:4},true);owner.updateFpsAimVisuals(2);
  expect(owner.fpsForwardHighlight.visible).toBe(true);expect(owner.fpsForwardHighlight.position.z).toBeCloseTo(1.02);
  glance=false;owner.setXrTarget(true,{x:7,y:4});owner.updateFpsAimVisuals(3);expect(owner.fpsForwardHighlight.visible).toBe(false);
  fps=false;owner.setXrTarget(true,{x:6,y:4});owner.updateFpsAimVisuals(4);expect(owner.fpsForwardHighlight.visible).toBe(true);
  fps=true;owner.setXrTarget(false,null);owner.updateFpsAimVisuals(5);
  expect(aim).toHaveBeenCalledOnce();expect(owner.fpsForwardHighlight.position.toArray()).toEqual([3,-2,.03]);
});
