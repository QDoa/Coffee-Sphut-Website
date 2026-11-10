"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { saveStocktake } from "@/app/partner/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartnerSelect } from "./partner-select";
import type { StocktakeItem } from "@/lib/partner/portal";
import { COUNT_QUANTITY, STOCKTAKE_LIMIT } from "@/lib/partner/stock";

interface CountEntry {
  quantity: string;
  expected: string;
}

const ZERO = BigInt(0);
const MICROS = BigInt(1_000_000);

function microunits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(6, "0"));
}

function formatCount(value: bigint): string {
  const magnitude = value < ZERO ? -value : value;
  const whole = (magnitude / MICROS).toLocaleString("en");
  const fraction = String(magnitude % MICROS).padStart(6, "0").replace(/0+$/, "");
  return (value < ZERO ? "−" : "") + whole + (fraction ? "." + fraction : "");
}

export function StocktakeMode({ cafes, items, chainId, cafeId }: {
  cafes: { id: string; name: string }[];
  items: StocktakeItem[];
  chainId: string;
  cafeId?: string;
}) {
  const [cafe, setCafe] = useState(() => cafes.some((row) => row.id === cafeId) ? cafeId
    : cafes.find((row) => items.some((item) => String(item.cafe_id) === row.id))?.id ?? cafes[0]?.id);
  const [entries, setEntries] = useState<Record<string, CountEntry>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof saveStocktake>>>({});
  const [pending, startTransition] = useTransition();
  const requestId = useRef("");
  const scoped = items.filter((item) => String(item.cafe_id) === cafe);
  const balances = new Map(scoped.map((item) => [item.id, item.balance]));
  const counts = Object.entries(entries);
  const staleIds = counts.filter(([id, entry]) => balances.get(id) !== entry.expected).map(([id]) => id);
  const invalidCount = counts.some(([, entry]) => !COUNT_QUANTITY.test(entry.quantity));
  const searchTerm = search.trim().toLowerCase();
  const visible = scoped.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(searchTerm));
  const canSave = !!cafe && counts.length > 0 && counts.length <= STOCKTAKE_LIMIT
    && !invalidCount && !staleIds.length && !result.stale;

  function editCount(item: StocktakeItem, quantity: string) {
    requestId.current = crypto.randomUUID();
    setResult({});
    setEntries((current) => {
      const next = { ...current };
      if (quantity === "") delete next[item.id];
      else next[item.id] = { quantity, expected: item.balance };
      return next;
    });
  }

  function clearCounts(ids: string[]) {
    requestId.current = crypto.randomUUID();
    setResult({});
    setEntries(Object.fromEntries(counts.filter(([id]) => !ids.includes(id))));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || pending) return;
    requestId.current ||= crypto.randomUUID();
    startTransition(async () => {
      try {
        const outcome = await saveStocktake({
          p_chain: chainId,
          p_cafe: Number(cafe),
          p_request: requestId.current,
          p_reason: note,
          p_counts: counts.map(([item_id, entry]) => ({ item_id, ...entry })),
        });
        setResult(outcome);
        if (outcome.saved) {
          setEntries({});
          setNote("");
          requestId.current = "";
        }
      } catch {
        setResult({ error: "The stocktake could not be saved. Try again." });
      }
    });
  }

  return (
    <section aria-label="Stocktake mode" className="rounded-2xl border bg-card p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <ClipboardList className="size-5 text-primary" aria-hidden="true" /> Stocktake mode
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter what you physically counted at one café. Leave an item blank to skip it, or enter zero if none remains.
      </p>
      {!cafes.length ? (
        <p className="mt-5 text-sm text-muted-foreground">An active, accessible café is required to start a stocktake.</p>
      ) : (
        <form onSubmit={submit} aria-busy={pending} className="mt-5 space-y-4">
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span className="block">Café to count</span>
                <PartnerSelect value={cafe} disabled={counts.length > 0}
                  onChange={(event) => { setCafe(event.target.value); setSearch(""); setResult({}); }}
                  className="disabled:opacity-70">
                  {cafes.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </PartnerSelect>
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span className="block">Find items to count</span>
                <Input className="min-h-11" type="search" value={search} placeholder="Search by item or code"
                  onChange={(event) => setSearch(event.target.value)} />
              </label>
            </div>
            {!visible.length && <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              {scoped.length ? "No items match your search." : "Add an active inventory item at this café to start counting."}
            </p>}
            {!!visible.length && (
              <ul aria-label="Items to count" className="divide-y rounded-xl border">
                {visible.map((item) => {
                  const entry = entries[item.id];
                  const stale = entry && entry.expected !== item.balance;
                  const valid = !!entry && COUNT_QUANTITY.test(entry.quantity);
                  const difference = valid ? microunits(entry.quantity) - microunits(item.balance) : null;
                  const statusId = `stocktake-variance-${item.id}`;
                  return (
                    <li key={item.id} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_minmax(7rem,10rem)] sm:items-center">
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.code} · On hand {formatCount(microunits(item.balance))} {item.unit}</p>
                      </div>
                      <label className="space-y-1 text-sm">
                        <span className="block">Counted ({item.unit}) <span className="sr-only">{item.name}</span></span>
                        <Input className="min-h-11" type="text" inputMode="decimal"
                          value={entry?.quantity ?? ""} maxLength={19} aria-invalid={Boolean(stale || (entry && !valid))}
                          aria-describedby={statusId}
                          onChange={(event) => editCount(item, event.target.value)} />
                      </label>
                      <p id={statusId} className={`text-sm tabular-nums ${stale || (entry && !valid) ? "text-destructive" : "text-muted-foreground"}`}>
                        {stale ? "Balance changed. Recheck this count."
                          : entry && !valid ? "Use a positive amount or zero, up to six decimals."
                          : difference === null ? "Awaiting count"
                          : difference === ZERO ? "Matches balance"
                          : `${difference > ZERO ? "+" : ""}${formatCount(difference)} ${item.unit} difference`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {counts.length > 0 && (
              <label className="block max-w-md space-y-2 text-sm font-medium">
                <span className="block">Stocktake note (optional)</span>
                <Input className="min-h-11" value={note} maxLength={200} placeholder="e.g. End of shift"
                  onChange={(event) => { setNote(event.target.value); requestId.current = crypto.randomUUID(); }} />
              </label>
            )}
            {!!staleIds.length && <p role="alert" className="text-sm text-destructive">
              Some items changed. Recheck the affected counts or clear them before saving.
            </p>}
            {counts.length > STOCKTAKE_LIMIT && <p role="alert" className="text-sm text-destructive">
              Save up to {STOCKTAKE_LIMIT} counts at a time.
            </p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="min-h-11" disabled={!canSave}>
                {pending ? "Saving…" : counts.length === 0 ? "Save counts"
                  : `Save ${counts.length} ${counts.length === 1 ? "count" : "counts"}`}
              </Button>
              {!!staleIds.length && <Button type="button" variant="outline" className="min-h-11" onClick={() => clearCounts(staleIds)}>
                Clear outdated counts
              </Button>}
              {!!counts.length && <Button type="button" variant="ghost" className="min-h-11" onClick={() => clearCounts(counts.map(([id]) => id))}>
                Clear all counts
              </Button>}
              {!!counts.length && <p className="text-xs text-muted-foreground">Save or clear counts before switching cafés.</p>}
            </div>
          </fieldset>
          {result.error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{result.error}</p>}
          {result.saved && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm">
            Saved {result.saved} {result.saved === 1 ? "stock count" : "stock counts"}. View the recorded movements in Inventory activity.
          </p>}
        </form>
      )}
    </section>
  );
}
