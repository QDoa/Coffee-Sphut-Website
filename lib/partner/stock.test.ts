import { test } from "node:test";
import assert from "node:assert/strict";
import { COUNT_QUANTITY, restockSuggestion, stockView } from "./stock";
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

test("restock suggestions cover demand plus the threshold and preserve the no-history fallback", () => {
  assert.deepEqual(restockSuggestion(20, 5, 3.25, 7), { quantity: 8, needsReview: false });
  assert.deepEqual(restockSuggestion(20, 5, 3.25, 1), { quantity: 0, needsReview: false });
  assert.deepEqual(restockSuggestion(3, 5, null, 7), { quantity: 2, needsReview: false });
  assert.deepEqual(restockSuggestion(0, 0, null, 7), { quantity: 0, needsReview: true });
});

test("stocktake accepts zero and exact quantities within the ledger precision", () => {
  for (const value of ["0", ".5", "12.123456", "999999999999.999999"])
    assert.match(value, COUNT_QUANTITY);
  for (const value of ["", "-1", "NaN", "1.1234567", "1000000000000", "1e2"])
    assert.doesNotMatch(value, COUNT_QUANTITY);
});
