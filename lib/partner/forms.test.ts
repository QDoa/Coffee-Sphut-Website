import assert from "node:assert/strict";
import { test } from "node:test";
import { cafePayload } from "./forms";
function form() {
  const f = new FormData();
  f.set("name", "Test café");
  f.set("is_active", "on");
  f.set("social_media", "Instagram=https://example.test/cafe");
  f.set(
    "gallery",
    "https://example.test/one.jpg\nhttps://example.test/two.jpg",
  );
  f.set("menu", "Latte | 500 | CAD | Milk coffee");
  return f;
}
test("cafe business fields and related records survive parsing without accepting system fields", () => {
  const f = form();
  f.set("hours_Monday_open", "08:00");
  f.set("hours_Monday_close", "18:00");
  f.set("latitude", "50.4");
  f.set("longitude", "-104.6");
  f.set("reward_code", "private");
  f.set("chain_id", "tampered");
  f.set("partner_revision", "0");
  const p = cafePayload(f);
  assert.deepEqual(p.time_open, { Monday: { open: "08:00", close: "18:00" } });
  assert.deepEqual(p.social_media, { Instagram: "https://example.test/cafe" });
  assert.equal((p.menu as Record<string, unknown>[])[0].price, 500);
  assert.equal((p.gallery as string[]).length, 2);
  assert.equal(p.reward_code, "private");
  assert.equal("chain_id" in p, false);
  assert.equal("partner_revision" in p, false);
});
test("legacy hours are preserved until a user explicitly replaces them", () => {
  const f = form();
  const legacy = { legacy_hours: ["weekday", "weekend"] };
  f.set("previous_hours", JSON.stringify(legacy));
  assert.deepEqual(cafePayload(f).time_open, legacy);
  f.set("hours_update", "on");
  assert.deepEqual(cafePayload(f).time_open, {});
});
test("invalid menu prices, social links and partial hours do not silently clear data", () => {
  for (const [key, value] of [
    ["menu", "Latte | -5 | CAD"],
    ["social_media", "bad link"],
    ["hours_Monday_open", "08:00"],
  ]) {
    const f = form();
    f.set(key, value);
    assert.throws(() => cafePayload(f));
  }
});
