import { afterAll, expect, it, vi } from "vitest";
vi.hoisted(()=>vi.stubGlobal("window",{location:new URL("http://localhost"),matchMedia:()=>({matches:false,addEventListener(){}})}));
import { HeldWeapon } from "./held-weapon";
afterAll(()=>vi.unstubAllGlobals());
it("resolves active hands without treating an unwielded alternate weapon as the off hand",()=>{
 const right={text:'a sword (weapon in hand)'},left={text:'a dagger (wielded in other hand)'},alternate={text:'a mace (alternate weapon; not wielded)'};
 const held=Object.create(HeldWeapon.prototype);held.dependencies={promptDialogs:{currentInventory:[alternate,left,right]}};
 expect(held.findHeldWeaponInventoryItem('right')).toBe(right);expect(held.findHeldWeaponInventoryItem('left')).toBe(left);expect(held.findHeldWeaponInventoryItem()).toBe(right);
 held.dependencies.promptDialogs.currentInventory=[alternate,{text:'a sword (weapon in left hand)'}];
 expect(held.findHeldWeaponInventoryItem('left')?.text).toContain('left hand');expect(held.findHeldWeaponInventoryItem('right')).toBeNull();
});
