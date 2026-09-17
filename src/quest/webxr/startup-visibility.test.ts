import {afterEach,expect,it,vi} from "vitest";
import {revealFlatStartup} from "./startup-visibility";
afterEach(()=>vi.unstubAllGlobals());
it("reveals recovery UI only on the bundled APK origin",async()=>{
 const fetch=vi.fn(async()=>({ok:true}));vi.stubGlobal("fetch",fetch);
 for(const url of ["http://localhost:5173/?xrHost=native","http://localhost:5173/?xrHost=wired","https://example.com"]){vi.stubGlobal("location",new URL(url));await revealFlatStartup();}
 expect(fetch).not.toHaveBeenCalled();vi.stubGlobal("location",new URL("http://127.0.0.1:18973/"));await revealFlatStartup();
 expect(fetch).toHaveBeenCalledWith("/__xr/startup-flat-ready",{method:"POST",headers:{"Content-Type":"application/json"},body:"[]"});
});
it("keeps XR failure handling usable if recovery notification fails",async()=>{
 vi.stubGlobal("location",new URL("http://127.0.0.1:18973/"));vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:503})));
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
 try{await expect(revealFlatStartup()).resolves.toBeUndefined();expect(warn).toHaveBeenCalledOnce();}finally{warn.mockRestore();}
});
