import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MessageSoundHooks } from "./message-sound-hooks";

const mocks=vi.hoisted(()=>({load:vi.fn(),blob:vi.fn()}));
vi.mock("../audio/sound-pack-storage",()=>({
  nh3dBaseSoundVariationId:"base",
  nh3dSoundEffectDefinitions:[{key:"player-walk"},{key:"hit"}],
  loadNh3dSoundPackStateFromIndexedDb:mocks.load,
  loadStoredNh3dSoundBlob:mocks.blob,
  resolveNh3dBundledBuiltinSoundPath:(key:string)=>`/${key}.ogg`,
  resolveNh3dMessageLogSoundEffectKeys:()=>[],
}));
const start=vi.fn(),decode=vi.fn(),resume=vi.fn(),close=vi.fn();
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({activePackId:"test",packs:[{id:"test",updatedAt:1,sounds:{}}]});
  decode.mockResolvedValue({});resume.mockResolvedValue(undefined);close.mockResolvedValue(undefined);
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})));
  vi.stubGlobal("AudioContext",class {
    state="running";destination={};decodeAudioData=decode;resume=resume;close=close;
    createBufferSource(){return {connect:vi.fn(),disconnect:vi.fn(),start,buffer:null};}
    createGain(){return {gain:{value:0},connect:vi.fn(),disconnect:vi.fn()};}
  });
});
afterEach(()=>vi.unstubAllGlobals());

it("preloads silently, shares concurrent work and reuses decoded buffers for the first footstep",async()=>{
  const hooks=new MessageSoundHooks({isSoundEnabled:()=>true});
  const first=hooks.preload();expect(hooks.preload()).toBe(first);await first;
  expect(fetch).toHaveBeenCalledTimes(2);expect(decode).toHaveBeenCalledTimes(2);
  expect(start).not.toHaveBeenCalled();expect(resume).not.toHaveBeenCalled();
  hooks.playPlayerFootstepSound();await vi.waitFor(()=>expect(start).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledTimes(2);expect(decode).toHaveBeenCalledTimes(2);
  await hooks.preload();expect(fetch).toHaveBeenCalledTimes(2);
  hooks.dispose();
});
it("preloads enabled variations, skips muted ones, and invalidates buffers when the pack changes",async()=>{
  const now=vi.spyOn(Date,"now").mockReturnValue(10000);
  const entry={enabled:true,volume:1,source:"builtin",path:"/custom.ogg",variations:[
    {id:"extra",enabled:true,volume:1,source:"builtin",path:"/extra.ogg"},
    {id:"off",enabled:false,volume:1,source:"builtin",path:"/off.ogg"},
    {id:"muted",enabled:true,volume:0,source:"builtin",path:"/muted.ogg"},
  ]};
  mocks.load.mockResolvedValue({activePackId:"test",packs:[{id:"test",updatedAt:1,sounds:{"player-walk":entry}}]});
  const hooks=new MessageSoundHooks({isSoundEnabled:()=>true});await hooks.preload();
  expect(vi.mocked(fetch).mock.calls.map(c=>c[0]).sort()).toEqual(["/custom.ogg","/extra.ogg","/hit.ogg"]);
  now.mockReturnValue(20000);mocks.load.mockResolvedValue({activePackId:"test",packs:[{id:"test",updatedAt:2,sounds:{}}]});
  await hooks.preload();expect(decode).toHaveBeenCalledTimes(5);
  hooks.dispose();now.mockRestore();
});
it("does no loading when muted and does not create resources after disposal during pack loading",async()=>{
  const muted=new MessageSoundHooks({isSoundEnabled:()=>false});await muted.preload();
  expect(mocks.load).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();muted.dispose();
  let finish!: (value:unknown)=>void;
  mocks.load.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const hooks=new MessageSoundHooks({isSoundEnabled:()=>true}),pending=hooks.preload();
  hooks.dispose();finish({packs:[]});await pending;
  expect(fetch).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
  await hooks.preload();expect(mocks.load).toHaveBeenCalledOnce();
});
it("tolerates a failed asset without preventing the remaining sounds from warming",async()=>{
  vi.mocked(fetch).mockResolvedValueOnce({ok:false} as Response);
  const hooks=new MessageSoundHooks({isSoundEnabled:()=>true});await expect(hooks.preload()).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(2);expect(decode).toHaveBeenCalledOnce();hooks.dispose();
});
