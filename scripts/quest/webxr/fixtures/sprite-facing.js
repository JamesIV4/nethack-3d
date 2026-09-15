import * as THREE from 'three';
import {Lighting} from './src/game/engine/rendering/lighting.ts';
import {ScaledCameraSprites} from './src/game/engine/rendering/scaled-camera-sprites.ts';
window.probePromise=(async()=>{
const renderer=new THREE.WebGLRenderer(),target=new THREE.WebGLRenderTarget(256,256);renderer.setRenderTarget(target);renderer.setClearColor(0,1);
const scene=new THREE.Scene(),head=new THREE.Vector3(0,-3,2),center=new THREE.Vector3(1,0,0),up0=new THREE.Vector3(0,0,1);
const sprite=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff}));sprite.position.copy(center);sprite.center.set(.5,0);sprite.scale.set(1.2,1.8,1);scene.add(sprite);
const facing=head.clone().sub(center).normalize(),right=new THREE.Vector3().crossVectors(up0,facing).normalize(),up=new THREE.Vector3().crossVectors(facing,right).normalize();
const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.8),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));mesh.position.copy(center).addScaledVector(up,.9);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,facing));scene.add(mesh);sprite.frustumCulled=false;mesh.frustumCulled=false;
const light={vignetteUniforms:{uLightingCenter:{value:new THREE.Vector2()},uLightingRadius:{value:1000},uFalloffPower:{value:1},uMaxDarkAlpha:{value:0},uIsFpsMode:{value:false},uBloodGroundStrength:{value:0},uBloodGroundSpecularReferenceStrength:{value:0}}};Lighting.prototype.patchMaterialForVignette.call(light,sprite.material);Lighting.prototype.patchMaterialForVignette.call(light,mesh.material);
const texels=new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255]);const texture=new THREE.DataTexture(texels,2,2);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.needsUpdate=true;sprite.material.map=mesh.material.map=texture;
const patch=new ScaledCameraSprites(),results=[];
for(const cameraScale of [1,1/.11]) for(const [yaw,roll] of [[0,0],[.2,.2],[-.3,-.3],[0,1.2]]){
 const cameras=[-.032,.032].map((eye,i)=>{const c=new THREE.PerspectiveCamera(80,.5,.01,50);c.position.copy(head);c.up.copy(up0);c.lookAt(center);c.rotateY(yaw);c.rotateZ(roll);c.translateX(eye*cameraScale);c.scale.setScalar(cameraScale);c.updateMatrixWorld();c.viewport=new THREE.Vector4(i*128,0,128,256);return c;});
 const camera=new THREE.ArrayCamera(cameras);camera.position.copy(head);camera.updateMatrixWorld();patch.prepare(scene,head);
 const render=showSprite=>{sprite.visible=showSprite;mesh.visible=!showSprite;scene.updateMatrixWorld(true);renderer.render(scene,camera);const p=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,p);return p;};
 patch.disable();const old=render(true),b=render(false);patch.prepare(scene,head);const a=render(true);let diff=0,green=0,oldDiff=0;for(let i=0;i<a.length;i+=4){if(a[i+1]>100)green++;if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>10)diff++;if(Math.max(Math.abs(old[i]-b[i]),Math.abs(old[i+1]-b[i+1]),Math.abs(old[i+2]-b[i+2]))>10)oldDiff++;}results.push({cameraScale,yaw,roll,diff,oldDiff,green});
}
renderer.dispose();target.dispose();if(results.some(r=>r.diff>12||r.green<20)||!results.some(r=>r.oldDiff>100))throw new Error(JSON.stringify(results));return {worldPlaneMatchesBothEyes:true,results};})();