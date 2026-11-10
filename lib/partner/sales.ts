import { z } from "zod";

export const SALES_CSV_COLUMNS = ["date", "gross_sales", "discounts", "refunds", "tax", "orders"] as const;
export const SALES_CSV_MAX_BYTES = 256 * 1024;
export const RECIPE_SALES_CSV_HEADER = "date,recipe,servings_sold";
export const DEFAULT_SALES_CURRENCY = "NGN";
const featuredAfricanCurrencies = ["GHS", "KES", "ZAR", "XOF", "XAF", "UGX", "TZS", "RWF", "ETB", "EGP", "MAD", "ZMW", "ZWG"];
export const salesImportCurrencySchema = z.enum([...new Set([
  DEFAULT_SALES_CURRENCY, ...featuredAfricanCurrencies, ...Intl.supportedValuesOf("currency"),
])]);
const date = z.iso.date().refine((value) => !value.startsWith("0000-"));
const currency = z.string().regex(/^[A-Z]{3}$/);
const salesChannel = z.enum(["pos", "mobile"]);
const money = /^(?:\d{1,10})(?:\.\d{1,2})?$/;

export const salesFiltersSchema = z.object({
  cafe_id: z.coerce.number().int().positive().optional(),
  from: date.optional(),
  to: date.optional(),
  currency: currency.optional(),
  channel: salesChannel.optional(),
});

export function parseSalesCsv(csv: string, importCurrency?: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)
    .map((line, index) => ({ line, number: index + 1 })).filter(({ line }) => line.trim());
  function fields(line: string) {
    return line.split(",").map((cell) => cell.trim().replace(/^"([^"]*)"$/, "$1"));
  }
  const headers = fields(lines[0]?.line ?? "").map((field) => field.toLowerCase());
  const expectedHeaders = headers.includes("currency") ? [...SALES_CSV_COLUMNS, "currency"] : SALES_CSV_COLUMNS;
  if (headers.length !== expectedHeaders.length || !expectedHeaders.every((column) => headers.includes(column)))
    throw new Error("Use the template headers. Include date, gross_sales, discounts, refunds, tax, and orders. The currency column is optional.");
  if (!importCurrency && !headers.includes("currency")) throw new Error("Choose the currency for this CSV.");
  if (lines.length < 2 || lines.length > 367)
    throw new Error("Include 1 to 366 daily sales rows per file.");
  const dates = new Set<string>();
  return lines.slice(1).map(({ line, number }) => {
    const cells = fields(line);
    if (cells.length !== headers.length) throw new Error(`Line ${number} has the wrong number of fields.`);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    if (!date.safeParse(row.date).success) throw new Error(`Line ${number} needs a valid date in YYYY-MM-DD format.`);
    if (dates.has(row.date)) throw new Error(`Line ${number} repeats the date ${row.date}.`);
    dates.add(row.date);
    const code = row.currency || importCurrency;
    if (!code) throw new Error(`Line ${number} is missing a currency. Choose a currency for this CSV or fill in the currency column.`);
    if (!currency.safeParse(code).success) throw new Error(`Line ${number} needs a three-letter uppercase currency code.`);
    if (importCurrency && code !== importCurrency)
      throw new Error(`Line ${number} uses ${code}, but you selected ${importCurrency}. Choose the matching currency or use the currency from the CSV.`);
    if (![row.gross_sales, row.discounts, row.refunds, row.tax.replace(/^-/, "")].every((value) => money.test(value)))
      throw new Error(`Line ${number} needs plain amounts with up to two decimals. Only tax can be negative.`);
    if (!/^\d{1,10}$/.test(row.orders) || Number(row.orders) > 2147483647)
      throw new Error(`Line ${number} needs a valid whole-number order count.`);
    return {
      sale_date: row.date, currency: code, gross_sales: row.gross_sales,
      discounts: row.discounts, refunds: row.refunds, tax: row.tax, orders: Number(row.orders),
    };
  });
}

export function parseRecipeSalesCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 })).filter(({ line }) => line);
  if (lines[0]?.line.toLowerCase() !== RECIPE_SALES_CSV_HEADER)
    throw new Error("Use the recipe sales template with date, recipe, and servings_sold in that order.");
  if (lines.length < 2 || lines.length > 2001)
    throw new Error("Include 1 to 2,000 recipe sales rows per file.");
  return lines.slice(1).map(({ line, number }) => {
    const fields = line.match(/^("(?:[^"]|"")*"|[^",]*),("(?:[^"]|"")*"|[^",]*),("(?:[^"]|"")*"|[^",]*)$/);
    if (!fields) throw new Error(`Line ${number} needs a date, recipe, and number of servings sold.`);
    const [day, recipe, servings] = fields.slice(1).map((field) =>
      field.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"').trim());
    if (!date.safeParse(day).success) throw new Error(`Line ${number} needs a valid date in YYYY-MM-DD format.`);
    if (!recipe || recipe.length > 200) throw new Error(`Line ${number} needs a recipe name or ID.`);
    if (!/^\d{1,10}$/.test(servings) || Number(servings) > 2147483647)
      throw new Error(`Line ${number} needs a whole-number count of servings sold.`);
    return { sale_date: day, recipe, servings_sold: Number(servings) };
  });
}

const total = z.number().int().nonnegative();
export const recipeSalesRankingSchema = z.array(z.object({
  recipe_id: z.uuid(), name: z.string(), servings_sold: total,
  cafes: z.array(z.object({ cafe_id: z.number().int(), servings_sold: total })),
}));
export type RecipeSalesRanking = z.infer<typeof recipeSalesRankingSchema>;
export const demoPosStatusSchema = z.object({
  locations: z.array(z.object({ id: z.number().int(), name: z.string().nullable() })),
  synced_at: z.iso.datetime({ offset: true }).nullable(),
});
export type DemoPosStatus = z.infer<typeof demoPosStatusSchema>;
export const salesReportSchema = z.object({
  from: date,
  through: date,
  currency: currency.nullable(),
  currencies: z.array(currency),
  totals: z.object({
    net: z.number(), gross: z.number(), discounts: z.number(), refunds: z.number(),
    tax: z.number(), orders: total, rows: total,
  }),
  cafes: z.array(z.object({ cafe_id: z.number().int(), net: z.number(), orders: total, days: total })),
  channels: z.array(z.object({ cafe_id: z.number().int(), channel: salesChannel, net: z.number(), orders: total })),
  trend: z.array(z.object({ from: date, through: date, net: z.number().nullable() })),
});
export type SalesReportData = z.infer<typeof salesReportSchema>;
