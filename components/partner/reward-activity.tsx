import Link from "next/link";
import { ArrowUpRight, ChevronDown, Download, Gift, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalData } from "@/lib/partner/portal";
import { ReportFilters } from "./report-filters";
import { TrendPlot, trendScale } from "./trend-plot";
import { Select } from "./workspace";

const number = new Intl.NumberFormat("en-CA");
const shortDate = new Intl.DateTimeFormat("en-CA", {
  month: "short", day: "numeric", timeZone: "UTC",
});

function Trend({ buckets }: { buckets: NonNullable<PortalData["reward_trend"]> }) {
  const peak = Math.max(0, ...buckets.map(({ total }) => total));
  const scale = trendScale(0, peak);
  function label(day: string) {
    const date = new Date(day + "T00:00:00Z");
    return Number.isNaN(date.getTime()) ? day : shortDate.format(date);
  }
  const hasCoverage = buckets.some((bucket) => bucket.tracked);

  return (
    <section aria-labelledby="reward-trend-title" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="reward-trend-title" className="font-semibold">Redemption trend</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {buckets.every((bucket) => bucket.from === bucket.through) ? "Daily redemptions" : "Redemptions by date range"} · {hasCoverage ? `Peak ${number.format(peak)}` : "No tracking in this period"}
      </p>
      <TrendPlot axisLabel="Redemptions" scale={scale} dates={
        <>
          <span>{label(buckets[0].from)}</span>
          {buckets.length >= 7 && <span>{label(buckets[Math.floor(buckets.length / 2)].from)}</span>}
          {buckets.length > 1 && <span>{label(buckets[buckets.length - 1].through)}</span>}
        </>
      }>
        <div className="absolute inset-0 flex items-end gap-px min-[420px]:gap-1">
          {buckets.map((bucket) => (
            <div key={bucket.from} className="flex h-full min-w-0 flex-1 items-end justify-center">
              <div
                className={`w-full max-w-9 rounded-t-sm ${bucket.tracked ? bucket.total ? "bg-primary" : "bg-primary/30" : "bg-muted-foreground/25"}`}
                style={{ height: bucket.total ? `${scale.position(bucket.total)}%` : "3px" }}
                title={`${bucket.from}${bucket.from === bucket.through ? "" : ` to ${bucket.through}`} · ${bucket.tracked ? number.format(bucket.total) : "No tracking"}`}
              />
            </div>
          ))}
        </div>
      </TrendPlot>
      {buckets.some((bucket) => !bucket.tracked) && <p className="mt-3 text-xs text-muted-foreground">Gray marks periods outside tracking coverage.</p>}
      <details className="mt-3 text-sm">
        <summary className="w-fit cursor-pointer rounded-sm py-2 font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring">
          View trend data
        </summary>
        <dl className="mt-1 max-h-52 divide-y overflow-y-auto rounded-lg border">
          {buckets.map((bucket) => (
            <div key={bucket.from} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
              <dt>{bucket.from}{bucket.through === bucket.from ? "" : ` to ${bucket.through}`}</dt>
              <dd className="tabular-nums">{bucket.tracked ? number.format(bucket.total) : "No tracking"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

function CafeBreakdown({ cafes, total, filtered, reportQuery }: {
  cafes: NonNullable<PortalData["reward_cafe_totals"]>;
  total: number;
  filtered: boolean;
  reportQuery: URLSearchParams;
}) {
  const allCafesQuery = new URLSearchParams(reportQuery);
  allCafesQuery.delete("cafe_id");
  return (
    <section aria-labelledby="reward-cafe-title" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="reward-cafe-title" className="font-semibold">Redemptions by café</h2>
        {filtered && <Link href={`?${allCafesQuery}`} className="text-sm font-medium text-primary underline underline-offset-4">Show all cafés</Link>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Each café’s share of the filtered report.</p>
      {cafes.length ? (
        <ul className="mt-4 max-h-72 space-y-4 overflow-y-auto p-1">
          {cafes.map((cafe) => {
            const name = cafe.cafe_name || "Café";
            const share = cafe.total / total * 100;
            const shareLabel = share < 1 ? "<1%" : `${Math.round(share)}%`;
            const query = new URLSearchParams(reportQuery);
            query.set("cafe_id", String(cafe.cafe_id));
            return (
              <li key={cafe.cafe_id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  {filtered ? <span className="font-medium [overflow-wrap:anywhere]">{name}</span> : (
                    <Link href={`?${query}`} aria-label={`View redemptions at ${name}`}
                      className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring [overflow-wrap:anywhere]">
                      {name} <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                    </Link>
                  )}
                  <span className="shrink-0 tabular-nums">{number.format(cafe.total)} <span className="text-muted-foreground">· {shareLabel}</span></span>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full min-w-1 rounded-full bg-primary" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-5 text-sm text-muted-foreground">No cafés recorded redemptions in this period.</p>}
    </section>
  );
}

export function Rewards({ data, params }: {
  data: PortalData;
  params: Record<string, string | undefined>;
}) {
  const offset = Math.max(0, Number(params.offset) || 0);
  const total = data.total ?? 0;
  const range = params.from || params.to ? "" : params.range === "week" ? "week" : "month";
  let dateFormat: Intl.DateTimeFormat;
  try {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium", timeStyle: "short", timeZone: data.timezone || "UTC",
    });
  } catch {
    dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  }
  function formatTime(value: unknown) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "Time unavailable" : dateFormat.format(date);
  }

  const reportQuery = new URLSearchParams();
  for (const key of ["cafe_id", "from", "to", "range"]) {
    if (params[key]) reportQuery.set(key, params[key]);
  }
  const exportQuery = new URLSearchParams(reportQuery);
  if (data.reward_from) exportQuery.set("from", data.reward_from);
  if (data.reward_to) exportQuery.set("to", data.reward_to);
  function pageHref(nextOffset: number) {
    const query = new URLSearchParams(reportQuery);
    query.set("offset", String(nextOffset));
    return `?${query}#redemption-events`;
  }

  const groups = new Map<string, { name: string; events: PortalData["events"] }>();
  for (const event of data.events) {
    const id = String(event.cafe_id);
    const group = groups.get(id) ?? { name: String(event.cafe_name || "Café"), events: [] };
    group.events.push(event);
    groups.set(id, group);
  }
  const cafeTotals = new Map(data.reward_cafe_totals?.map(({ cafe_id, total }) => [String(cafe_id), total]));

  return (
    <>
      <ReportFilters
        path="/partner/rewards"
        formKey={reportQuery.toString()}
        from={params.from ?? data.reward_from}
        through={params.to ?? data.reward_to}
        error={data.reward_error}
        cafe={<Select name="cafe_id" label="Café" value={params.cafe_id} options={[
          { value: "", label: "All accessible cafés" },
          ...data.cafes.map((cafe) => ({ value: String(cafe.id), label: String(cafe.name || "Café") })),
        ]} />}
        presets={
          <nav className="flex flex-wrap gap-2" aria-label="Date presets">
            {[["week", "This week"], ["month", "Last 30 days"]].map(([key, label]) => (
              <Button key={key} asChild variant={range === key ? "secondary" : "outline"} className="min-h-11 px-3">
                <Link
                  href={`?${new URLSearchParams({ range: key, ...(params.cafe_id ? { cafe_id: params.cafe_id } : {}) })}`}
                  aria-current={range === key ? "true" : undefined}
                >{label}</Link>
              </Button>
            ))}
          </nav>
        }
      />
      {!data.reward_error && (
        <>
          <section aria-label="Reward report summary" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-8">
                <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Gift className="size-4" aria-hidden="true" /> Completed redemptions</p>
                  <p className="mt-1 font-serif text-3xl tabular-nums">{number.format(total)}</p>
                </div>
                {data.reward_cafe_totals && <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Store className="size-4" aria-hidden="true" /> Cafés with redemptions</p>
                  <p className="mt-1 font-serif text-3xl tabular-nums">{number.format(cafeTotals.size)}</p>
                </div>}
              </div>
              {data.reward_export_limit !== undefined && total > data.reward_export_limit ? (
                <p className="text-sm text-muted-foreground">Choose a shorter date range or a single café to export.</p>
              ) : (
                <Button asChild variant="outline" className="min-h-11">
                  <a href={`/partner/rewards/export?${exportQuery}`} download><Download aria-hidden="true" /> Download CSV</a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Reporting period {data.reward_from} to {data.reward_to}.
              {data.coverage_at && <> Tracking began {formatTime(data.coverage_at)}</>}
            </p>
          </section>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {!!data.reward_trend?.length && <Trend buckets={data.reward_trend} />}
            {data.reward_cafe_totals && <CafeBreakdown cafes={data.reward_cafe_totals} total={total} filtered={!!params.cafe_id} reportQuery={reportQuery} />}
          </div>
          <section id="redemption-events" aria-labelledby="redemption-events-title" className="scroll-mt-4 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="redemption-events-title" className="font-semibold">Redemption events</h2>
                <p className="mt-1 text-sm text-muted-foreground">Grouped by café · Times in {dateFormat.resolvedOptions().timeZone.replaceAll("_", " ")}.</p>
              </div>
              {data.events.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing {number.format(offset + 1)}–{number.format(offset + data.events.length)} of {number.format(total)}
                </p>
              )}
            </div>
            {groups.size > 0 ? (
              <div className="space-y-3">
                {Array.from(groups, ([id, group]) => {
                  const cafeTotal = cafeTotals.get(id) ?? group.events.length;
                  return (
                    <details key={id} open className="group overflow-hidden rounded-xl border">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/45 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{group.name}</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          {number.format(cafeTotal)} in report
                          <ChevronDown className="size-4 group-open:rotate-180" aria-hidden="true" />
                        </span>
                      </summary>
                      <ul role="list" aria-label={`Redemption events at ${group.name}`} className="divide-y">
                        {group.events.map((event) => {
                          const reference = String(event.id);
                          return (
                            <li key={reference} className="px-3">
                              <details className="text-sm">
                                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm py-2 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                                  <time dateTime={String(event.occurred_at)}>{formatTime(event.occurred_at)}</time>
                                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                    Reference <span className="font-mono">{reference.slice(0, 8)}</span><ChevronDown className="size-3.5" aria-hidden="true" />
                                  </span>
                                </summary>
                                <code className="mb-3 block select-all break-all rounded-lg bg-muted p-2 text-xs">{reference}</code>
                              </details>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-muted/45 p-4 text-sm text-muted-foreground">
                {offset > 0 && total > 0 ? "There are no events on this page. Go back to see earlier results." : "No redemptions match these filters."}
              </p>
            )}
            {(offset > 0 || offset + 50 < total) && (
              <nav aria-label="Redemption event pages" className="flex flex-wrap gap-2">
                {offset > 0 && <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(Math.max(0, offset - 50))}>Previous</Link></Button>}
                {offset + 50 < total && <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(offset + 50)}>Next</Link></Button>}
              </nav>
            )}
          </section>
        </>
      )}
    </>
  );
}
