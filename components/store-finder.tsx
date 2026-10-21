"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { List, Map as MapIcon } from "lucide-react"
import { searchCafes } from "@/app/stores/server"
import { StoreList } from "@/components/store-list"
import { StoreSearch } from "@/components/store-search"

const StoreMap = dynamic(
  () => import("@/components/store-map").then((mod) => mod.StoreMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">
        Loading map...
      </div>
    ),
  }
)
import { useDebounce } from "@/hooks/use-debounce"
import { useUserLocation } from "@/hooks/use-user-location"
import { getDistanceKm } from "@/lib/geo"
import { SEARCH_FALLBACK_CENTER, SEARCH_RESULT_LIMIT } from "@/lib/search"
import { cn } from "@/lib/utils"
import type { Cafe } from "@/types/cafe"

const SEARCH_DEBOUNCE_MS = 300

interface StoreFinderProps {
  cafes: Cafe[]
}

export function StoreFinder({ cafes: initialCafes }: StoreFinderProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const userLocation = useUserLocation()

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [results, setResults] = useState<Cafe[]>(initialCafes)
  const [selectedCafeId, setSelectedCafeId] = useState<Cafe["id"] | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "map">("list")
  const [isPending, startTransition] = useTransition()

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS)

  const requestIdRef = useRef(0)
  const lastSyncedQueryRef = useRef<string | null>(searchParams.get("q") ?? "")
  const initialCafesRef = useRef(initialCafes)

  const location = useMemo(() => userLocation ?? SEARCH_FALLBACK_CENTER, [userLocation])

  useEffect(() => {
    initialCafesRef.current = initialCafes
  }, [initialCafes])

  useEffect(() => {
    const urlQuery = searchParams.get("q") ?? ""

    if (urlQuery === lastSyncedQueryRef.current) return

    lastSyncedQueryRef.current = urlQuery
    setQuery(urlQuery)
  }, [searchParams])

  useEffect(() => {
    if (query !== debouncedQuery) return

    const urlQuery = searchParams.get("q") ?? ""

    if (query === urlQuery) return

    const params = new URLSearchParams(searchParams.toString())

    if (query) params.set("q", query)
    else params.delete("q")

    const next = params.toString()

    lastSyncedQueryRef.current = query
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [query, debouncedQuery, pathname, router, searchParams])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const trimmed = debouncedQuery.trim()

    if (!trimmed) {
      setResults(initialCafesRef.current)
      return
    }

    startTransition(async () => {
      const found = await searchCafes({
        searchTerm: trimmed,
        latitude: location.latitude,
        longitude: location.longitude,
        maxResult: SEARCH_RESULT_LIMIT,
      })

      if (requestIdRef.current !== requestId) return

      setResults(found)
    })
  }, [debouncedQuery, location])

  const cafesWithDistance = useMemo(() => {
    if (!userLocation) return results

    return results
      .map((cafe) => ({
        ...cafe,
        distance_meters: Math.round(
          getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            cafe.latitude,
            cafe.longitude
          ) * 1000
        ),
      }))
      .sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity))
  }, [results, userLocation])

  const activeSelectedCafeId = useMemo(() => {
    if (selectedCafeId === null) return null
    return cafesWithDistance.some((cafe) => cafe.id === selectedCafeId)
      ? selectedCafeId
      : null
  }, [cafesWithDistance, selectedCafeId])

  return (
    <div className="flex flex-col gap-4 md:h-[70vh]">
      {/* Mobile View Toggle Switch */}
      <div className="flex md:hidden items-center justify-center p-1 bg-muted rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileView === "list"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="h-4 w-4" />
          <span>List ({cafesWithDistance.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
            mobileView === "map"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MapIcon className="h-4 w-4" />
          <span>Map View</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* List & Search View */}
        <div
          className={cn(
            "flex min-h-0 flex-col gap-3 md:h-full md:w-2/5 md:min-w-[320px]",
            mobileView === "list" ? "flex" : "hidden md:flex"
          )}
        >
          <StoreSearch
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            isPending={isPending}
            resultCount={cafesWithDistance.length}
          />
          <div
            aria-busy={isPending}
            className={cn(
              "flex min-h-0 flex-1 flex-col transition-opacity",
              isPending && "opacity-60"
            )}
          >
            <StoreList
              cafes={cafesWithDistance}
              selectedCafeId={activeSelectedCafeId}
              onSelectCafe={(id) => {
                setSelectedCafeId(id)
                // If on mobile and user clicks a cafe, switch to map view to show where it is!
                if (window.innerWidth < 768 && id !== null) {
                  setMobileView("map")
                }
              }}
              userLocation={userLocation}
              query={query}
            />
          </div>
        </div>

        {/* Map View */}
        <div
          className={cn(
            "h-[65vh] min-h-[400px] md:h-full md:flex-1 rounded-xl overflow-hidden border border-border",
            mobileView === "map" ? "block" : "hidden md:block"
          )}
        >
          <StoreMap
            cafes={cafesWithDistance}
            selectedCafeId={activeSelectedCafeId}
            onSelectCafe={setSelectedCafeId}
            userLocation={userLocation}
          />
        </div>
      </div>
    </div>
  )
}
