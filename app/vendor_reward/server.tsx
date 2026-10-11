"use server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function addRewardTransaction(formData: FormData, userId: string) {
  try {
    const supabase = getSupabaseServerClient()

    const {data: cafeIdData, error: cafeIdError} = await supabase
      .from('Cafe')
      .select('id')
      .eq('reward_code', formData.get('cafeCode'))
      .single()

    if (cafeIdError || !cafeIdData) {
      console.error("Error fetching store ID:", cafeIdError);
      return { data: null, error: "Invalid cafe code" };
    }

    const { data, error } = await supabase
            .from('RewardTransaction')
            .insert({user_id: userId, store_id: cafeIdData.id})
    return { data, error }
  } catch (error) {
    console.error("Error adding reward transcation:", error);
    throw error;
  }
}

