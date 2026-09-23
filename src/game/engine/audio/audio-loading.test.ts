import { expect, it, vi } from "vitest";
import { AudioHapticsPlatform, type AudioHapticsPlatformDependencies } from "./audio-haptics-platform";
import type { FmodRuntime } from "../../../audio";
import type { MessageSoundHooks } from "../../message-sound-hooks";
vi.mock("../../../logging",()=>({logWithOriginal:vi.fn()}));

it("loading joins an existing FMOD initialization and waits for sample preload too",async()=>{
  let finishRuntime!:()=>void, finishSamples!:()=>void;
  const initialize=vi.fn(()=>new Promise<void>(done=>{finishRuntime=done;}));
  const preload=vi.fn(()=>new Promise<void>(done=>{finishSamples=done;}));
  const audio=new AudioHapticsPlatform({engineState:{clientOptions:{soundEnabled:true},disposed:false}} as AudioHapticsPlatformDependencies);
  audio.fmodRuntime={initialize,isInitialized:()=>false,setEnabled:vi.fn(),
    isUsingThreadedAudioMixing:()=>true,getThreadingDiagnostics:()=>({backendMode:"audio-worklet-shared"})} as unknown as FmodRuntime;
  audio.messageSoundHooks={preload} as unknown as MessageSoundHooks;
  const background=audio.initializeFmodRuntime();
  let ready=false;const loading=audio.prepareAudioForLoading().then(()=>{ready=true;});
  expect(initialize).toHaveBeenCalledOnce();expect(preload).toHaveBeenCalledOnce();
  finishRuntime();await background;expect(ready).toBe(false);
  finishSamples();await loading;expect(ready).toBe(true);
});
it("skips loading audio when disabled",async()=>{
  const audio=new AudioHapticsPlatform({engineState:{clientOptions:{soundEnabled:false},disposed:false}} as AudioHapticsPlatformDependencies);
  await expect(audio.prepareAudioForLoading()).resolves.toBeUndefined();
});
