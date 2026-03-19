"use server"
import { createClient } from '@supabase/supabase-js'

export async function updatePasswordRequest(password: string) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
    const new_password = password;
    if (new_password == null) {
      return{data: null, error: "Unable to reset password"};
    }
    const { error } = await supabase.auth.updateUser({ password: String(new_password) })
    if (error) throw error
    return {data: true, error: null }
    // Update this route to redirect to an authenticated route. The user already has an active session.
  } catch (error: unknown) {
    console.error("Error sending request:", error);
    return { data: null, error }
  }
}
