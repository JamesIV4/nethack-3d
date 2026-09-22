import { expect, it, vi } from "vitest";
import { SpriteTrace } from "./sprite-trace";

it("sends changed presentation states and preserves repeated lifecycle events without console logging", async () => {
  const send = vi.fn(async (_body:string)=>{}), trace = new SpriteTrace(()=>true,send);
  trace.record("presentation","3,6",{standing:true});
  trace.record("presentation","3,6",{standing:true});
  trace.record("clear","3,6",{},false); trace.record("clear","3,6",{},false);
  trace.flush(0);
  const records=send.mock.calls[0][0].split("\n").map(line=>JSON.parse(line));
  expect(records.map(r=>r.event)).toEqual(["trace-ready","presentation","clear","clear"]);
  await Promise.resolve(); await Promise.resolve();
  trace.record("presentation","3,6",{standing:false}); trace.flush(100);
  expect(send).toHaveBeenCalledOnce();
  trace.flush(200); expect(send).toHaveBeenCalledTimes(2);
});

it("bounds queued records and payloads while reporting dropped data", () => {
  const send=vi.fn(async (_body:string)=>{}),trace=new SpriteTrace(()=>true,send);
  for(let i=0;i<300;i++) trace.record("tile",String(i),{glyph:123,char:"\u263a"});
  trace.flush(0);
  const body=send.mock.calls[0][0],lines=body.split("\n");
  expect(lines.length).toBeLessThanOrEqual(24); expect(body.length).toBeLessThanOrEqual(6100);
  expect(body).not.toMatch(/[^\x20-\x7e\n]/);
  expect(JSON.parse(lines[0])).toMatchObject({event:"dropped"});
});

it("does nothing when disabled and stops repeated requests after a transport failure", async () => {
  const send=vi.fn(async (_body:string)=>{throw new Error("unavailable");});
  const disabled=new SpriteTrace(()=>false,send); disabled.record("tile","1",{});disabled.flush(0);
  expect(send).not.toHaveBeenCalled();
  const trace=new SpriteTrace(()=>true,send);trace.record("tile","1",{});trace.flush(0);
  await Promise.resolve();await Promise.resolve();
  trace.record("tile","2",{});trace.flush(1000);expect(send).toHaveBeenCalledOnce();
});
