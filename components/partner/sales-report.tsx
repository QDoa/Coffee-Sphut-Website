import Link from "next/link";
import { importDailySales, importRecipeSales, syncDemoPos } from "@/app/partner/sales-actions";
import { portalClient, type PortalData } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { DEFAULT_SALES_CURRENCY, demoPosStatusSchema, RECIPE_SALES_CSV_HEADER, recipeSalesRankingSchema, SALES_CSV_COLUMNS, salesFiltersSchema, salesImportCurrencySchema, salesReportSchema, type RecipeSalesRanking, type SalesReportData } from "@/lib/partner/sales";
import { ActionForm } from "./action-form";
import { ReportFilters } from "./report-filters";
import { Panel, Select } from "./workspace";

const currencyNames = new Intl.DisplayNames("en-CA", { type: "currency" });
const importCurrencyOptions = [
  { value: "", label: "Use currency from CSV" },
  ...salesImportCurrencySchema.options.map((code) => ({ value: code, label: `${code} · ${currencyNames.of(code)}` })),
];

const count = new Intl.NumberFormat("en-CA");
const shortDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const displayDate = (day: string) => shortDate.format(new Date(day + "T00:00:00Z"));
const syncDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

async function DemoPosConnection({ chainId, canSync }: { chainId: string; canSync: boolean }) {
  if (!isLocalPartnerPreview()) return null;
  const client = await portalClient();
  const { data } = await client.rpc("partner_demo_pos_status", { p_chain: chainId });
  const status = demoPosStatusSchema.safeParse(data);
  if (!status.success || status.data.locations.length === 0) return null;
  const syncedAt = status.data.synced_at;
  return (
    <section aria-labelledby="sales-pos-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="sales-pos-title" className="font-semibold">Demo orders · Nigeria</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Simulated POS and mobile orders in Nigerian naira. Sync brings in the last 29 completed business days and updates café totals and recipe rankings.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{syncedAt ? "Connected" : "Ready to connect"}</span>
      </div>
      <ul aria-label="Mapped cafés" className="mt-3 flex flex-wrap gap-2 text-sm">
        {status.data.locations.map((cafe) => <li key={cafe.id} className="rounded-lg border px-2.5 py-1">{cafe.name || "Café"}</li>)}
      </ul>
      <p className="my-3 text-xs text-muted-foreground">
        {syncedAt ? <>Last successful sync <time dateTime={syncedAt}>{syncDate.format(new Date(syncedAt))} Lagos time</time></> : "CSV history remains available for dates outside sync coverage."}
      </p>
      {canSync && <ActionForm action={syncDemoPos.bind(null, chainId)} label={syncedAt ? "Sync demo orders" : "Connect and sync demo orders"}>{null}</ActionForm>}
    </section>
  );
}

