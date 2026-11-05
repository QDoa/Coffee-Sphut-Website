import Link from "next/link";
import { ArrowUpRight, Gift, Store, TriangleAlert } from "lucide-react";
import type { PortalData } from "@/lib/partner/portal";
import { stockView, amount } from "@/lib/partner/stock";
import { Button } from "@/components/ui/button";
export function Dashboard({ data }: { data: PortalData }) {
  const weeks = data.weekly_rewards;
  const total = weeks.reduce((s, w) => s + Number(w.total), 0);
  const max = Math.max(1, ...weeks.map((w) => Number(w.total)));
  const stock = data.items
    .map((i) => ({ item: i, ...stockView(i, data.stock_rates) }))
    .filter((i) => i.attention)
    .sort((a, b) =>
      a.balance === 0
        ? -1
        : b.balance === 0
          ? 1
          : (a.days ?? Infinity) - (b.days ?? Infinity),
    );
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Your week, at a glance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reward activity and the supplies that need your attention.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/partner/cafes">
            Manage cafés <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Rewards this week",
            value: weeks.at(-1)?.total ?? 0,
            detail: "Completed redemptions · week so far",
            Icon: Gift,
          },
          {
            label: "Accessible cafés",
            value: data.cafes.filter((c) => c.is_active).length,
            detail: "Active locations in your workspace",
            Icon: Store,
          },
          {
            label: "Stock needs attention",
            value: data.plan === "paid" ? stock.length : "Paid",
            detail:
              data.plan === "paid"
                ? "Below threshold or 7 days of stock or less"
                : "Inventory insights on the Paid plan",
            Icon: TriangleAlert,
          },
        ].map(({ label, value, detail, Icon }) => (
          <div className="rounded-2xl border bg-card p-5" key={label}>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {label}
              <Icon className="size-4" />
            </div>
            <p className="my-3 text-3xl font-semibold tabular-nums">
              {String(value)}
            </p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Rewards per week</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} redemptions across the last eight weeks
              </p>
            </div>
            <Link
              href="/partner/rewards"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              View activity
            </Link>
          </div>
          <div
            className="relative mt-8 grid h-56 grid-cols-8 items-end gap-2 sm:gap-4"
            role="img"
            aria-label={`Weekly completed rewards: ${weeks.map((w) => `${w.week}: ${w.covered === false ? "no tracking coverage" : w.total}${w.partial ? " (partial coverage)" : ""}`).join("; ")}`}
          >
            {total === 0 && (
              <p className="absolute inset-x-0 top-10 text-center text-sm text-muted-foreground">
                No completed rewards in the tracked period yet.
              </p>
            )}
            {weeks.map((w, i) => (
              <div
                className="flex h-full min-w-0 flex-col justify-end text-center"
                key={String(w.week)}
                title={`${w.week}: ${w.covered === false ? "no tracking coverage" : w.total} completed rewards${w.partial ? " · partial week or coverage" : ""}`}
              >
                <span className="mb-2 text-xs font-medium tabular-nums">
                  {w.covered === false ? "—" : String(w.total)}
                  {w.partial ? "*" : ""}
                </span>
                <div
                  className={`min-h-1 rounded-t-md ${i === 7 ? "bg-primary" : "bg-primary/30"}`}
                  style={{
                    height: `${Math.max(2, (Number(w.total) / max) * 150)}px`,
                  }}
                />
                <span className="mt-3 whitespace-nowrap text-[10px] text-muted-foreground sm:text-xs">
                  {String(w.week).slice(5).replace("-", "/")}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            — No tracking coverage. Weeks start Monday · {data.timezone}. *
            Current week or incomplete tracking coverage. Tracking began{" "}
            {data.coverage_at?.slice(0, 10)}; earlier unattributed rewards are
            excluded.
          </p>
        </section>
        <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Stock watch</h2>
            <TriangleAlert className="size-4 text-amber-600" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan your next restock before supplies run out.
          </p>
          {data.plan !== "paid" ? (
            <div className="my-6 space-y-4">
              <p className="text-sm">
                Get stock levels and consumption estimates with Paid inventory.
              </p>
              <Button asChild variant="outline">
                <Link href="/partner/billing">View plan</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-5 divide-y">
                {stock.slice(0, 5).map((s) => (
                  <div key={String(s.item.id)} className="py-4">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium">
                        {String(s.item.name)}
                      </p>
                      <span className="text-xs font-medium text-amber-800">
                        {s.runway}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(
                        data.cafes.find((c) => c.id === s.item.cafe_id)?.name ||
                          "Café",
                      )}{" "}
                      · {amount(s.balance)} {String(s.item.unit)} remaining
                    </p>
                  </div>
                ))}
                {!stock.length && (
                  <p className="py-7 text-sm text-muted-foreground">
                    No active items need attention. Estimates appear as you
                    record usage.
                  </p>
                )}
              </div>
              <Link
                href="/partner/inventory"
                className="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-4"
              >
                Open inventory →
              </Link>
            </>
          )}
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Runway uses recorded consumption + wastage over up to 28 days. At
            least 24 hours of history is needed. Estimates assume usage stays
            consistent.
          </p>
        </section>
      </div>
      {data.selection_required && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-medium">Choose your Free cafés</p>
          <p className="my-2 text-sm">
            An Owner must select up to three active cafés before operational
            access begins.
          </p>
          <Link href="/partner/billing" className="underline">
            Choose cafés
          </Link>
        </div>
      )}
    </>
  );
}
