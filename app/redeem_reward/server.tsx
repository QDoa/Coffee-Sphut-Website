"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { rewardErrorMessage } from "@/lib/reward-errors";

interface RedemptionResult {
  data: string | null;
  error: string | null;
}

export async function rewardAvailable(rewardId: string): Promise<boolean> {
  if (!rewardId) return false;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("Rewards")
    .select("status")
    .eq("id", rewardId)
    .maybeSingle();

  if (error) throw new Error("Unable to check reward availability.");
  return data?.status === "issued";
}

export async function redeemRewardRequest(
  formData: FormData,
  rewardId: string,
): Promise<RedemptionResult> {
  const cafeCode = formData.get("cafeCode");
  if (!rewardId || typeof cafeCode !== "string" || !cafeCode.trim()) {
    return { data: null, error: "A reward and café code are required." };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_reward_id: rewardId,
    p_cafe_code: cafeCode.trim(),
  });

  if (error || typeof data !== "string" || !data) {
    if (error) {
      console.error("Reward redemption failed", { code: error.code, message: error.message });
    }
    return {
      data: null,
      error: error
        ? rewardErrorMessage(error, "redemption")
        : "The database did not confirm redemption. Please try again.",
    };
  }

  return { data, error: null };
}
