"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartnerSelect } from "./partner-select";
import type { PortalData } from "@/lib/partner/portal";
import { amount, restockSuggestion, stockView } from "@/lib/partner/stock";

export function RestockPlanner({ data, cafeId }: { data: PortalData; cafeId?: string }) {
  const cafes = new Map(data.cafes.filter((row) => row.is_active === true)
    .map((row) => [String(row.id), String(row.name || "Café")] as const)
    .sort((a, b) => a[1].localeCompare(b[1])));
  const [cafe, setCafe] = useState(cafes.has(cafeId ?? "") ? cafeId ?? "" : "");
  const [horizon, setHorizon] = useState("7");
  const [feedback, setFeedback] = useState("");
  const days = Number(horizon);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 90;
  const scoped = data.items.filter((item) => item.active && cafes.has(String(item.cafe_id))
    && (!cafe || String(item.cafe_id) === cafe));
  const suggestions = validDays ? scoped.map((item) => {
    const stock = stockView(item, data.stock_rates);
    return { item, ...stock, ...restockSuggestion(stock.balance, stock.threshold, stock.daily, days) };
  }).filter((row) => row.quantity > 0 || row.needsReview)
    .sort((a, b) => Number(a.balance > 0) - Number(b.balance > 0)
      || (a.days ?? Infinity) - (b.days ?? Infinity)
      || String(a.item.name).localeCompare(String(b.item.name))) : [];

  async function copyList() {
    const lines = suggestions.map(({ item, quantity, needsReview }) =>
      `${cafes.get(String(item.cafe_id))} · ${item.name} (${item.code}) · ${needsReview ? "Review quantity" : `${amount(quantity)} ${item.unit}`}`);
    try {
      await navigator.clipboard.writeText([`Restock list · ${days} days of coverage`, ...lines].join("\n"));
      setFeedback("Restock list copied.");
    } catch {
      setFeedback("Clipboard access is unavailable. You can select and copy the quantities from the list.");
    }
  }

  return (
    <section aria-label="Restock planner" className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <PackagePlus className="size-5 text-primary" aria-hidden="true" /> Restock planner
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Build a shopping list for your next delivery.</p>
        </div>
        <Button variant="outline" className="min-h-11" disabled={!suggestions.length} onClick={copyList}>
          <ClipboardCopy aria-hidden="true" /> Copy restock list
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Café</span>
          <PartnerSelect value={cafe} onChange={(event) => { setCafe(event.target.value); setFeedback(""); }}>
            <option value="">All accessible cafés</option>
            {Array.from(cafes, ([id, name]) => <option key={id} value={id}>{name}</option>)}
          </PartnerSelect>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Days of coverage</span>
          <Input className="min-h-11" type="number" min={1} max={90} value={horizon}
            aria-invalid={!validDays} aria-describedby="restock-days-help"
            onChange={(event) => { setHorizon(event.target.value); setFeedback(""); }} />
        </label>
      </div>
      <p id="restock-days-help" className="text-sm text-muted-foreground">
        Choose 1–90 days. Suggestions cover estimated usage plus the low-stock threshold, minus what’s on hand.
        Usage comes from up to 28 days of stock used and wasted. Quantities round up to a whole base unit.
      </p>
      <p role="status" className="text-sm font-medium">{feedback || (validDays
        ? `${suggestions.length} ${suggestions.length === 1 ? "item" : "items"} to review`
        : "Enter a whole number between 1 and 90.")}</p>
      {!!suggestions.length && (
        <ul className="divide-y rounded-xl border" aria-label="Restock suggestions">
          {suggestions.map(({ item, balance, threshold, daily, quantity, needsReview, runway }) => (
            <li key={String(item.id)} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <Link href={`/partner/inventory?${new URLSearchParams({ cafe_id: String(item.cafe_id), item_id: String(item.id) })}#stock-list`}
                  className="font-medium text-primary underline underline-offset-4">{String(item.name)}</Link>
                <p className="mt-1 text-xs text-muted-foreground">{cafes.get(String(item.cafe_id))} · {String(item.code)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {amount(balance)} {String(item.unit)} on hand · Threshold {amount(threshold)} {String(item.unit)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{daily !== null && daily > 0
                  ? `${amount(daily)} ${item.unit} used per day · ${runway}`
                  : "No usage forecast. Check recent stock activity before ordering."}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-muted-foreground">Suggested restock</p>
                <p className="font-semibold tabular-nums">{needsReview ? "Review quantity" : `${amount(quantity)} ${item.unit}`}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {validDays && !suggestions.length && <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
        {scoped.length
          ? "No restocks are suggested from the available balances and usage history."
          : "Add active inventory items for this café to start planning."}
      </p>}
    </section>
  );
}
