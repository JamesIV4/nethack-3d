import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceOnce, WOLVIC_REVISION } from "./runtime-patch.mjs";
test("runtime patches fail closed when a source anchor is missing or ambiguous", () => {
  assert.throws(() => replaceOnce("different", "original", "replacement", "anchor"), /anchor changed/);
  assert.throws(() => replaceOnce("original original", "original", "replacement", "anchor"), /anchor changed/);
  assert.equal(replaceOnce("a original z", "original", "replacement", "anchor"), "a replacement z");
});
test("host integration uses an immutable source revision", () => {
  assert.match(WOLVIC_REVISION, /^[a-f0-9]{40}$/);
});
