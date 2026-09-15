import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./gameStore";

vi.hoisted(() => vi.stubGlobal("window", {
  matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" },
}));
afterAll(() => vi.unstubAllGlobals());
afterEach(() => useGameStore.setState(useGameStore.getInitialState(), true));

describe("HUD publication", () => {
  it("keeps identical snapshots idle while publishing every actual status change synchronously", () => {
    const initial = useGameStore.getState().playerStats;
    const observed: number[] = [];
    const unsubscribe = useGameStore.subscribe(state => observed.push(state.playerStats.hp));
    for (let i = 0; i < 100; i++) useGameStore.getState().setPlayerStats({ ...initial });
    expect(observed).toEqual([]);
    expect(useGameStore.getState().playerStats).toBe(initial);
    useGameStore.getState().setPlayerStats({ ...initial, hp: initial.hp - 1 });
    useGameStore.getState().setPlayerStats({ ...initial });
    expect(observed).toEqual([initial.hp - 1, initial.hp]);
    unsubscribe();
  });

  it("retains message order and position-mode origin changes", () => {
    const store = useGameStore.getState();
    store.setGameMessages(["first", "second"]);
    const previous = useGameStore.getState().gameMessages;
    store.setGameMessages(["first", "second"]);
    expect(useGameStore.getState().gameMessages).toBe(previous);
    store.setGameMessages(["second", "first"]);
    expect(useGameStore.getState().gameMessages).toEqual(["second", "first"]);
    store.setPositionInputActive(true, "far-look");
    store.setPositionInputActive(true, "travel");
    expect(useGameStore.getState().positionInputOrigin).toBe("travel");
    store.setPositionInputActive(false, "travel");
    expect(useGameStore.getState().positionInputOrigin).toBeNull();
  });
});
