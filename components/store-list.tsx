"use client"

import { useMemo } from "react"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getDistanceKm, formatDistanceKm } from "@/lib/geo"
import type { UserLocation } from "@/hooks/use-user-location"
import type { Cafe } from "@/types/cafe"

interface StoreListProps {
  cafes: Cafe[]
  selectedCafeId: Cafe["id"] | null
  onSelectCafe: (id: Cafe["id"] | null) => void
  userLocation: UserLocation | null
}

export function StoreList({ cafes, selectedCafeId, onSelectCafe, userLocation }: StoreListProps) {
  const sortedCafes = useMemo(() => {
    if (!userLocation) return cafes

    return [...cafes].sort((a, b) => {
      const distanceA = getDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
      const distanceB = getDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      return distanceA - distanceB
    })
  }, [cafes, userLocation])

  if (sortedCafes.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border p-6 text-center text-sm text-muted-foreground">
        No coffee shops found yet.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {sortedCafes.map((cafe) => (
        <Card
          key={cafe.id}
          onClick={() => onSelectCafe(cafe.id)}
          className={cn(
            "cursor-pointer flex-row items-center gap-4 py-3 transition-colors hover:border-primary/60",
            cafe.id === selectedCafeId && "border-primary"
          )}
        >
          <CardContent className="flex w-full items-center gap-4 px-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {cafe.image_url ? (
                <Image
                  src={cafe.image_url}
                  alt={cafe.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <MapPin className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{cafe.name}</p>
              <p className="truncate text-xs text-muted-foreground">{cafe.address}</p>
              {userLocation && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDistanceKm(
                    getDistanceKm(userLocation.latitude, userLocation.longitude, cafe.latitude, cafe.longitude)
                  )}{" "}
                  away
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
