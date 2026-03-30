"use server"
import { createClient } from '@supabase/supabase-js'

export async function sendDeleteAccountRequest(formData: FormData) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
    const { data, error } = await supabase.functions.invoke('delete-account-request', {
      body: { email: formData.get('email'), firstName: formData.get('first_name'), lastName: formData.get('last_name') },
      method: 'POST',
    })
    return { data, error }
  } catch (error) {
    console.error("Error sending delete account request:", error);
    return { data: null, error }
  }
}
