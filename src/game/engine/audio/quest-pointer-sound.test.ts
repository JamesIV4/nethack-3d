import { afterAll, expect, it, vi } from "vitest";
vi.hoisted(() => { vi.stubGlobal("window", { location: new URL("http://localhost/"), matchMedia: () => ({matches:false,addEventListener() {}}) }); });
afterAll(() => vi.unstubAllGlobals());
import { AudioHapticsPlatform, type AudioHapticsPlatformDependencies } from "./audio-haptics-platform";
import { InputCommands } from "../input/input-commands";
import type { MessageSoundHooks } from "../../message-sound-hooks";
function fixture() {
  const sound=vi.fn(), cooldown=vi.fn(), send=vi.fn();
  const deps={engineState:{clientOptions:{soundEnabled:true}}, movementInput:{isFpsMode:()=>true,isPlayerCliparoundInputCooldownActive:()=>false}, playerMovement:{playerPos:{x:4,y:5}},questionMenus:{isInQuestion:false},directionPrompts:{isInDirectionQuestion:false},positionSelection:{positionInputModeActive:false}};
  const audio=new AudioHapticsPlatform(deps as unknown as AudioHapticsPlatformDependencies);
  audio.messageSoundHooks={playPlayerFootstepSound:sound} as unknown as MessageSoundHooks;
  const commands=Object.create(InputCommands.prototype);
  commands.dependencies={engineState:{session:{sendMouseInput:send}},tileContextActions:{closeAnyTileContextMenu:vi.fn()},audioHapticsPlatform:audio,movementInput:{armPlayerCliparoundInputCooldown:cooldown},darkCorridorInference:{beginDarkCorridorDiscoveryWindowFromPlayerInput:vi.fn()}};
  commands.dependencies.tilesetAssets = { vultureTilesetTranslator: null };
  return {commands:commands as InputCommands,audio,sound,cooldown,send,deps};
}
it("arms laser movement in FPS and plays a footstep only after runtime-confirmed movement", () => {
  const f=fixture();
  f.commands.sendMouseInput(5,5,0,{allowFpsMovement:true});
  expect(f.audio.pendingPlayerFootstepSoundArmed).toBe(true);expect(f.cooldown).toHaveBeenCalledOnce();expect(f.sound).not.toHaveBeenCalled();
  f.audio.playPlayerFootstepSoundFromCliparoundIfEligible(4,5,5,5);expect(f.sound).toHaveBeenCalledOnce();
  f.commands.sendMouseInput(6,5,0,{allowFpsMovement:true});
  f.audio.playPlayerFootstepSoundFromCliparoundIfEligible(5,5,5,5);expect(f.sound).toHaveBeenCalledOnce();
});
it("preserves attack clicks, self-tile actions, secondary clicks, prompt gates and muted sound", () => {
  const f=fixture();
  f.commands.sendMouseInput(5,5,0);expect(f.audio.pendingPlayerFootstepSoundArmed).toBe(false);
  for(const [x,y,button] of [[4,5,0],[5,5,2]]) { f.commands.sendMouseInput(x,y,button,{allowFpsMovement:true});expect(f.audio.pendingPlayerFootstepSoundArmed).toBe(false); }
  f.deps.positionSelection.positionInputModeActive=true;f.commands.sendMouseInput(5,5,0,{allowFpsMovement:true});expect(f.audio.pendingPlayerFootstepSoundArmed).toBe(false);
  f.deps.positionSelection.positionInputModeActive=false;f.deps.engineState.clientOptions.soundEnabled=false;
  f.commands.sendMouseInput(5,5,0,{allowFpsMovement:true});expect(f.audio.pendingPlayerFootstepSoundArmed).toBe(false);
});

it("force-fight sequences do not predict walking or arm footsteps",()=>{
 const predict=vi.fn(), footstep=vi.fn(), send=vi.fn();
 const commands=Object.create(InputCommands.prototype);
 commands.numberPadModeEnabled=true;
 commands.dependencies={engineState:{session:{sendInputSequence:send}},combatAttribution:{},tileContextActions:{closeAnyTileContextMenu:vi.fn()},movementInput:{isMovementInput:(input:string)=>input==="6",isRunPrefixInput:()=>false},camera:{},audioHapticsPlatform:{armPendingPlayerFootstepSound:footstep},playerMovement:{setFpsPredictedPlayerTileFromMovementInput:predict},darkCorridorInference:{beginDarkCorridorDiscoveryWindowFromPlayerInput:vi.fn()}};
 commands.sendInputSequence(["F","6"]);expect(send).toHaveBeenCalledWith(["F","6"],{delayMs:undefined});expect(predict).not.toHaveBeenCalled();expect(footstep).not.toHaveBeenCalled();
 commands.sendInputSequence(["6","6"]);expect(predict).toHaveBeenCalledWith("6");expect(footstep).toHaveBeenCalledOnce();
});
