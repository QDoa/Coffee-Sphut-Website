"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { portalClient } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { DEFAULT_SALES_CURRENCY, parseRecipeSalesCsv, parseSalesCsv, SALES_CSV_MAX_BYTES, salesImportCurrencySchema } from "@/lib/partner/sales";
import type { PortalActionState } from "./actions";

export async function syncDemoPos(chainId: string): Promise<PortalActionState> {
  if (!isLocalPartnerPreview() || !z.uuid().safeParse(chainId).success)
    return { error: "The simulated POS is available only in the local demo." };
  const client = await portalClient();
  const { data, error } = await client.rpc("partner_sync_demo_pos", { p_chain: chainId });
  if (error) return { error: error.code === "42501" ? error.message : "Could not sync demo orders. Try again." };
  revalidatePath("/partner/sales");
  return {
    message: data === 0
      ? "Demo orders are up to date. No new orders."
      : `Synced ${new Intl.NumberFormat("en-NG").format(data)} demo ${data === 1 ? "order" : "orders"}.`,
  };
}

export async function importDailySales(chainId: string, _state: PortalActionState, form: FormData): Promise<PortalActionState> {
  const cafe = z.coerce.number().int().positive().safeParse(form.get("import_cafe_id"));
  if (!z.uuid().safeParse(chainId).success || !cafe.success) return { error: "Choose the café for this file." };
  const currencyChoice = form.get("import_currency") ?? DEFAULT_SALES_CURRENCY;
  const currency = salesImportCurrencySchema.optional().safeParse(currencyChoice === "" ? undefined : currencyChoice);
  if (!currency.success) return { error: "Choose a valid currency for this CSV." };
  const file = form.get("csv");
  if (!(file instanceof File) || !file.size || file.size > SALES_CSV_MAX_BYTES)
    return { error: "Choose a CSV file up to 256 KB." };

  let rows;
  try {
    const csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    rows = parseSalesCsv(csv, currency.data);
  } catch (error) {
    return { error: error instanceof TypeError ? "Save the CSV with UTF-8 encoding." : error instanceof Error ? error.message : "Could not read the CSV." };
  }

  const client = await portalClient();
  const { data, error } = await client.rpc("partner_import_daily_sales", {
    p_chain: chainId, p_cafe: cafe.data, p_rows: rows, p_replace: form.get("replace") === "on",
  });
  if (error) return { error: ["42501", "22023", "PT409"].includes(error.code) ? error.message : "Could not import sales. Check the file and try again." };
  revalidatePath("/partner/sales");
  return { message: data === 0 ? "These days already match the report. No changes saved." : `Saved sales for ${data} ${data === 1 ? "day" : "days"}.` };
}

export async function importRecipeSales(chainId: string, _state: PortalActionState, form: FormData): Promise<PortalActionState> {
  const cafe = z.coerce.number().int().positive().safeParse(form.get("recipe_sales_cafe_id"));
  if (!z.uuid().safeParse(chainId).success || !cafe.success) return { error: "Choose the café for this file." };
  const file = form.get("recipe_sales_csv");
  if (!(file instanceof File) || !file.size || file.size > SALES_CSV_MAX_BYTES)
    return { error: "Choose a CSV file up to 256 KB." };

  let rows;
  try {
    const csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    rows = parseRecipeSalesCsv(csv);
  } catch (error) {
    return { error: error instanceof TypeError ? "Save the CSV with UTF-8 encoding." : error instanceof Error ? error.message : "Could not read the CSV." };
  }

  const client = await portalClient();
  const { data, error } = await client.rpc("partner_import_recipe_sales", {
    p_chain: chainId, p_cafe: cafe.data, p_rows: rows, p_replace: form.get("replace_recipe_sales") === "on",
  });
  if (error) return { error: ["42501", "22023", "PT409"].includes(error.code) ? error.message : "Could not import recipe sales. Check the file and try again." };
  revalidatePath("/partner/sales");
  return { message: data === 0 ? "These recipe sales already match. No changes saved." : `Saved ${data} recipe sales ${data === 1 ? "row" : "rows"}.` };
}
