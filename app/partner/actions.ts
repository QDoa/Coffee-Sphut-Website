"use server";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { portalClient, portalData } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { safePartnerNext } from "@/lib/partner/redirects";
import { cafePayload } from "@/lib/partner/forms";
import { COUNT_QUANTITY, STOCKTAKE_LIMIT } from "@/lib/partner/stock";
import { publishReviewedMedia } from "@/lib/partner/media";
import type { Json } from "@/types/database";
export interface PortalActionState {
  error?: string;
  message?: string;
  inviteLink?: string;
  savedId?: string;
  savedRevision?: number;
  nextRequestId?: string;
}

const stocktakeSchema = z.object({
  p_chain: z.uuid(),
  p_cafe: z.number().int().positive(),
  p_request: z.uuid(),
  p_reason: z.string().trim().max(200),
  p_counts: z.array(z.object({
    item_id: z.uuid(),
    expected: z.string().regex(COUNT_QUANTITY),
    quantity: z.string().regex(COUNT_QUANTITY),
  })).min(1).max(STOCKTAKE_LIMIT),
});

export async function saveStocktake(input: unknown): Promise<{ saved?: number; error?: string; stale?: boolean }> {
  const parsed = stocktakeSchema.safeParse(input);
  if (!parsed.success) return { error: "Check that each count is nonnegative and has up to six decimal places." };
  const client = await portalClient();
  const { data, error } = await client.rpc("partner_save_stocktake", parsed.data);
  if (error) {
    if (error.code === "PT409") {
      revalidatePath("/partner/inventory");
      return { error: error.message, stale: true };
    }
    if (error.code === "42501") return { error: "Paid access to this active café is required." };
    return { error: "The stocktake could not be saved. Try again." };
  }
  revalidatePath("/partner", "layout");
  return { saved: data };
}

const recipeStockSchema = z.array(
  z.object({
    ingredient_id: z.uuid(),
    stock_item_id: z.uuid().nullable(),
    available: z.number().nonnegative().nullable(),
  }),
);

export async function getRecipeStock(recipeId: string, cafeId: number) {
  if (
    !z.uuid().safeParse(recipeId).success ||
    !Number.isSafeInteger(cafeId) ||
    cafeId <= 0
  )
    return { error: "Choose a recipe and café to check stock." };

  const client = await portalClient();
  const { data, error } = await client.rpc("partner_recipe_stock", {
    p_recipe_id: recipeId,
    p_cafe_id: cafeId,
  });
  const parsed = recipeStockSchema.safeParse(data);
  if (error || !parsed.success)
    return { error: "Stock could not be checked for this café." };
  return { items: parsed.data };
}

export async function discardCafeChange(
  id: string,
  status: "draft" | "pending",
): Promise<PortalActionState> {
  if (!z.uuid().safeParse(id).success || !["draft", "pending"].includes(status))
    return { error: "Choose a draft or a pending café removal request." };

  const client = await portalClient();
  const { data, error } = await client.rpc("partner_discard_cafe_change", {
    p_change: id,
    p_status: status,
  });
  if (error) return { error: "The request could not be removed. Try again." };
  if (!data) {
    return {
      error: "This request has changed or is unavailable. Refresh to see its current status.",
    };
  }

  revalidatePath("/partner", "layout");
  revalidatePath("/admin/partner-reviews");
  redirect(`/partner/cafes?removed=${status}#cafe-change-requests`);
}

const managerAccessSchema = z.object({
  p_member: z.uuid(),
  p_expected_role: z.enum(["chain_manager", "cafe_manager"]),
  p_expected_cafe_ids: z.array(z.number().int().positive()),
  p_role: z.enum(["chain_manager", "cafe_manager"]),
  p_cafe_ids: z.array(z.number().int().positive()),
});

export async function editManagerAccess(
  memberId: string,
  expectedRole: string,
  expectedCafeIds: number[],
  form: FormData,
): Promise<PortalActionState> {
  const input = managerAccessSchema.safeParse({
    p_member: memberId,
    p_expected_role: expectedRole,
    p_expected_cafe_ids: expectedCafeIds,
    p_role: form.get("role"),
    p_cafe_ids: form.getAll("cafe_ids").map(Number),
  });
  if (!input.success) return { error: "Choose a manager role and valid cafés." };

  const client = await portalClient();
  const { error } = await client.rpc("partner_edit_manager_access", input.data);
  if (error) return { error: error.message };

  revalidatePath("/partner", "layout");
  return { message: "Manager access updated." };
}

const planCafesSchema = z.array(z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  active: z.boolean(),
}));

export async function markReviewNotificationRead(
  _previous: PortalActionState,
  form: FormData,
): Promise<PortalActionState> {
  const id = z.uuid().safeParse(form.get("notification_id"));
  if (!id.success) return { error: "Choose a review notification." };
  const client = await portalClient();
  const { error } = await client.rpc("partner_mark_review_notification_read", { p_change: id.data });
  if (error) return { error: "This notification could not be marked as read." };
  revalidatePath("/partner", "layout");
  return { message: "Marked as read." };
}

export async function getPlanCafes(chainId: string) {
  if (!z.uuid().safeParse(chainId).success)
    return { error: "Choose a partner chain." };
  const preview = isLocalPartnerPreview();
  if (!preview) await requireStaff("admin", { redirectOnFailure: false });
  const client = await portalClient(preview);
  const { data, error } = await client.rpc("partner_plan_cafes", { p_chain: chainId });
  const parsed = planCafesSchema.safeParse(data);
  if (error || !parsed.success) return { error: "Could not load cafés. Try again." };
  return { cafes: parsed.data };
}

