"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { Coffee, Navigation, SearchX, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDistanceKm, formatDistanceKm } from "@/lib/geo";
import type { UserLocation } from "@/hooks/use-user-location";
import type { Cafe } from "@/types/cafe";

interface StoreListProps {
  cafes: Cafe[];
  selectedCafeId: Cafe["id"] | null;
  onSelectCafe: (id: Cafe["id"] | null) => void;
  userLocation: UserLocation | null;
  query: string;
  onClearSearch: () => void;
  isPending: boolean;
}

export function StoreList({
  cafes,
  selectedCafeId,
  onSelectCafe,
  userLocation,
  query,
  onClearSearch,
  isPending,
}: StoreListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const sortedCafes = useMemo(() => {
    if (!userLocation || cafes.every((cafe) => cafe.distance_meters != null))
      return cafes;
    return [...cafes].sort((a, b) => {
      const distanceA =
        a.distance_meters != null
          ? a.distance_meters / 1000
          : getDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              a.latitude,
              a.longitude,
            );
      const distanceB =
        b.distance_meters != null
          ? b.distance_meters / 1000
          : getDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              b.latitude,
              b.longitude,
            );
      return distanceA - distanceB;
    });
  }, [cafes, userLocation]);

  useEffect(() => {
    const list = listRef.current;
    const selected = selectedRef.current;
    if (!list || !selected || list.clientHeight === 0) return;
    const row = selected.getBoundingClientRect();
    const container = list.getBoundingClientRect();
    const offset =
      row.top < container.top
        ? row.top - container.top
        : row.bottom > container.bottom
          ? row.bottom - container.bottom
          : 0;
    if (offset)
      list.scrollBy({
        top: offset,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [selectedCafeId]);

  if (sortedCafes.length === 0) {
    if (isPending) {
      return (
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
          Finding your next coffee spot…
        </div>
      );
    }
    return (
      <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <SearchX className="mb-4 size-7 text-primary" aria-hidden="true" />
        <h2 className="font-serif text-2xl">
          {trimmedQuery
            ? "No spots found this time."
            : "More coffee spots to come."}
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {trimmedQuery
            ? `Try a different café name or neighbourhood. Nothing matched “${trimmedQuery}”.`
            : "No cafés are available right now. Please try again in a little while."}
        </p>
        {trimmedQuery && (
          <Button
            type="button"
            variant="outline"
            onClick={onClearSearch}
            className="mt-5 h-11"
          >
            Clear search
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1"
    >
      {sortedCafes.map((cafe) => {
        const isSelected = cafe.id === selectedCafeId;
        const distanceKm =
          cafe.distance_meters != null
            ? cafe.distance_meters / 1000
            : userLocation
              ? getDistanceKm(
                  userLocation.latitude,
                  userLocation.longitude,
                  cafe.latitude,
                  cafe.longitude,
                )
              : null;
        return (
          <div
            key={cafe.id}
            ref={isSelected ? selectedRef : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-xl border bg-card pr-2 transition-colors duration-200",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
            )}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              aria-label={`Show ${cafe.name} on the map`}
              onClick={() => onSelectCafe(cafe.id)}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-4"
            >
              <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {cafe.image_url ? (
                  <Image
                    src={cafe.image_url}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 object-cover"
                  />
                ) : (
                  <Coffee className="size-6 text-primary" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {cafe.name}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {cafe.address}
                </span>
                {userLocation && distanceKm !== null && (
                  <span className="mt-1 block text-xs font-medium text-primary">
                    {formatDistanceKm(distanceKm)} away
                  </span>
                )}
                {isSelected && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Selected on map <ArrowUpRight className="size-3" />
                  </span>
                )}
              </span>
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Get directions to ${cafe.name}`}
              title="Get directions in Google Maps"
            >
              <Navigation className="size-4" />
            </a>
          </div>
        );
      })}
    </div>
  );
}
