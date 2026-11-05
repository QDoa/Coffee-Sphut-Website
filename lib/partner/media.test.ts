import assert from "node:assert/strict";
import { test } from "node:test";
import { imageMime, MAX_IMAGE_BYTES } from "./media";
test("managed images require matching JPEG, PNG or WebP signatures and bounded file sizes", () => {
  assert.equal(
    imageMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    "image/png",
  );
  assert.equal(
    imageMime(Uint8Array.from([255, 216, 255, 224]), "image/jpeg"),
    "image/jpeg",
  );
  assert.equal(
    imageMime(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"),
    "image/webp",
  );
  for (const [bytes, mime] of [
    [new TextEncoder().encode('<svg onload="x"/>'), "image/png"],
    [Uint8Array.from([255, 216, 255]), "image/png"],
    [new Uint8Array(), "image/jpeg"],
    [new Uint8Array(MAX_IMAGE_BYTES + 1), "image/png"],
  ] as const)
    assert.throws(() => imageMime(bytes, mime));
});
