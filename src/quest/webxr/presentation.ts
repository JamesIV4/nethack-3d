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
async function perform(action: "enter" | "exit"): Promise<void> {
  const current = owner;
  if (!current || state.busy) return;
  updateWebXrState({ busy: true, error: "" });
  try { await current[action](); }
  catch (error) {
    if (owner === current) updateWebXrState({ error: error instanceof Error ? error.message : String(error) });
  } finally { if (owner === current) updateWebXrState({ busy: false }); }
}
/** Startup requests entry explicitly so an already active session cannot be toggled off. */
export async function enterWebXr(): Promise<void> {
  if (!state.active) await perform("enter");
}
export async function toggleWebXr(): Promise<void> {
  await perform(state.active ? "exit" : "enter");
}
export function recenterWebXr(): void { owner?.recenter(); }
