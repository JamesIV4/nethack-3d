import { expect, it } from "vitest";
import { MovementPreview } from "./movement-preview";

it.each([{x:0,y:0},{x:0,y:-1}])("does not switch for a laser that retains player-relative offset %j",offset=>{
  const p=new MovementPreview(),stick={dx:1,dy:0};
  p.resolve({x:4,y:5},null,{x:4+offset.x,y:5+offset.y},{x:4,y:4});
  expect(p.resolve({x:4,y:5},stick,{x:4+offset.x,y:5+offset.y},{x:4,y:4})).toEqual({x:4,y:4});
  expect(p.resolve({x:5,y:5},stick,{x:5+offset.x,y:5+offset.y},{x:5,y:4})).toEqual({x:5,y:4});
  expect(p.resolve({x:5,y:5},null,{x:5+offset.x,y:5+offset.y},{x:6,y:5})).toEqual({x:6,y:5});
  expect(p.source).toBe("headset");
});
it("lets a deliberate relative laser change take over even while LS remains held",()=>{
  const p=new MovementPreview(),player={x:4,y:5},stick={dx:1,dy:0};
  p.resolve(player,stick,{x:4,y:5},{x:4,y:4});
  expect(p.resolve(player,stick,{x:6,y:5},{x:4,y:4})).toEqual({x:6,y:5});
  expect(p.source).toBe("laser");
  expect(p.resolve({x:5,y:5},stick,{x:7,y:5},{x:5,y:4})).toEqual({x:7,y:5});
  p.resolve({x:5,y:5},null,{x:7,y:5},{x:5,y:4});
  expect(p.resolve({x:5,y:5},stick,{x:7,y:5},{x:5,y:4})).toEqual({x:5,y:4});
});
it("ignores camera-follow lag and missing targets rather than inventing relative tile transitions",()=>{
  const p=new MovementPreview(),head={x:5,y:4};
  p.resolve({x:4,y:5},{dx:1,dy:0},{x:4,y:5},head);
  p.resolve({x:5,y:5},null,{x:4,y:5},head,false);
  expect(p.source).toBe("headset");
  p.resolve({x:5,y:5},null,{x:5,y:5},head,true);
  p.resolve({x:5,y:5},null,null,head);
  expect(p.resolve({x:5,y:5},null,{x:5,y:5},head)).toEqual(head);
  expect(p.resolve({x:5,y:5},null,{x:6,y:5},head)).toEqual({x:6,y:5});
  p.reset();expect(p.source).toBe("laser");
});

it("keeps laser movement sticky without relative tile changes and requires a fresh LS threshold crossing",()=>{
  const p=new MovementPreview(),head={x:4,y:4},stick={dx:1,dy:0};
  p.resolve({x:4,y:5},stick,{x:4,y:5},head);
  p.useLaser(); // Accepted RT movement also activates laser highlighting.
  expect(p.resolve({x:5,y:5},stick,{x:5,y:5},{x:5,y:4})).toEqual({x:5,y:5});
  expect(p.resolve({x:6,y:5},{dx:0,dy:1},{x:6,y:5},{x:6,y:4})).toEqual({x:6,y:5});
  expect(p.source).toBe("laser");
  p.resolve({x:6,y:5},null,{x:6,y:5},head);
  p.resolve({x:6,y:5},stick,{x:6,y:5},head);
  expect(p.source).toBe("headset");
});

it.each(["yaw","pitch"])("reclaims headset highlighting after 30 degrees of %s from laser activation",axis=>{
  const p=new MovementPreview(),player={x:4,y:5};
  const look=(degrees:number)=>{const angle=degrees*Math.PI/180;return {x:axis==="yaw"?Math.sin(angle):0,y:axis==="pitch"?Math.sin(angle):0,z:-Math.cos(angle)};};
  p.resolve(player,null,player,{x:4,y:4},true,look(0));
  for(const degrees of [10,20,29.9]) {
    p.useLaser(); // Repeated RT actions do not reset the head-angle reference.
    p.resolve(player,null,player,{x:4,y:4},true,look(degrees));
    expect(p.source).toBe("laser");
  }
  p.resolve(player,null,{x:5,y:5},{x:4,y:4},true,look(30));
  expect(p.source).toBe("headset"); // Head turn wins even if the laser changes this frame.
  p.resolve(player,null,{x:5,y:5},{x:4,y:4},true,look(30));expect(p.source).toBe("headset");
  p.resolve(player,null,{x:6,y:5},{x:4,y:4},true,look(35));expect(p.source).toBe("laser");
  p.resolve(player,null,{x:6,y:5},{x:4,y:4},true,look(64));expect(p.source).toBe("laser");
  p.resolve(player,null,{x:6,y:5},{x:4,y:4},true,look(65));expect(p.source).toBe("headset");
});

it("rebases relative laser tracking after a stick turn, waiting for a settled target",()=>{
  const p=new MovementPreview(),player={x:4,y:5},head={x:5,y:5};
  p.resolve(player,null,{x:4,y:4},head);
  p.useHeadset();
  p.resolve(player,null,{x:8,y:5},head,false);
  expect(p.source).toBe("headset");
  expect(p.resolve(player,null,{x:6,y:5},head)).toEqual(head);
  p.resolve({x:5,y:5},null,{x:7,y:5},{x:6,y:5});
  expect(p.source).toBe("headset");
  p.resolve({x:5,y:5},null,{x:7,y:6},{x:6,y:5});
  expect(p.source).toBe("laser");
});
