"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

interface StoreSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isPending: boolean;
  resultCount: number;
}

export function StoreSearch({ value, onChange, onClear, isPending, resultCount }: StoreSearchProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by name or address"
          aria-label="Search coffee stores by name or address"
          className="pl-9 pr-9"
        />
        {isPending ? (
          <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        ) : value.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {isPending ? "Searching…" : `${resultCount} ${resultCount === 1 ? "store" : "stores"}`}
      </p>
    </div>
  )
}
