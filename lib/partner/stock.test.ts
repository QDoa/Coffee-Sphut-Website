import { test } from "node:test";
import assert from "node:assert/strict";
import { stockView } from "./stock";
test("runway distinguishes low, empty, no history and no recorded usage", () => {
  const item = { id: "a", balance: 100, threshold: 10, active: true };
  assert.equal(stockView(item, []).runway, "Building usage history");
  assert.equal(
    stockView(item, [
      { item_id: "a", observed_days: 28, daily_usage: 0, days_left: null },
    ]).runway,
    "No recorded usage",
  );
  assert.equal(
    stockView(item, [
      { item_id: "a", observed_days: 28, daily_usage: 20, days_left: 5 },
    ]).status,
    "Running low",
  );
  assert.equal(stockView({ ...item, balance: 0 }, []).status, "Out of stock");
  assert.equal(stockView({ ...item, balance: 5 }, []).status, "Low stock");
  assert.equal(
    stockView({ ...item, active: false, balance: 0 }, []).attention,
    false,
  );
});
