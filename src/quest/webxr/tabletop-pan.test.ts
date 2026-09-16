import { expect, it } from "vitest";
import { TabletopPan } from "./tabletop-pan";

it("starts at the current tabletop center and then applies a heavy time-based follow", () => {
  const pan = new TabletopPan();
  expect(pan.update({ x: 4, y: -3 }, 100)).toMatchObject({ x: 4, y: -3 });
  expect(pan.update({ x: 12, y: 5 }, 600)).toMatchObject({ x: 8, y: 1 });
});

it("produces the same follow amount across different XR frame cadences", () => {
  const once = new TabletopPan();
  const stepped = new TabletopPan();
  once.update({ x: 0, y: 0 }, 0); stepped.update({ x: 0, y: 0 }, 0);
  const target = { x: 10, y: -6 };
  once.update(target, 250);
  for (let time = 25; time <= 250; time += 25) stepped.update(target, time);
  expect(stepped.center.x).toBeCloseTo(once.center.x);
  expect(stepped.center.y).toBeCloseTo(once.center.y);
});

it("resets to the current game center when tabletop play starts again", () => {
  const pan = new TabletopPan();
  pan.update({ x: 0, y: 0 }, 0);
  pan.update({ x: 10, y: 0 }, 250);
  pan.reset({ x: -7, y: 9 });
  expect(pan.update({ x: -7, y: 9 }, 1000)).toMatchObject({ x: -7, y: 9 });
});
