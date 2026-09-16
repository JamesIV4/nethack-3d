import { expect, it } from "vitest";
import { selectMenuPosition } from "./form-controls";

it("starts a dropdown at its source select when there is room below", () => {
  expect(selectMenuPosition({ left: 820, top: 380, bottom: 410, width: 200 }, { width: 240, height: 260 }, 1600, 1000))
    .toMatchObject({ left: 820, top: 410, minWidth: 200, maxWidth: 1584 });
});

it("keeps a dropdown inside the document bounds by flipping above or clamping horizontally", () => {
  expect(selectMenuPosition({ left: 1500, top: 944, bottom: 980, width: 100 }, { width: 240, height: 260 }, 1600, 1000))
    .toMatchObject({ left: 1352, top: 684, minWidth: 100, maxHeight: 936 });
});
