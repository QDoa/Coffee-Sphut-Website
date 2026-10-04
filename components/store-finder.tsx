"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { searchCafes } from "@/app/stores/server"
import { StoreList } from "@/components/store-list"
import { StoreMap } from "@/components/store-map"
import { StoreSearch } from "@/components/store-search"
import { useDebounce } from "@/hooks/use-debounce"
import { useUserLocation } from "@/hooks/use-user-location"
import { SEARCH_FALLBACK_CENTER, SEARCH_RESULT_LIMIT } from "@/lib/search"
import { cn } from "@/lib/utils"
import type { Cafe } from "@/types/cafe"

const SEARCH_DEBOUNCE_MS = 300

interface StoreFinderProps {
  cafes: Cafe[]
}

export function StoreFinder({ cafes: initialCafes }: StoreFinderProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Cafe[]>(initialCafes)
  const [selectedCafeId, setSelectedCafeId] = useState<Cafe["id"] | null>(null)
  const [isPending, startTransition] = useTransition()

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const userLocation = useUserLocation()
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS)

  const requestIdRef = useRef(0)
  const lastSyncedQueryRef = useRef<string | null>(null)
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

  useEffect(() => {
    if (selectedCafeId === null) return
    if (results.some((cafe) => cafe.id === selectedCafeId)) return

    setSelectedCafeId(null)
  }, [results, selectedCafeId])

  return (
    <div className="flex flex-col gap-4 md:h-[70vh] md:flex-row">
      <div className="order-2 flex min-h-0 flex-col gap-3 md:order-1 md:h-full md:w-2/5 md:min-w-[320px]">
        <StoreSearch
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          isPending={isPending}
          resultCount={results.length}
        />
        <div
          aria-busy={isPending}
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity",
            isPending && "opacity-60"
          )}
        >
          <StoreList
            cafes={results}
            selectedCafeId={selectedCafeId}
            onSelectCafe={setSelectedCafeId}
            userLocation={userLocation}
            query={query}
          />
        </div>
      </div>
      <div className="order-1 h-[400px] md:order-2 md:h-full md:flex-1">
        <StoreMap
          cafes={results}
          selectedCafeId={selectedCafeId}
          onSelectCafe={setSelectedCafeId}
          userLocation={userLocation}
        />
      </div>
    </div>
  )
}
