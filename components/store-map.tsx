"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Map, { Marker, Popup, NavigationControl, type MapRef } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { MapPin, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UserLocation } from "@/hooks/use-user-location"
import type { Cafe } from "@/types/cafe"

interface StoreMapProps {
  cafes: Cafe[]
  selectedCafeId: Cafe["id"] | null
  onSelectCafe: (id: Cafe["id"] | null) => void
  userLocation: UserLocation | null
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const DEFAULT_VIEW = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3.2,
}

export function StoreMap({ cafes, selectedCafeId, onSelectCafe, userLocation }: StoreMapProps) {
  const [popupCafeId, setPopupCafeId] = useState<Cafe["id"] | null>(null)
  const mapRef = useRef<MapRef>(null)

  const initialViewState = useMemo(() => {
    if (cafes.length > 0) {
      const first = cafes[0]
      return { latitude: first.latitude, longitude: first.longitude, zoom: 11 }
    }
    return DEFAULT_VIEW
  }, [cafes])

  // Fly to the user's location once resolved, unless a cafe is already selected.
  useEffect(() => {
    if (!userLocation || selectedCafeId !== null) return
    mapRef.current?.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 12,
      duration: 800,
    })
  }, [userLocation, selectedCafeId])

  useEffect(() => {
    if (selectedCafeId === null) return
    const selected = cafes.find((cafe) => cafe.id === selectedCafeId)
    if (!selected) return
    mapRef.current?.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: 14,
      duration: 800,
    })
  }, [selectedCafeId, cafes])

  if (!MAPBOX_TOKEN) {
    console.debug("Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment to enable the map.")
    return (
      <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 p-6 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Map unavailable</p>
      </div>
    )
  }

  const popupCafe = cafes.find((cafe) => cafe.id === popupCafeId) ?? null

  const handleRecenter = () => {
    if (!userLocation) return
    onSelectCafe(null)
    setPopupCafeId(null)
    mapRef.current?.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 12,
      duration: 800,
    })
  }

  return (
    <div className="h-full min-h-[400px] w-full overflow-hidden rounded-xl border">
      <div className="relative h-full w-full">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialViewState}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          {cafes.map((cafe) => (
            <Marker
              key={cafe.id}
              latitude={cafe.latitude}
              longitude={cafe.longitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onSelectCafe(cafe.id)
                setPopupCafeId(cafe.id)
              }}
            >
              <MapPin
                className={`h-7 w-7 drop-shadow-md transition-colors ${
                  cafe.id === selectedCafeId ? "text-primary" : "text-foreground"
                }`}
                fill="currentColor"
              />
            </Marker>
          ))}

          {userLocation && (
            <Marker
              latitude={userLocation.latitude}
              longitude={userLocation.longitude}
              anchor="center"
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-md" />
            </Marker>
          )}

          {popupCafe && (
            <Popup
              latitude={popupCafe.latitude}
              longitude={popupCafe.longitude}
              anchor="top"
              onClose={() => setPopupCafeId(null)}
              closeOnClick={false}
            >
              <div className="max-w-[200px] space-y-1">
                <p className="text-sm font-semibold">{popupCafe.name}</p>
                <p className="text-xs text-muted-foreground">{popupCafe.address}</p>
              </div>
            </Popup>
          )}
        </Map>

        {userLocation && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={handleRecenter}
            aria-label="Return to my location"
            className="absolute bottom-10 right-2 shadow-md"
          >
            <LocateFixed className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  )
}
