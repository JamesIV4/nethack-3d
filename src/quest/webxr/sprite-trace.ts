import type * as THREE from "three";
import { isQuestApk } from "./host";

// TEMPORARY: disable after the movement/under-player sprite reproduction.
export const QUEST_SPRITE_TRACE_ENABLED = true;
export const spriteTraceEnabled = () => QUEST_SPRITE_TRACE_ENABLED && isQuestApk();

/** Bounded, change-only records; no console setting or debug APK is required. */
export class SpriteTrace {
  private readonly signatures = new Map<string,string>();
  private queue: string[] = [];
  private pending = false;
  private lastSend = -Infinity;
  private sequence = 0;
  private dropped = 0;
  private ready = false;
  private failed = false;
  constructor(private readonly enabled = spriteTraceEnabled,
    private readonly send = async (body: string) => {
      const response = await fetch("/__xr/sprite-trace", {method:"POST",headers:{"Content-Type":"application/x-ndjson"},body});
      if (!response.ok) throw new Error(`Sprite trace transport: ${response.status}`);
    }) {}
  record(event: string, key: string, state: Record<string,unknown>, changedOnly = true): void {
    if (this.failed || !this.enabled()) return;
    const signature = JSON.stringify(state), cacheKey = event+":"+key;
    if (changedOnly && this.signatures.get(cacheKey) === signature) return;
    if (changedOnly) this.signatures.set(cacheKey,signature);
    if (this.signatures.size > 128) this.signatures.delete(this.signatures.keys().next().value!);
    if (!this.ready) { this.ready = true; this.queue.push(JSON.stringify({event:"trace-ready",version:1,time:Date.now()})); }
    const line = JSON.stringify({seq:++this.sequence,time:Date.now(),event,key,...state})
      .replace(/[^\x20-\x7e]/g, char => "\\u"+char.charCodeAt(0).toString(16).padStart(4,"0"));
    if (line.length > 2500) { this.dropped++; return; }
    if (this.queue.length >= 128) { this.queue.shift(); this.dropped++; }
    this.queue.push(line);
  }
  flush(now: number): void {
    if (this.pending || this.failed || !this.enabled() || !this.queue.length || now-this.lastSend < 200) return;
    const lines: string[] = [];
    let length = 0;
    if (this.dropped) { lines.push(JSON.stringify({event:"dropped",count:this.dropped})); this.dropped = 0; }
    while (this.queue.length && lines.length < 24 && length+this.queue[0].length+1 <= 6000) {
      const line = this.queue.shift()!; lines.push(line); length += line.length+1;
    }
    this.pending = true; this.lastSend = now;
    void this.send(lines.join("\n")).catch(() => { this.failed = true; this.queue.length = 0; })
      .finally(() => { this.pending = false; });
  }
}
export const spriteTrace = new SpriteTrace();

export function traceSpritePresentation(sprites: ReadonlyMap<string,THREE.Sprite>,
  tiles: ReadonlyMap<string,THREE.Mesh>, player: {x:number;y:number}, state: Record<string,unknown>): void {
  if (!spriteTraceEnabled()) return;
  spriteTrace.record("view","player",{player,...state});
  const round = (values: number[]) => values.map(n=>Math.round(n*1000)/1000);
  for (const [key,sprite] of sprites) {
    const {tileX:x,tileY:y} = sprite.userData;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x-player.x)>2 || Math.abs(y-player.y)>2) continue;
    const standing = sprite.userData.fpsPitchLockedProxyMesh as THREE.Mesh | undefined;
    const flat = sprite.userData.flatBillboardProxyMesh as THREE.Mesh | undefined;
    const floor = tiles.get(`${x},${y}`);
    spriteTrace.record("presentation",key,{player,x,y,entity:sprite.userData.entityType,tileIndex:sprite.userData.tileIndex,
      spriteVisible:sprite.visible,standing:standing?.visible??false,flat:flat?.visible??false,
      position:round((standing?.visible?standing:sprite).position.toArray()),
      rotation:round((standing?.visible?standing:sprite).quaternion.toArray()),
      scale:round((standing?.visible?standing:sprite).scale.toArray()),
      floorGlyph:floor?.userData.sourceGlyph,floorTextureGlyph:floor?.userData.tileTextureSourceGlyph,...state});
  }
}
