"use server"
import { createClient } from '@supabase/supabase-js'

export async function sendUnsubcribeRequest(formData: FormData) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { data, error } = await supabase.functions.invoke('wishlist', {
      body: { email: formData.get('email') },
      method: 'DELETE',
    })
    console.log("Unsubscribe response:", data, error)
    return { data, error }
  } catch (error) {
    console.error("Error sending unsubscribe request:", error);
    throw error;
  }
}
