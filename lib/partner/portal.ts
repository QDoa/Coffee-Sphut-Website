import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isLocalPartnerPreview, isPartnerPortalEnabled } from "./preview";
import type { Database, Json } from "@/types/database";
const rows = z.array(z.record(z.string(), z.unknown())).default([]);
export const portalSchema = z.object({
  actor: z.string().uuid(),
  chain_id: z.string().uuid().optional(),
  name: z.string().optional(),
  role: z.enum(["owner", "chain_manager", "cafe_manager"]).optional(),
  plan: z.enum(["free", "paid"]).optional(),
  timezone: z.string().optional(),
  selection_required: z.boolean().optional(),
  coverage_at: z.string().optional(),
  refreshed_at: z.string().optional(),
  total: z.number().optional(),
  cafes: rows,
  changes: rows,
  items: rows,
  movements: rows,
  recipes: rows,
  ingredients: rows,
  members: rows,
  invitations: rows,
  accounts: rows,
  events: rows,
  cafe: z.record(z.string(), z.unknown()).optional(),
  gallery: z.array(z.string()).nullable().optional(),
  menu: rows,
});
export type PortalData = z.infer<typeof portalSchema>;
export async function portalClient(reviewer = false) {
  if (!isPartnerPortalEnabled())
    throw new Error(
      "The partner workspace is not enabled for this deployment.",
    );
  if (isLocalPartnerPreview()) {
    const host = (await headers()).get("host")?.split(":")[0];
    if (host !== "127.0.0.1" && host !== "localhost")
      throw new Error("Local preview requires a loopback host.");
    const jwt = reviewer
      ? process.env.PARTNER_REVIEW_JWT
      : process.env.PARTNER_PREVIEW_JWT;
    if (!jwt) throw new Error("Local fixture identity is missing.");
    return createSupabaseClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false },
      },
    );
  }
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/partner/login");
  return client;
}
export async function portalData(
  section: string,
  input: Json = {},
  reviewer = false,
): Promise<PortalData> {
  const client = await portalClient(reviewer);
  const { data, error } = await client.rpc("partner_snapshot", {
    p_section: section,
    p_input: input,
  });
  if (error) throw new Error(error.message);
  return portalSchema.parse(data);
}
