"use server"
import { createClient } from '@supabase/supabase-js'

export async function rewardAvailable(rewardId: string) {
  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: rewardData, error: rewardError } = await supabase
    .from('Rewards')
    .select()
    .eq('id', rewardId)
    .single()
  if (rewardData.status !== 'issued' || rewardError) {
    return false;
  }
  console.log("Checking reward availability...");
  return true;
}
export async function redeemRewardRequest(formData: FormData, rewardId: string) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
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


