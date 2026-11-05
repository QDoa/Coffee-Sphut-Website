import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocalPartnerPreview, isPartnerPortalEnabled } from "./preview";
test("authentication bypass only works in the explicit loopback fixture environment", () => {
  const base = {
    NODE_ENV: "development",
    PARTNER_LOCAL_PREVIEW: "1",
    SUPABASE_URL: "http://127.0.0.1:55434",
  };
  assert.equal(isLocalPartnerPreview(base), true);
  for (const env of [
    { ...base, NODE_ENV: "production" },
    { ...base, VERCEL: "1" },
    { ...base, SUPABASE_URL: "https://example.supabase.co" },
    { ...base, SUPABASE_URL: "http://127.0.0.1:54321" },
    { ...base, PARTNER_LOCAL_PREVIEW: "0" },
    {},
  ])
    assert.equal(isLocalPartnerPreview(env), false);
});

test("production portal access requires a deliberate release flag", () => {
  assert.equal(isPartnerPortalEnabled({ NODE_ENV: "production" }), false);
  assert.equal(
    isPartnerPortalEnabled({
      NODE_ENV: "production",
      PARTNER_LOCAL_PREVIEW: "1",
    }),
    false,
  );
  assert.equal(
    isPartnerPortalEnabled({
      NODE_ENV: "production",
      PARTNER_PORTAL_ENABLED: "1",
    }),
    true,
  );
});
