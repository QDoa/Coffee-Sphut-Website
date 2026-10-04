"use server"
import { createClient } from '@supabase/supabase-js'
import { sanitizeSearchTerm } from "@/lib/search"
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

export async function searchCafes({
  searchTerm,
  latitude,
  longitude,
  maxResult,
}: {
  searchTerm: string;
  latitude: number;
  longitude: number;
  maxResult: number;
}): Promise<Cafe[]> {
  try {
    const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

    const { data, error } = await supabase.rpc("get_closest_cafes", {
      user_lat: latitude,
      user_long: longitude,
      search_term: sanitizeSearchTerm(searchTerm),
      max_results: maxResult,
    })

    if (error) {
      console.error("Error searching cafes:", error)
      return []
    }

    return (data ?? []) as Cafe[]
  } catch (error) {
    console.error("Error searching cafes:", error)
    return []
  }
}
