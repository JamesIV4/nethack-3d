import * as THREE from "three";
import {expect,it,vi} from "vitest";
vi.mock("../../ui-types",()=>({nh3dFpsLookSensitivityMax:4,nh3dFpsLookSensitivityMin:.1}));
import {Camera,type CameraDependencies} from "./camera";
import {TabletopPan} from "../../../quest/webxr/tabletop-pan";
function fixture() {
 const playerPos={x:0,y:0};
 const camera=new Camera({playerMovement:{playerPos},positionSelection:{positionInputModeActive:false},engineState:{clientOptions:{cameraYawSnap:false},playMode:"normal"},movementInput:{isFpsMode:()=>false},terminalRendering:{isTerminalDisplayMode:()=>false}} as unknown as CameraDependencies);
 camera.camera=new THREE.PerspectiveCamera();return {camera,playerPos};
}
it("normal player follow matches the VR table response across frame rates",()=>{
 for(const frames of [1,30,60,90]) {
  const {camera,playerPos}=fixture(),table=new TabletopPan();
  camera.updateCamera(0);table.update(camera.getOverheadCameraFollowTargetWorldPosition(),0);
  playerPos.x=4;playerPos.y=2;camera.normalModePlayerMoveCameraFollowActive=true;
  const target=camera.getOverheadCameraFollowTargetWorldPosition();
  for(let frame=1;frame<=frames;frame++) {camera.updateCamera(.25/frames);table.update(target,frame*250/frames);}
  expect(camera.cameraFollowCurrent.x).toBeCloseTo(target.x/2);
  expect(camera.cameraFollowCurrent.y).toBeCloseTo(target.y/2);
  expect(camera.cameraFollowCurrent.x).toBeCloseTo(table.center.x);
  expect(camera.cameraFollowCurrent.y).toBeCloseTo(table.center.y);
 }
});
it("idle/pan follow uses the same response and initialization still snaps to the target",()=>{
 const {camera,playerPos}=fixture();playerPos.x=10;camera.updateCamera(0);
 const start=camera.cameraFollowCurrent.x;
 camera.cameraPanX=8;camera.isCameraCenteredOnPlayer=false;
 camera.updateCamera(.25);expect(camera.cameraFollowCurrent.x).toBeCloseTo(start+4);
 camera.cameraFollowInitialized=false;camera.updateCamera(.01);expect(camera.cameraFollowCurrent.x).toBeCloseTo(start+8);
});
