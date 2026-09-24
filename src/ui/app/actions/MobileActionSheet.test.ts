import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getWebXrState, updateWebXrState } from "../../../quest/webxr/presentation";
import { MobileActionSheet, type MobileActionSheetProps } from "./MobileActionSheet";

const game = vi.hoisted(() => ({ connectionState: "running", gameOver: { active: false } }));
vi.mock("../../../state/gameStore", () => ({
  useGameStore: (select: (state: typeof game) => unknown) => select(game),
}));
// Text sizing needs a browser canvas; it is unrelated to menu visibility.
vi.mock("./ActionLabel", () => ({ ActionLabel: ({ children }: { children: string }) => children }));

const initialXr = getWebXrState();
const props: MobileActionSheetProps = {
  mobileTouchUiVisible: false,
  isMobileActionSheetVisible: true,
  mobileActionSheetMode: "quick",
  controller: null,
  mobileCommonExtendedCommandNames: [],
  mobileExtendedCommandNames: ["search"],
  openButtonCustomization: vi.fn(),
  setMobileActionSheetMode: vi.fn(),
  openPauseMenu: vi.fn(),
  setIsMobileActionSheetVisible: vi.fn(),
};
const render = (overrides: Partial<MobileActionSheetProps> = {}) =>
  renderToStaticMarkup(createElement(MobileActionSheet, { ...props, ...overrides }));

beforeEach(() => {
  game.connectionState = "running";
  game.gameOver.active = false;
  updateWebXrState({ active: true });
});
afterEach(() => updateWebXrState(initialXr));

it("renders Menu / Actions after a VR hotbar click before touch UI is ready", () => {
  // At startup, and for desktop pointer layouts, the hotbar is already live
  // while mobileTouchUiVisible is false. A successful click sets this flag.
  expect(render()).toContain('class="nh3d-mobile-actions-sheet" data-mode="quick"');
});

it("renders Extended commands under the same VR startup conditions", () => {
  expect(render({ mobileActionSheetMode: "extended" })).toContain('data-mode="extended"');
});

it("still requires a click to open and honors closing the menu", () => {
  expect(render({ isMobileActionSheetVisible: false })).toBe("");
  expect(render()).toContain("nh3d-mobile-actions-sheet");
  expect(render({ isMobileActionSheetVisible: false })).toBe("");
});

it("preserves flat desktop and mobile visibility", () => {
  updateWebXrState({ active: false });
  expect(render()).toBe("");
  expect(render({ mobileTouchUiVisible: true })).toContain("nh3d-mobile-actions-sheet");
});

it("does not expose the VR menu when gameplay ends", () => {
  game.connectionState = "disconnected";
  expect(render()).toBe("");
  game.connectionState = "running";
  game.gameOver.active = true;
  expect(render()).toBe("");
});
