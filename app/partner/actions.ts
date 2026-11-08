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
