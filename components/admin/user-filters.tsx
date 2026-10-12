"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCcw, CheckCircle2, Clock, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserFiltersProps {
  totalResults: number;
  totalUsers: number;
}

export function UserFilters({ totalResults, totalUsers }: UserFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") || "";
  const currentOnboarding = searchParams.get("onboarding") || "all";
  const currentSort = searchParams.get("sort") || "newest";

  const [searchValue, setSearchValue] = useState(currentQ);

  useEffect(() => {
    setSearchValue(currentQ);
  }, [currentQ]);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "" || val === "all" || (key === "sort" && val === "newest")) {
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
    currentOnboarding !== "all" ||
    currentSort !== "newest";

  return (
    <div className="space-y-3">
      {/* Search and Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, ID, or answers..."
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
          {/* Onboarding status select */}
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline-block" />
            <select
              aria-label="Filter by Onboarding Status"
              value={currentOnboarding}
              onChange={(e) => updateQuery({ onboarding: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Onboarding</option>
              <option value="completed">Completed Only</option>
              <option value="incomplete">Incomplete Only</option>
            </select>
          </div>

          {/* Sort select */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline-block" />
            <select
              aria-label="Sort users"
              value={currentSort}
              onChange={(e) => updateQuery({ sort: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="newest">Newest Joined</option>
              <option value="oldest">Oldest Joined</option>
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

      {/* Active Filters and Results Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>
            Showing <strong className="text-foreground">{totalResults}</strong> of{" "}
            <strong className="text-foreground">{totalUsers}</strong> users
            {isPending && <span className="ml-1 text-xs animate-pulse">updating...</span>}
          </span>

          {hasActiveFilters && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-xs font-medium">Filtered by:</span>
            </>
          )}

          {currentQ && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 font-normal">
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

          {currentOnboarding !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 font-normal">
              Onboarding: {currentOnboarding === "completed" ? "Completed" : "Incomplete"}
              <button
                type="button"
                onClick={() => updateQuery({ onboarding: null })}
                className="hover:text-foreground ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentSort !== "newest" && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 font-normal">
              Sort: Oldest First
              <button
                type="button"
                onClick={() => updateQuery({ sort: null })}
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
