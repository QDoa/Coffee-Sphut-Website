import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set."
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
