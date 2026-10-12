"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCcw, Filter, CheckCircle2, Eye, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChainOption {
  id: string;
  name: string;
}

interface CafeFiltersProps {
  chains: ChainOption[];
  totalResults: number;
  totalCafes: number;
}

export function CafeFilters({
  chains,
  totalResults,
  totalCafes,
}: CafeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") || "";
  const currentChain = searchParams.get("chain") || "all";
  const currentStatus = searchParams.get("status") || "all";
  const currentDetails = searchParams.get("details") || "all";

  const [searchValue, setSearchValue] = useState(currentQ);

  useEffect(() => {
    setSearchValue(currentQ);
  }, [currentQ]);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "" || val === "all") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({ q: searchValue.trim() || null });
  }

  function handleClearAll() {
    setSearchValue("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasActiveFilters =
    Boolean(currentQ) ||
    currentChain !== "all" ||
    currentStatus !== "all" ||
    currentDetails !== "all";

  const selectedChainObj = chains.find((c) => c.id === currentChain);

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 max-w-md"
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by store name or address..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-8 pr-16 h-9 text-sm"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                updateQuery({ q: null });
              }}
              className="absolute right-9 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1 h-7 text-xs px-2"
          >
            Go
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chain Filter */}
          <div className="flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline-block" />
            <select
              aria-label="Filter by Chain"
              value={currentChain}
              onChange={(e) => updateQuery({ chain: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Chains</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status Filter */}
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline-block" />
            <select
              aria-label="Filter by Store Active Status"
              value={currentStatus}
              onChange={(e) => updateQuery({ status: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Show Full Details Filter */}
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline-block" />
            <select
              aria-label="Filter by Show Full Details"
              value={currentDetails}
              onChange={(e) => updateQuery({ details: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All App Details</option>
              <option value="yes">Full Details (Enabled)</option>
              <option value="no">Full Details (Disabled)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="h-9 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Badges & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>
            Showing <strong className="text-foreground">{totalResults}</strong> of{" "}
            <strong className="text-foreground">{totalCafes}</strong> cafes
            {isPending && <span className="ml-1 text-xs animate-pulse">updating...</span>}
          </span>

          {hasActiveFilters && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-xs font-medium">Filtered by:</span>
            </>
          )}

          {currentQ && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 font-normal"
            >
              Search: &ldquo;{currentQ}&rdquo;
              <button
                type="button"
                onClick={() => updateQuery({ q: null })}
                className="hover:text-foreground ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentChain !== "all" && selectedChainObj && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 font-normal"
            >
              Chain: {selectedChainObj.name}
              <button
                type="button"
                onClick={() => updateQuery({ chain: null })}
                className="hover:text-foreground ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentStatus !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 font-normal"
            >
              Status: {currentStatus === "active" ? "Active" : "Inactive"}
              <button
                type="button"
                onClick={() => updateQuery({ status: null })}
                className="hover:text-foreground ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentDetails !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 font-normal"
            >
              Details: {currentDetails === "yes" ? "Enabled" : "Disabled"}
              <button
                type="button"
                onClick={() => updateQuery({ details: null })}
                className="hover:text-foreground ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
