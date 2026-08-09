"use server"
import { createClient } from '@supabase/supabase-js'
import type { Cafe } from "@/types/cafe"

export async function getCafes(): Promise<Cafe[]> {
  try {
    const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

    const { data, error } = await supabase
      .from('Cafe')
      .select('id, name, address, image_url, latitude, longitude')

    if (error) {
      console.error("Error fetching cafes:", error)
      return []
    }

    return (data ?? []) as Cafe[]
  } catch (error) {
    console.error("Error fetching cafes:", error)
    return []
  }
}
