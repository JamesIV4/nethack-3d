/** Resolve exact runtime geometry to an offline-baked bundled copy. */
export class ControllerPrebakedModels {
  private manifest: Promise<Record<string,string>> | null = null;
  async resolve(bytes: ArrayBuffer, signal: AbortSignal): Promise<ArrayBuffer> {
    if (!globalThis.crypto?.subtle) return bytes;
    try {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      this.manifest ??= fetch("/quest-controllers/prebaked.json", { signal }).then(async response => {
        if (!response.ok) return {};
        const json = await response.json();
        return json.version === 1 ? json.runtime ?? {} : {};
      }).catch(() => ({}));
      const models = await this.manifest;
      const url = `/quest-controllers/runtime/${hash}.glb`;
      if (models[hash] !== url) return bytes;
      const response = await fetch(url, { signal });
      if (!response.ok) return bytes;
      const baked = await response.arrayBuffer(), header = new DataView(baked);
      if (baked.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(16, true) !== 0x4e4f534a) return bytes;
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(baked, 20, header.getUint32(12, true))));
      return json.asset?.extras?.nh3dOcclusion?.sourceSha256 === hash ? baked : bytes;
    } catch (error) {
      if (signal.aborted) throw error;
      // New system geometry or missing optional assets still gets normal lighting.
      // Never spend startup time baking an unknown controller on the device.
      return bytes;
    }
  }
}
