import assert from "node:assert/strict";
import { test } from "node:test";
import { safePartnerNext } from "./redirects";
test("invitation/recovery redirects keep their intended local destination", () => {
  const token = "12345678-1234-4234-8234-123456789012".repeat(2);
  assert.equal(
    safePartnerNext(`/partner/accept?token=${token}`),
    `/partner/accept?token=${token}`,
  );
  assert.equal(safePartnerNext("/partner/password"), "/partner/password");
  for (const value of [
    "https://evil.test",
    "//evil.test/partner",
    "/partner/accept?token=bad",
    "/admin",
    "/partner/password/../../admin",
    "/partner/overview?next=https://evil.test",
    undefined,
  ]) {
    const result = safePartnerNext(value);
    assert.ok(result === "/partner" || result === "/partner/overview");
  }
});
