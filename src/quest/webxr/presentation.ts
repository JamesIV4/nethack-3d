export type WebXrState = Readonly<{
  available: boolean; active: boolean; busy: boolean; error: string; host: boolean;
}>;
type Owner = { enter: () => Promise<void>; exit: () => Promise<void>; recenter: () => void };
const listeners = new Set<() => void>();
let owner: Owner | null = null;
let state: WebXrState = Object.freeze({ available: false, active: false, busy: false, error: "", host: false });
export function getWebXrState(): WebXrState { return state; }
export function subscribeWebXr(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function updateWebXrState(update: Partial<WebXrState>): void {
  state = Object.freeze({ ...state, ...update }); listeners.forEach((listener) => listener());
}
export function registerWebXrOwner(value: Owner): () => void {
  owner = value;
  return () => { if (owner === value) { owner = null; updateWebXrState({ available: false, active: false, busy: false }); } };
}
export async function toggleWebXr(): Promise<void> {
  if (!owner || state.busy) return;
  updateWebXrState({ busy: true, error: "" });
  try { if (state.active) await owner.exit(); else await owner.enter(); }
  catch (error) { updateWebXrState({ error: error instanceof Error ? error.message : String(error) }); }
  finally { updateWebXrState({ busy: false }); }
}
export function recenterWebXr(): void { owner?.recenter(); }
