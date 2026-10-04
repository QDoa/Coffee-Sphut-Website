"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { MapPin, LocateFixed } from "lucide-react"
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
        <p className="text-sm text-muted-foreground">
          Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment to enable the map.
        </p>
      </div>
    )
  }

  const popupCafe = cafes.find((cafe) => cafe.id === popupCafeId) ?? null

  const popupCafeDistance = useMemo(() => {
    if (!popupCafe || !userLocation) return null
    const meters = getDistanceKm(
      popupCafe.latitude,
      popupCafe.longitude,
      userLocation.latitude,
      userLocation.longitude
    ) * 1000
    return formatDistanceKm(meters / 1000)
  }, [popupCafe, userLocation])

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cafes.map((cafe) => {
        let distanceMeters: number | null = null
        if (userLocation) {
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
  }, [cafes, userLocation])

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
          interactiveLayerIds={["clusters", "unclustered-point"]}
          onClick={(e: MapMouseEvent) => {
            const map = mapRef.current
            if (!map) return

            const clusterFeatures = map.queryRenderedFeatures(e.point, {
              layers: ["clusters"],
            })
            if (clusterFeatures.length > 0) {
              const feature = clusterFeatures[0] as any
                const clusterId = feature.properties?.cluster_id
              if (clusterId !== undefined) {
                const source = map.getSource("cafes") as any
                source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
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
              const feature = pointFeatures[0] as any
              const props = (feature.properties as Record<string, unknown>) ?? {}
              const id = props?.id as Cafe["id"]
              if (id != null) {
                onSelectCafe(id)
                setPopupCafeId(id)
                const lng = props.longitude as number | undefined
                const lat = props.latitude as number | undefined
                if (typeof lng === "number" && typeof lat === "number") {
                  map.easeTo({
                    center: [lng, lat],
                    zoom: 14,
                    duration: 600,
                  })
                }
              }
              return
            }

            onSelectCafe(null)
            setPopupCafeId(null)
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
              onClose={() => setPopupCafeId(null)}
              closeOnClick={false}
            >
              <div className="max-w-[200px] space-y-1">
                <p className="text-sm font-semibold">{popupCafe.name}</p>
                <p className="text-xs text-muted-foreground">{popupCafe.address}</p>
                {popupCafeDistance && (
                  <p className="text-xs text-muted-foreground">{popupCafeDistance}</p>
                )}
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
