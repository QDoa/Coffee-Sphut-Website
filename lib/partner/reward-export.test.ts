import assert from "node:assert/strict";
import { test } from "node:test";
import { rewardExportCsv } from "./reward-export";

test("reward CSV preserves quotes and neutralizes spreadsheet formulas in café names", () => {
  const csv = rewardExportCsv({
    events: [{
      cafe_name: ' =HYPERLINK("https://example.test","Café")',
      cafe_id: 101,
      occurred_local: "2026-11-08 08:20:30.123456",
      occurred_utc: "2026-11-08T14:20:30.123456Z",
      id: "reward-reference",
      status: "redeemed",
    }],
    timezone: "America/Regina",
    reward_from: "2026-11-01",
    reward_to: "2026-11-08",
    coverage_at: "2026-11-02T12:00:00+00:00",
  });
  assert.ok(csv.startsWith('\uFEFF"Café",'));
  assert.ok(csv.includes(`"' =HYPERLINK(""https://example.test"",""Café"")","101"`));
  assert.ok(csv.includes('"2026-11-08","08:20:30.123456","2026-11-08T14:20:30.123456Z"'));
  assert.ok(csv.includes('"reward-reference","redeemed","2026-11-01","2026-11-08","2026-11-02T12:00:00+00:00"'));
});
