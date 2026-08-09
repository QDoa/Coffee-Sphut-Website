"use client"

import { useEffect, useState } from "react"

export interface UserLocation {
  latitude: number
  longitude: number
}

/**
 * Requests the browser's geolocation once on mount and returns the
 * user's coordinates once resolved. Falls back silently to `null` if
 * geolocation is unsupported, denied, or times out.
 */
export function useUserLocation(): UserLocation | null {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        // Permission denied, unavailable, or timed out — keep default state.
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }, [])

  return userLocation
}