function SalesCharts({ report, cafes, money }: {
  report: SalesReportData;
  cafes: Map<number, string>;
  money: (amount: number) => string;
}) {
  const lower = Math.min(0, ...report.trend.map((day) => day.net ?? 0));
  const upper = Math.max(0, ...report.trend.map((day) => day.net ?? 0));
  const span = upper - lower || 1;
  const zero = lower === 0 && upper === 0 ? 0 : -lower / span * 100;
  const maxCafe = Math.max(1, ...report.cafes.map((cafe) => Math.abs(cafe.net)));
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <section aria-labelledby="sales-trend" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="sales-trend" className="font-semibold">Net sales over time</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.trend.every((day) => day.from === day.through) ? "By business date" : "Grouped by date range"} · Gray marks periods with no sales data.
        </p>
        <div className="mt-5" aria-hidden="true">
          <div className="relative flex h-36 gap-1 border-b sm:gap-1.5">
            <div className="absolute inset-x-0 border-t border-muted-foreground/30" style={{ bottom: `${zero}%` }} />
            {report.trend.map((day) => {
              const net = day.net ?? 0;
              return (
                <div key={day.from} className="relative min-w-0 flex-1">
                  <div className={`absolute inset-x-0 rounded-sm ${day.net === null ? "bg-muted-foreground/35" : net < 0 ? "bg-destructive" : "bg-primary"}`}
                    style={{ bottom: net < 0 ? `${(net - lower) / span * 100}%` : `${Math.min(zero, 98)}%`, height: net ? `${Math.abs(net) / span * 100}%` : "3px" }}
                    title={`${day.from}${day.from === day.through ? "" : ` to ${day.through}`} · ${day.net === null ? "No data" : money(net)}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{displayDate(report.from)}</span>
            {report.from !== report.through && <span>{displayDate(report.through)}</span>}
          </div>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer py-2 font-medium text-primary">View trend data</summary>
          <dl className="max-h-60 divide-y overflow-y-auto rounded-lg border">
            {report.trend.map((day) => (
              <div className="flex flex-wrap justify-between gap-2 px-3 py-2" key={day.from}>
                <dt>{day.from}{day.from !== day.through && ` to ${day.through}`}</dt>
                <dd className="tabular-nums">{day.net === null ? "No data" : money(day.net)}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      <section aria-labelledby="sales-cafes" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="sales-cafes" className="font-semibold">Net sales by café</h2>
        <p className="mt-1 text-sm text-muted-foreground">Compare locations with sales in the selected period.</p>
        <ul role="list" className="mt-4 max-h-72 space-y-4 overflow-y-auto p-1">
          {report.cafes.map((cafe) => (
            <li key={cafe.cafe_id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-x-2 text-sm">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{cafes.get(cafe.cafe_id) || "Café"}</span>
                <span className="font-medium tabular-nums">{money(cafe.net)}</span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${cafe.net < 0 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.abs(cafe.net) / maxCafe * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{count.format(cafe.orders)} orders · {count.format(cafe.days)} {cafe.days === 1 ? "day" : "days"} with sales data</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const SALES_CHANNELS = [
  { id: "pos", label: "POS", bar: "bg-primary" },
  { id: "mobile", label: "Mobile", bar: "bg-chart-2" },
] as const;

function ChannelSalesChart({ report, cafes, money }: {
  report: SalesReportData;
  cafes: Map<number, string>;
  money: (amount: number) => string;
}) {
  const byChannel = new Map(report.channels.map((row) => [`${row.cafe_id}:${row.channel}`, row]));
  const cafeIds = [...new Set(report.channels.map(({ cafe_id }) => cafe_id))];
  const netSales = report.channels.map(({ net }) => net);
  const min = Math.min(0, ...netSales);
  const max = Math.max(0, ...netSales);
  const span = max - min || 1;
  return (
    <section id="sales-by-channel" aria-labelledby="sales-by-channel-title" className="min-w-0 scroll-mt-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="sales-by-channel-title" className="font-semibold">POS vs mobile sales by café</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Both channels are shown for the selected cafés, dates, and currency. CSV totals appear when the report channel is All.
      </p>
      {report.channels.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {cafeIds.map((cafeId) => (
            <div key={cafeId} className="min-w-0 rounded-xl border p-3">
              <h3 className="break-words text-sm font-semibold">{cafes.get(cafeId) || "Café"}</h3>
              <dl className="mt-3 space-y-3">
                {SALES_CHANNELS.map((channel) => {
                  const sales = byChannel.get(`${cafeId}:${channel.id}`);
                  return (
                    <div key={channel.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 text-sm">
                      <dt>{channel.label}</dt>
                      <dd className="min-w-0 space-y-1 text-right tabular-nums">
                        {sales ? (
                          <>
                            <p><span className="font-medium">{money(sales.net)}</span>{" · "}<span className="text-muted-foreground">{count.format(sales.orders)} {sales.orders === 1 ? "order" : "orders"}</span></p>
                            <div aria-hidden="true" className="relative h-2 overflow-hidden rounded-full bg-muted">
                              <div className={`absolute h-full rounded-full ${channel.bar}`} style={{
                                left: `${(Math.min(0, sales.net) - min) / span * 100}%`,
                                width: `${Math.abs(sales.net) / span * 100}%`,
                              }} />
                              {min < 0 && <div className="absolute inset-y-0 border-l border-foreground/50" style={{ left: `${-min / span * 100}%` }} />}
                            </div>
                          </>
                        ) : "No orders"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No POS or mobile order breakdown is available for these filters.</p>
      )}
    </section>
  );
}

function RecipeSalesChart({ ranking, canImport, cafes, channelLabel }: {
  ranking: RecipeSalesRanking | undefined;
  canImport: boolean;
  cafes: { value: string; label: string }[];
  channelLabel?: string;
}) {
  const leader = ranking?.[0];
  return (
    <section id="recipe-sales" aria-labelledby="recipe-sales-title" className="min-w-0 scroll-mt-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="recipe-sales-title" className="font-semibold">Top recipes by servings sold</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Up to 10 recipes ranked by {channelLabel && `${channelLabel} `}servings sold for the selected cafés and dates, across currencies.
      </p>
      {leader ? (
        <ol role="list" className="mt-4 grid gap-4 lg:grid-cols-2">
          {ranking.map((recipe, index) => {
            const servingsByCafe = new Map(recipe.cafes.map((cafe) => [String(cafe.cafe_id), cafe.servings_sold]));
            return (
              <li key={recipe.recipe_id} className="min-w-0 rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{index + 1}. {recipe.name}</span>
                  <span className="tabular-nums">{count.format(recipe.servings_sold)} {recipe.servings_sold === 1 ? "serving sold" : "servings sold"}</span>
                </div>
                <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${recipe.servings_sold / leader.servings_sold * 100}%` }} />
                </div>
                <details open={cafes.length <= 4} className="mt-3 border-t text-sm">
                  <summary className="cursor-pointer py-2 font-medium text-muted-foreground">Servings by café</summary>
                  <dl className="divide-y">
                    {cafes.map((cafe) => {
                      const servings = servingsByCafe.get(cafe.value);
                      return (
                        <div key={cafe.value} className="flex items-baseline justify-between gap-3 py-1.5">
                          <dt className="min-w-0 [overflow-wrap:anywhere]">{cafe.label}</dt>
                          <dd className="shrink-0 tabular-nums">{servings === undefined ? "No data" : count.format(servings)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </details>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {ranking ? "No recipe servings sold for the selected cafés and dates." : "Could not load recipe sales."}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-primary underline-offset-4">
        {canImport && <a href="#recipe-sales-import" className="underline">Import recipe sales CSV</a>}
        <Link href="/partner/recipes" className="underline">View chain recipes</Link>
      </div>
    </section>
  );
}

export async function SalesReport({ data, params }: { data: PortalData; params: Record<string, string | undefined> }) {
  const chainId = data.chain_id!;
  const filters = salesFiltersSchema.safeParse(Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  ));
  let report: SalesReportData | undefined;
  let recipeRanking: RecipeSalesRanking | undefined;
  let error: string | undefined;
  if (filters.success) {
    const client = await portalClient();
    const { data: result, error: reportError } = await client.rpc("partner_sales_report", {
      p_chain: chainId, p_cafe: filters.data.cafe_id, p_from: filters.data.from,
      p_to: filters.data.to, p_currency: filters.data.currency, p_channel: filters.data.channel,
    });
    if (reportError) error = ["22023", "42501"].includes(reportError.code) ? reportError.message : "Could not load the sales report.";
    else {
      const parsed = salesReportSchema.safeParse(result);
      if (parsed.success) {
        report = parsed.data;
        if (data.plan === "paid") {
          const { data: ranked } = await client.rpc("partner_recipe_sales_report", {
            p_chain: chainId, p_cafe: filters.data.cafe_id, p_from: report.from, p_to: report.through,
            p_channel: filters.data.channel,
          });
          const parsedRanking = recipeSalesRankingSchema.safeParse(ranked);
          if (parsedRanking.success) recipeRanking = parsedRanking.data;
        }
      } else error = "Could not load the sales report.";
    }
  } else {
    error = "Choose a valid café, date range, currency, and sales channel.";
  }
  const cafes = data.cafes.map((cafe) => ({ value: String(cafe.id), label: String(cafe.name || "Café") }));
  const cafeNames = new Map(cafes.map((cafe) => [Number(cafe.value), cafe.label]));
  const activeCafes = cafes.filter(({ value }) => data.cafes.some((cafe) => String(cafe.id) === value && cafe.is_active === true));
  const canImport = (data.role === "owner" || data.role === "chain_manager") && activeCafes.length > 0;
  const channelLabel = SALES_CHANNELS.find(({ id }) => id === params.channel)?.label;
  const chosenCurrency = report?.currency ?? params.currency;
  const currencyOptions = [...new Set([...(report?.currencies ?? []), ...(chosenCurrency ? [chosenCurrency] : [])])];
  const moneyFormat = new Intl.NumberFormat("en-CA", {
    style: "currency", currency: report?.currency ?? DEFAULT_SALES_CURRENCY, currencyDisplay: "code",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const money = (value: number) => moneyFormat.format(value);

  return (
    <>
      <DemoPosConnection chainId={chainId} canSync={canImport} />
      <div className="space-y-2">
        <ReportFilters
          path="/partner/sales"
          formKey={JSON.stringify(params)}
          from={params.from ?? report?.from}
          through={params.to ?? report?.through}
          error={error}
          cafe={<Select name="cafe_id" label="Café" value={params.cafe_id ?? ""} options={[{ value: "", label: "All accessible cafés" }, ...cafes]} />}
        >
          <div className="grid min-w-0 items-start gap-3 min-[420px]:grid-cols-2">
            <Select name="currency" label="Currency" value={params.currency ?? ""} options={[
              { value: "", label: report?.currency ? `Default for period (${report.currency})` : "Default for period" },
              ...currencyOptions.map((currency) => ({ value: currency, label: currency })),
            ]} />
            <div className="min-w-0">
              <Select name="channel" label="Sales channel" value={params.channel ?? ""} options={[
                { value: "", label: "All" },
                ...SALES_CHANNELS.map(({ id, label }) => ({ value: id, label })),
              ]} />
              <p className="mt-1.5 text-xs text-muted-foreground">All includes CSV history.</p>
            </div>
          </div>
        </ReportFilters>
        {(canImport || !!report?.channels.length || (report && data.plan === "paid")) && (
          <nav aria-label="Sales report sections" className="flex flex-wrap items-center gap-x-4 px-1 text-sm [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
            <span className="text-muted-foreground">Jump to</span>
            {canImport && <a href="#sales-import">CSV fallback</a>}
            {!!report?.channels.length && <a href="#sales-by-channel">Compare sales channels</a>}
            {report && data.plan === "paid" && <a href="#recipe-sales">See top recipes</a>}
          </nav>
        )}
      </div>
      {report && (report.totals.rows > 0 ? (
        <section aria-label="Sales totals" className="rounded-2xl border bg-card p-4 sm:p-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["Net sales", money(report.totals.net)],
              ["Gross sales", money(report.totals.gross)],
              ["Orders", count.format(report.totals.orders)],
            ].map(([label, value]) => (
              <div className="min-w-0" key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums [overflow-wrap:anywhere] sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">Net sales subtract discounts and refunds from gross sales. Tax is shown separately.</p>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {[["Discounts", report.totals.discounts], ["Refunds", report.totals.refunds], ["Tax", report.totals.tax]].map(([label, value]) => (
              <div key={label} className="flex gap-1.5"><dt>{label}</dt><dd className="font-medium">{money(Number(value))}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Refund and tax amounts are unconfirmed estimates.</p>
        </section>
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          No sales match these filters. {channelLabel ? "Try All sales channels or a different period." : canImport ? "Import a CSV below or choose a different period." : "Try a different café, date range, or currency."}
        </p>
      ))}
      {report && (report.totals.rows > 0 || report.channels.length > 0) && <ChannelSalesChart report={report} cafes={cafeNames} money={money} />}
      {report && report.totals.rows > 0 && <SalesCharts report={report} cafes={cafeNames} money={money} />}
      {report && data.plan === "paid" && (
        <RecipeSalesChart
          ranking={recipeRanking}
          canImport={canImport}
          channelLabel={channelLabel}
          cafes={params.cafe_id ? cafes.filter((cafe) => Number(cafe.value) === Number(params.cafe_id)) : cafes}
        />
      )}
      {canImport && (
        <section id="sales-import" className="scroll-mt-4">
          <Panel title="Import daily POS sales by CSV">
            <p className="mb-3 text-sm text-muted-foreground">
              Use a UTF-8 CSV for café dates outside sync coverage. Include one row per business date and up to 366 rows. Gross sales exclude tax and come before discounts and refunds. Enter discounts and refunds as positive amounts, and use zero for any field that doesn’t apply. Amounts can have up to two decimals.
            </p>
            <p className="mb-3 text-sm text-muted-foreground">
              Imports default to Nigerian naira (NGN). Choose a currency for the whole file or select “Use currency from CSV” to read its codes. When you choose a currency, any codes in the file must match it.
            </p>
            <a className="mb-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SALES_CSV_COLUMNS.join(",") + "\r\n")}`}
              download="daily-pos-sales-template.csv">Download CSV template</a>
            <ActionForm action={importDailySales.bind(null, chainId)} label="Import sales">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Select name="import_cafe_id" label="Café for this CSV" value={activeCafes.some((cafe) => cafe.value === params.cafe_id) ? params.cafe_id : ""}
                  options={[{ value: "", label: "Choose a café" }, ...activeCafes]} />
                <Select name="import_currency" label="Currency for this CSV" value={DEFAULT_SALES_CURRENCY} options={importCurrencyOptions} />
                <label className="min-w-0 space-y-2 text-sm font-medium">
                  <span className="block">POS CSV file</span>
                  <input name="csv" type="file" accept=".csv,text/csv" required className="min-h-11 w-full min-w-0 rounded-lg border bg-background p-2" />
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="replace" className="mt-0.5 size-4 shrink-0 accent-primary" />
                <span>Replace existing days <span className="block text-xs text-muted-foreground">Use this when the file contains corrected totals for days already imported.</span></span>
              </label>
            </ActionForm>
          </Panel>
        </section>
      )}
      {canImport && data.plan === "paid" && (
        <section id="recipe-sales-import" className="scroll-mt-4">
          <Panel title="Import recipe sales">
            <p className="mb-3 text-sm text-muted-foreground">
              Upload an item-level POS CSV for café dates outside sync coverage. Include one row per business date and recipe, with the exact chain recipe name or recipe ID and the number of servings sold. Recipe imports update the ranking.
            </p>
            <a className="mb-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(RECIPE_SALES_CSV_HEADER + "\r\n")}`}
              download="recipe-sales-template.csv">Download recipe sales CSV template</a>
            <ActionForm action={importRecipeSales.bind(null, chainId)} label="Import recipe sales">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Select name="recipe_sales_cafe_id" label="Café for recipe sales" value={activeCafes.some((cafe) => cafe.value === params.cafe_id) ? params.cafe_id : ""}
                  options={[{ value: "", label: "Choose a café" }, ...activeCafes]} />
                <label className="min-w-0 space-y-2 text-sm font-medium">
                  <span className="block">Recipe sales CSV file</span>
                  <input name="recipe_sales_csv" type="file" accept=".csv,text/csv" required className="min-h-11 w-full min-w-0 rounded-lg border bg-background p-2" />
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="replace_recipe_sales" className="mt-0.5 size-4 shrink-0 accent-primary" />
                <span>Replace existing recipe sales <span className="block text-xs text-muted-foreground">Replace the counts for matching dates and recipes. Use zero to clear a count.</span></span>
              </label>
            </ActionForm>
          </Panel>
        </section>
      )}
    </>
  );
}
