import { test } from "node:test";
import assert from "node:assert/strict";
import { patchTouchOwnershipSource } from "./patch-touch-ownership.mjs";

test("touch ownership patch is repeatable on prepared checkouts", () => {
  const anchor = "        boolean moving = (device.mCoords[0].x != aX) || (device.mCoords[0].y != aY);";
  const patched = patchTouchOwnershipSource(anchor);
  assert.notEqual(patched, anchor);
  assert.equal(patchTouchOwnershipSource(patched), patched);
  assert.equal(patchTouchOwnershipSource(patched.replaceAll("\n", "\r\n")), patched);
});

test("touch ownership patch rejects changed or ambiguous upstream code", () => {
  assert.throws(() => patchTouchOwnershipSource("class MotionEventGenerator {}"), /anchor changed/);
  const anchor = "        boolean moving = (device.mCoords[0].x != aX) || (device.mCoords[0].y != aY);";
  assert.throws(() => patchTouchOwnershipSource(anchor + "\n" + anchor), /anchor changed/);
});
