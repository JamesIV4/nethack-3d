import * as THREE from "three";
import { expect, it } from "vitest";
import { WeaponGesture } from "./weapon-gesture";
function fixture(sensitivity=1){const detector=new WeaponGesture(),aim=new THREE.Vector3(0,0,-1);let time=1,x=0;const sample=(dx:number,dt=20,allowed=true)=>{time+=dt;x+=dx;return detector.sample(new THREE.Vector3(x,0,0),aim,time,sensitivity,allowed)};for(let i=0;i<9;i++)sample(0);return{sample,detector};}
it("detects one follow-through swipe without enemy contact or repeated attacks",()=>{const f=fixture();const hits=[];for(let i=0;i<12;i++)if(f.sample(.04))hits.push(i);expect(hits).toHaveLength(1);});
it("detects a short bonk that stops and is held out",()=>{const f=fixture();for(let i=0;i<3;i++)expect(f.sample(.035)).toBeNull();const hits=[];for(let i=0;i<10;i++)if(f.sample(0))hits.push(i);expect(hits).toHaveLength(1);});
it("rejects jitter, UI interaction, and tracking discontinuities",()=>{const f=fixture();for(let i=0;i<30;i++)expect(f.sample(i%2?.001:-.001)).toBeNull();for(let i=0;i<10;i++)expect(f.sample(.05,20,false)).toBeNull();expect(f.sample(2,500)).toBeNull();expect(f.sample(.1)).toBeNull();});
it("higher sensitivity permits a lighter swipe and rearms only after quiet recovery",()=>{const low=fixture(.5),high=fixture(2);let lowHits=0,highHits=0;for(let i=0;i<12;i++){if(low.sample(.025))lowHits++;if(high.sample(.025))highHits++;}expect(lowHits).toBe(0);expect(highHits).toBe(1);for(let i=0;i<9;i++)high.sample(0);for(let i=0;i<12;i++)if(high.sample(.025))highHits++;expect(highHits).toBe(2);});
