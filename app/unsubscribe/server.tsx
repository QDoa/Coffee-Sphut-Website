"use server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function sendUnsubcribeRequest(formData: FormData) {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.functions.invoke('wishlist', {
      body: { email: formData.get('email') },
      method: 'DELETE',
    })
    return { data, error }
  } catch (error) {
    console.error("Error sending unsubscribe request:", error);
    throw error;
  }
}

export async function sendSubcribeRequest(formData: FormData) {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.functions.invoke('wishlist', {
      body: { email: formData.get('email') },
      method: 'POST',
    })
    return { data, error }
  } catch (error) {
    console.error("Error sending subscribe request:", error);
    return { data: null, error }
  }
}
