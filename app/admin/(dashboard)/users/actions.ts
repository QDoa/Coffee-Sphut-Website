"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function resetUserOnboardingAction(userId: string, reason: string) {
  await requireAdmin();
  const cleanReason = reason?.trim();
  if (!cleanReason) {
    return { error: "A valid reason is required to reset onboarding." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reset_onboarding", {
    p_user_id: userId,
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { success: true };
}

export async function adjustPunchCountAction(
  userId: string,
  chainId: string,
  newCount: number,
  reason: string
) {
  await requireAdmin();
  const cleanReason = reason?.trim();
  if (!cleanReason) {
    return { error: "A valid reason is required to adjust punch count." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_punch_count", {
    p_user_id: userId,
    p_chain_id: chainId,
    p_new_count: newCount,
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function voidRewardAction(userId: string, rewardId: string, reason: string) {
  await requireAdmin();
  const cleanReason = reason?.trim();
  if (!cleanReason) {
    return { error: "A valid reason is required to void a reward." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_void_reward", {
    p_reward_id: rewardId,
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}
