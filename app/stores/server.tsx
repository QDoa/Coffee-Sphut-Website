"use server"

import { unstable_cache } from "next/cache"
import { sanitizeSearchTerm, SEARCH_RESULT_LIMIT } from "@/lib/search"
import { getSupabaseServerClient } from "@/lib/supabase"
import type { Cafe } from "@/types/cafe"

const fetchCachedCafes = unstable_cache(
  async (): Promise<Cafe[]> => {
    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from("Cafe")
      .select("id, name, address, image_url, latitude, longitude")
      .limit(SEARCH_RESULT_LIMIT)

    if (error) {
      throw error
    }

    return (data ?? []) as Cafe[]
  },
  ["cafes-list"],
  { revalidate: 300, tags: ["cafes"] }
)

export async function getCafes(): Promise<Cafe[]> {
  try {
    return await fetchCachedCafes()
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
    const supabase = getSupabaseServerClient()

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
