"use client"

import { useState } from "react"
import { StoreList } from "@/components/store-list"
import { StoreMap } from "@/components/store-map"
import { useUserLocation } from "@/hooks/use-user-location"
import type { Cafe } from "@/types/cafe"

interface StoreFinderProps {
  cafes: Cafe[]
}

export function StoreFinder({ cafes }: StoreFinderProps) {
  const [selectedCafeId, setSelectedCafeId] = useState<Cafe["id"] | null>(null)
  const userLocation = useUserLocation()

  return (
    <div className="flex flex-col gap-4 md:h-[70vh] md:flex-row">
      <div className="order-2 md:order-1 md:h-full md:w-2/5 md:min-w-[320px]">
        <StoreList
          cafes={cafes}
          selectedCafeId={selectedCafeId}
          onSelectCafe={setSelectedCafeId}
          userLocation={userLocation}
        />
      </div>
      <div className="order-1 h-[400px] md:order-2 md:h-full md:flex-1">
        <StoreMap
          cafes={cafes}
          selectedCafeId={selectedCafeId}
          onSelectCafe={setSelectedCafeId}
          userLocation={userLocation}
        />
      </div>
    </div>
  )
}
