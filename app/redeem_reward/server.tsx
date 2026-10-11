"use server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function rewardAvailable(rewardId: string) {
  const supabase = getSupabaseServerClient()
  const { data: rewardData, error: rewardError } = await supabase
    .from('Rewards')
    .select()
    .eq('id', rewardId)
    .single()
  if (rewardError || !rewardData || rewardData.status !== 'issued') {
    return false;
  }
  console.log("Checking reward availability...");
  return true;
}

export async function redeemRewardRequest(formData: FormData, rewardId: string) {
  try {
    const supabase = getSupabaseServerClient()
    // get chain id from cafe code
    const {data: cafeIdData, error: cafeIdError} = await supabase
      .from('Cafe')
      .select('id, chain_id')
      .eq('reward_code', formData.get('cafeCode'))
      .single()

    if (cafeIdError || !cafeIdData) {
      console.error("Error fetching store ID:", cafeIdError);
      return { data: null, error: "Invalid cafe code" };
    }

    const { data: rewardData, error: rewardError } = await supabase
      .from('Rewards')
      .update({status: 'redeemed'})
      .eq('chain_id', cafeIdData.chain_id)
      .eq('id', rewardId)
      .eq('status', 'issued')
      .select()
      .single()

    console.log("Reward data:", rewardData, "Reward error:", rewardError)

    return { data: rewardData, error: rewardError }

  } catch (error) {
    console.error("Error sending unsubscribe request:", error);
    throw error;
  }
}


