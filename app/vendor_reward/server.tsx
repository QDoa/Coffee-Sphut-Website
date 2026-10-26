"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { rewardErrorMessage } from "@/lib/reward-errors";

interface StampResult {
  data: string | null;
  error: string | null;
}

export async function addRewardTransaction(
  formData: FormData,
  userId: string,
): Promise<StampResult> {
  const cafeCode = formData.get("cafeCode");
  if (!userId || typeof cafeCode !== "string" || !cafeCode.trim()) {
    return { data: null, error: "A customer and café code are required." };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_reward_stamp", {
    p_user_id: userId,
    p_cafe_code: cafeCode.trim(),
  });

  if (error || typeof data !== "string" || !data) {
    if (error) {
      console.error("Reward stamp failed", { code: error.code, message: error.message });
    }
    return {
      data: null,
      error: error
        ? rewardErrorMessage(error, "stamp")
        : "The database did not confirm the stamp. Please try again.",
    };
  }

  return { data, error: null };
}
