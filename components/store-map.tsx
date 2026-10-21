"use client"

import { useEffect, useMemo, useRef } from "react"
import Map, {
  Marker,
  Popup,
  NavigationControl,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl/mapbox"
import type { MapMouseEvent } from "react-map-gl/mapbox"
import type mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { MapPin, LocateFixed, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDistanceKm, formatDistanceKm } from "@/lib/geo"
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

function hasValidCoordinates(coords: { latitude: number; longitude: number }): boolean {
  return (
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    Math.abs(coords.latitude) <= 90 &&
    Math.abs(coords.longitude) <= 180
  )
}

export function StoreMap({ cafes, selectedCafeId, onSelectCafe, userLocation }: StoreMapProps) {
  const mapRef = useRef<MapRef>(null)

  const validCafes = useMemo(
    () => cafes.filter((cafe) => hasValidCoordinates(cafe)),
    [cafes]
  )

  const initialViewState = useMemo(() => {
    if (validCafes.length > 0) {
      const first = validCafes[0]
      return { latitude: first.latitude, longitude: first.longitude, zoom: 11 }
    }
    return DEFAULT_VIEW
  }, [validCafes])

  // Fly to the user's location once resolved, unless a cafe is already selected.
  useEffect(() => {
    if (!userLocation || !hasValidCoordinates(userLocation) || selectedCafeId !== null) return
    mapRef.current?.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 12,
      duration: 800,
    })
  }, [userLocation, selectedCafeId])

  useEffect(() => {
    if (selectedCafeId === null) return
    const selected = validCafes.find((cafe) => String(cafe.id) === String(selectedCafeId))
    if (!selected) return
    mapRef.current?.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: 14,
      duration: 800,
    })
  }, [selectedCafeId, validCafes])

  const popupCafe = useMemo(() => {
    if (selectedCafeId === null) return null
    return validCafes.find((cafe) => String(cafe.id) === String(selectedCafeId)) ?? null
  }, [validCafes, selectedCafeId])

  const popupCafeDistance = useMemo(() => {
    if (!popupCafe || !userLocation) return null
    const distanceKm =
      popupCafe.distance_meters != null
        ? popupCafe.distance_meters / 1000
        : getDistanceKm(
            popupCafe.latitude,
            popupCafe.longitude,
            userLocation.latitude,
            userLocation.longitude
          )
    return formatDistanceKm(distanceKm)
  }, [popupCafe, userLocation])

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: validCafes.map((cafe) => {
        let distanceMeters: number | null = cafe.distance_meters ?? null
        if (distanceMeters === null && userLocation) {
          const km = getDistanceKm(
            cafe.latitude,
            cafe.longitude,
            userLocation.latitude,
            userLocation.longitude
          )
          distanceMeters = Math.round(km * 1000)
        }

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [cafe.longitude, cafe.latitude] as [number, number],
          },
          properties: {
            id: cafe.id,
            name: cafe.name,
            address: cafe.address,
            latitude: cafe.latitude,
            longitude: cafe.longitude,
            distance_meters: distanceMeters,
          },
        }
      }),
    }
  }, [validCafes, userLocation])

  if (!MAPBOX_TOKEN) {
    console.debug("Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment to enable the map.")
    return (
      <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 p-6 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Map unavailable</p>
        <p className="text-sm text-muted-foreground">
          Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment to enable the map.
        </p>
      </div>
    )
  }

  const handleRecenter = () => {
    if (!userLocation || !hasValidCoordinates(userLocation)) return
    onSelectCafe(null)
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
          interactiveLayerIds={["clusters", "unclustered-point"]}
          onClick={(e: MapMouseEvent) => {
            const map = mapRef.current
            if (!map) return

            const clusterFeatures = map.queryRenderedFeatures(e.point, {
              layers: ["clusters"],
            })
            if (clusterFeatures.length > 0) {
              const feature = clusterFeatures[0] as unknown as {
                properties?: Record<string, unknown> | null
              }
              const clusterId = feature.properties?.cluster_id as number | undefined
              if (clusterId !== undefined) {
                const source = map.getSource("cafes") as mapboxgl.GeoJSONSource | undefined
                source?.getClusterExpansionZoom(clusterId, (err, zoom) => {
                  if (err) return
                  map.easeTo({
                    center: e.lngLat.toArray() as [number, number],
                    zoom: Math.min(zoom ?? map.getZoom() + 1, 16),
                    duration: 600,
                  })
                })
              }
              return
            }

            const pointFeatures = map.queryRenderedFeatures(e.point, {
              layers: ["unclustered-point"],
            })
            if (pointFeatures.length > 0) {
              const feature = pointFeatures[0] as unknown as {
                properties?: Record<string, unknown> | null
              }
              const props = feature.properties ?? {}
              const rawId = props?.id as Cafe["id"] | undefined
              if (rawId != null) {
                const matchedCafe = validCafes.find(
                  (cafe) => String(cafe.id) === String(rawId)
                )
                onSelectCafe(matchedCafe ? matchedCafe.id : rawId)
              }
              return
            }

            onSelectCafe(null)
          }}
        >
          <NavigationControl position="top-right" />
          <Source
            id="cafes"
            type="geojson"
            data={geojson}
            cluster
            clusterRadius={50}
            clusterMaxZoom={14}
            clusterMinPoints={2}
          >
            <Layer
              id="clusters"
              type="circle"
              source="cafes"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#7B4B24",
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  20,
                  100,
                  30,
                  750,
                  40,
                ],
              }}
            />
            <Layer
              id="cluster-count"
              type="symbol"
              source="cafes"
              filter={["has", "point_count"]}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 9,
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                "text-anchor": "center",
              }}
              paint={{
                "text-color": "#ffffff",
              }}
            />
            <Layer
              id="unclustered-point"
              type="symbol"
              source="cafes"
              filter={["!", ["has", "point_count"]]}
              layout={{
                "icon-image": ["coalesce", ["image", "cafe"], "marker"],
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  1.2,
                  12,
                  1.425,
                  14,
                  1.65,
                ],
                "icon-anchor": "center",
                "icon-allow-overlap": false,
                "icon-ignore-placement": false,
                "text-field": ["get", "name"],
                "text-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  7.5,
                  12,
                  8.25,
                  14,
                  9.75,
                ],
                "text-offset": [0, 1.2],
                "text-anchor": "top",
                "text-allow-overlap": false,
                "text-ignore-placement": false,
                "text-max-width": 10,
              }}
              paint={{
                "text-color": "#111111",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.25,
              }}
            />
          </Source>

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
              onClose={() => onSelectCafe(null)}
              closeOnClick={false}
            >
              <div className="max-w-[220px] space-y-1.5 p-1">
                <p className="text-sm font-semibold text-foreground">{popupCafe.name}</p>
                <p className="text-xs text-muted-foreground">{popupCafe.address}</p>
                {popupCafeDistance && (
                  <p className="text-xs font-medium text-primary">{popupCafeDistance} away</p>
                )}
                <div className="pt-1 border-t border-border/60">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${popupCafe.latitude},${popupCafe.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Navigation className="h-3 w-3" />
                    <span>Get Directions</span>
                  </a>
                </div>
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
