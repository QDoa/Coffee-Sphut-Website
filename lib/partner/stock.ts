export type Row = Record<string, unknown>;
export function stockView(item: Row, rates: Row[]) {
  const rate = rates.find((r) => r.item_id === item.id);
  const balance = Number(item.balance),
    threshold = Number(item.threshold);
  const days = rate?.days_left == null ? null : Number(rate.days_left);
  const daily = rate?.daily_usage == null ? null : Number(rate.daily_usage);
  const status = !item.active
    ? "Inactive"
    : balance <= 0
      ? "Out of stock"
      : balance <= threshold
        ? "Low stock"
        : days !== null && days <= 7
          ? "Running low"
          : "In stock";
  return {
    balance,
    threshold,
    days,
    daily,
    status,
    attention:
      Boolean(item.active) &&
      (balance <= threshold || (days !== null && days <= 7)),
    runway:
      balance <= 0
        ? "Out of stock"
        : days !== null
          ? days < 1
            ? "Less than a day"
            : `${Math.floor(days)} ${Math.floor(days) === 1 ? "day" : "days"} left`
          : Number(rate?.observed_days || 0) < 1
            ? "Building usage history"
            : "No recorded usage",
  };
}
export const amount = (value: unknown) =>
  Number(value).toLocaleString("en", { maximumFractionDigits: 6 });

export function restockSuggestion(balance: number, threshold: number, daily: number | null, days: number) {
  // A whole base unit keeps the suggestion from falling short of the target.
  const quantity = Math.max(0, Math.ceil(threshold + (daily ?? 0) * days - balance));
  return { quantity, needsReview: balance === 0 && quantity === 0 };
}

export const STOCKTAKE_LIMIT = 250;
export const COUNT_QUANTITY = /^(?:\d{1,12}(?:\.\d{1,6})?|\.\d{1,6})$/;