export async function commandAction(
  _previous: PortalActionState,
  form: FormData,
): Promise<PortalActionState> {
  try {
    const operation = String(form.get("operation"));
    const removal = operation === "remove_cafe";
    const action = removal ? "submit_change" : operation;
    let input: Record<string, Json | undefined> = JSON.parse(
      String(form.get("context") || "{}"),
    );
    const staff = ["review", "provision", "activate_plan"].includes(action);
    if (staff && !isLocalPartnerPreview())
      await requireStaff(action === "review" ? "editor" : "admin", {
        redirectOnFailure: false,
      });
    if (removal) {
      const target = z
        .object({
          cafe_id: z.number().int().positive(),
          baseline: z.number().int().positive(),
          request_id: z.uuid(),
        })
        .parse(input);
      const { cafe, chain_id } = await portalData("cafe", {
        id: target.cafe_id,
      });
      if (cafe?.is_active !== true)
        return { error: "This café is already archived or unavailable." };
      if (cafe.partner_revision !== target.baseline)
        return { error: "The café has changed. Refresh the page and try again." };
      input = { ...target, chain_id, payload: { is_active: false } };
    } else {
      for (const [key, value] of form.entries())
        if (!["operation", "context"].includes(key) && typeof value === "string")
          input[key] = value;
      if (!staff && action !== "accept_invite")
        input.chain_id = (await portalData("overview")).chain_id;
      if (["save_change", "submit_change"].includes(action)) {
        input.payload = cafePayload(form) as Json;
        input.media = JSON.parse(
          String(form.get("media") || '{"cover":null,"gallery":[]}'),
        ) as Json;
      }
    }
    if (action === "recipe")
      input.ingredients = JSON.parse(
        String(form.get("ingredients") || "[]"),
      ) as Json;
    if (["invite", "select_cafes", "activate_plan"].includes(action))
      input.cafe_ids = form
        .getAll("cafe_ids")
        .filter((x) => String(x).trim() !== "")
        .map(Number);
    if (action === "activate_plan") {
      delete input.confirm_empty_free;
      if (input.plan === "free" && form.get("confirm_empty_free") === "on")
        input.confirm_empty_free = true;
    }
    const client = await portalClient(staff && isLocalPartnerPreview());
    if (action === "review" && input.decision === "approve") {
      await publishReviewedMedia(client, input);
      input.media_origin = new URL(process.env.SUPABASE_URL!).origin;
    }
    const { data, error } = await client.rpc("partner_command", {
      p_action: action,
      p_input: input as Json,
    });
    if (error) {
      if (
        removal &&
        error.code === "23505" &&
        error.message.includes("partner_one_pending")
      )
        return {
          error: "This café already has a request awaiting review. Wait for that review before requesting removal.",
        };
      return { error: error.message };
    }
    revalidatePath("/partner", "layout");
    revalidatePath("/admin/partner-reviews");
    if (action === "review") {
      revalidatePath("/stores");
      revalidateTag("cafes", "max");
    }
    const savedId =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.id === "string"
        ? data.id
        : undefined;
    if (removal && savedId)
      redirect(
        `/partner/cafe?${new URLSearchParams({
          id: String(input.cafe_id),
          change: savedId,
        })}`,
      );
    const token =
      data && typeof data === "object" && !Array.isArray(data)
        ? data.token
        : undefined;
    return {
      savedId: ["save_change", "recipe"].includes(action) ? savedId : undefined,
      savedRevision:
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        typeof data.revision === "number"
          ? data.revision
          : undefined,
      nextRequestId: crypto.randomUUID(),
      message:
        action === "submit_change"
          ? "Submitted for Coffee Sphut review. Approved information remains live."
          : "Saved successfully.",
      inviteLink:
        typeof token === "string"
          ? `/partner/accept?token=${encodeURIComponent(token)}`
          : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0]?.message || "Check the form fields."
          : error instanceof Error
            ? error.message
            : "Unable to complete this action. Try again.",
    };
  }
}
export async function signInAction(
  _previous: PortalActionState,
  form: FormData,
): Promise<PortalActionState> {
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) return { error: error.message };
  redirect(safePartnerNext(form.get("next")));
}
export async function recoverAction(
  _previous: PortalActionState,
  form: FormData,
): Promise<PortalActionState> {
  const origin =
    (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return { error: "Site URL is not configured." };
  const client = await createClient();
  const { error } = await client.auth.resetPasswordForEmail(
    String(form.get("email")),
    { redirectTo: `${origin}/partner/auth/callback?next=/partner/password` },
  );
  return error
    ? { error: error.message }
    : { message: "If the account exists, a recovery link has been sent." };
}
export async function passwordAction(
  _previous: PortalActionState,
  form: FormData,
): Promise<PortalActionState> {
  const password = String(form.get("password"));
  if (password.length < 8) return { error: "Use at least eight characters." };
  const client = await createClient();
  const { error } = await client.auth.updateUser({ password });
  return error
    ? { error: error.message }
    : { message: "Password updated. You can return to the workspace." };
}
export async function partnerSignOut(): Promise<void> {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/partner/login");
}
