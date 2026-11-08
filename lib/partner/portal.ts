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
  manager_assignments: z.record(z.string(), z.array(z.number())).default({}),
  invitations: rows,
  accounts: rows,
  events: rows,
  cafe: z.record(z.string(), z.unknown()).optional(),
  gallery: z.array(z.string()).nullable().optional(),
  menu: rows,
  media: rows,
  weekly_rewards: rows,
  stock_rates: rows,
  staff_admin: z.boolean().default(false),
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
  withInsights = false,
): Promise<PortalData> {
  const client = await portalClient(reviewer);
  const { data, error } = await client.rpc("partner_snapshot", {
    p_section: section,
    p_input: input,
  });
  if (error) throw new Error(error.message);
  const parsed = portalSchema.parse(data);
  if (section === "team" && parsed.role === "owner" && parsed.chain_id) {
    const assignments = await client.rpc("partner_team_assignments", {
      p_chain: parsed.chain_id,
    });
    if (assignments.error) throw new Error(assignments.error.message);
    parsed.manager_assignments = portalSchema.shape.manager_assignments.parse(
      assignments.data,
    );
  }
  if (section === "staff") {
    const [media, admin] = await Promise.all([
      client
        .from("partner_media")
        .select("id,state,created_at,cleanup_error")
        .order("created_at", { ascending: false })
        .limit(100),
      client.rpc("is_admin"),
    ]);
    if (media.error) throw new Error(media.error.message);
    parsed.media = media.data;
    if (admin.error) throw new Error(admin.error.message);
    parsed.staff_admin = admin.data;
  }
  // Keep command-context and café-editor lookups lightweight.
  if (withInsights && ["overview", "inventory"].includes(section)) {
    const insights = await client.rpc("partner_insights");
    if (insights.error) throw new Error(insights.error.message);
    if (section === "overview" && parsed.plan === "paid") {
      const inventory = await client.rpc("partner_snapshot", {
        p_section: "inventory",
        p_input: {},
      });
      if (inventory.error) throw new Error(inventory.error.message);
      parsed.items = portalSchema.parse(inventory.data).items;
    }
    Object.assign(
      parsed,
      portalSchema
        .pick({
          weekly_rewards: true,
          stock_rates: true,
          timezone: true,
          refreshed_at: true,
        })
        .parse(insights.data),
    );
  }
  return parsed;
}
