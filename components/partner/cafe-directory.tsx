"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RequestQueuePage } from "@/lib/partner/request-queue";
import { RequestQueueCount, RequestQueueFilters, RequestQueuePagination } from "./request-queue-controls";
import { DiscardCafeChangeButton } from "./discard-cafe-change-button";

interface CafeDirectoryProps {
  initialSearch: string;
  tab?: "directory" | "requests";
  notice?: string;
  canAdd: boolean;
  queue: RequestQueuePage;
  pending: { id: string; cafe_id: number }[];
  pendingCount: number;
  cafes: {
    id: string;
    name: string;
    address: string;
    postcode: string;
    active: boolean;
  }[];
  requests: {
    id: string;
    name: string;
    status: string;
    reason: string;
    date: string;
    dateLabel: string;
    reviewed: boolean;
    removableStatus?: "draft" | "pending";
    href: string;
  }[];
}

const REQUEST_STATUSES: Record<
  string,
  { label: string; className: string; action?: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
    action: "Resume draft",
  },
  pending: {
    label: "Awaiting review",
    className: "bg-amber-100 text-amber-950",
  },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-950" },
  rejected: {
    label: "Changes requested",
    className: "bg-primary/10 text-primary",
    action: "Revise rejected request",
  },
};

const FILTER_CLASS =
  "min-h-11 w-full rounded-xl border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring";
const ROW_CLASS =
  "flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function CafeDirectory({
  initialSearch,
  tab,
  notice,
  canAdd,
  cafes,
  requests,
  queue,
  pending,
  pendingCount,
}: CafeDirectoryProps) {
  const [search, setSearch] = useState(initialSearch);
  const [cafeStatus, setCafeStatus] = useState("all");
  const legacyRequestsLink = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash === "#cafe-change-requests",
    () => false,
  );
  const currentTab = tab ?? (legacyRequestsLink ? "requests" : "directory");
  const searchInput = useRef<HTMLInputElement>(null);
  const activeCount = cafes.filter((cafe) => cafe.active).length;
  const pendingByCafe = new Map(
    pending.map((request) => [String(request.cafe_id), request.id]),
  );
  const query = search.trim().toLowerCase();
  const visibleCafes = cafes.filter(
    (cafe) =>
      (cafeStatus === "all" || (cafeStatus === "active") === cafe.active) &&
      [cafe.name, cafe.address, cafe.postcode].some((field) =>
        field.toLowerCase().includes(query),
      ),
  );
  const queueLocation = {
    path: "/partner/cafes",
    anchor: "#cafe-change-requests",
    directorySearch: search,
    tab: "requests",
  };

  function tabHref(view: "directory" | "requests") {
    const params = new URLSearchParams({ tab: view });
    if (search) params.set("q", search);
    if (queue.query.search) params.set("request_q", queue.query.search);
    if (queue.query.filter !== "all") params.set("request_filter", queue.query.filter);
    if (queue.page > 1) params.set("request_page", String(queue.page));
    return `/partner/cafes?${params}`;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Manage your café listings and follow changes through review.
        </p>
        {canAdd && (
          <Button asChild className="min-h-11">
            <Link href="/partner/cafe">
              <Plus aria-hidden="true" />
              Request a new café
            </Link>
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Active cafés", count: activeCount, Icon: Store },
          {
            label: "Archived cafés",
            count: cafes.length - activeCount,
            Icon: Archive,
          },
          { label: "Awaiting review", count: pendingCount, Icon: Clock3 },
        ].map(({ label, count, Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 sm:p-4"
          >
            <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col-reverse">
              <dt className="text-xs leading-snug text-muted-foreground sm:text-sm">
                {label}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">{count}</dd>
            </div>
          </div>
        ))}
      </dl>

      <nav aria-label="Café views" className="flex flex-wrap gap-2">
        <Button asChild variant={currentTab === "directory" ? "secondary" : "outline"} className="min-h-11">
          <Link href={tabHref("directory")} aria-current={currentTab === "directory" ? "page" : undefined} scroll={false}>
            Directory
          </Link>
        </Button>
        <Button asChild variant={currentTab === "requests" ? "secondary" : "outline"} className="min-h-11">
          <Link href={tabHref("requests")} aria-current={currentTab === "requests" ? "page" : undefined} scroll={false}>
            Change requests
            <Badge variant="outline">{pendingCount} pending</Badge>
          </Link>
        </Button>
      </nav>

      {currentTab === "directory" && (
        <section
          aria-labelledby="cafe-directory-heading"
          className="rounded-2xl border bg-card"
        >
          <div className="space-y-4 border-b p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <h2 id="cafe-directory-heading" className="font-semibold">
                  Café directory
                </h2>
                <p role="status" className="mt-1 text-sm text-muted-foreground">
                  Showing {visibleCafes.length} of {cafes.length} cafés
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative min-w-0">
                <span className="sr-only">Search cafés</span>
                <Search
                  className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={searchInput}
                  placeholder="Search by name, address, or postal code"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  className="min-h-11 pl-9"
                  type="search"
                />
              </label>
              <select
                aria-label="Filter cafés by status"
                className={FILTER_CLASS}
                value={cafeStatus}
                onChange={(event) => setCafeStatus(event.currentTarget.value)}
              >
                <option value="all">All cafés</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {visibleCafes.length ? (
            <ul className="divide-y">
              {visibleCafes.map((cafe) => {
                const pendingRequest = pendingByCafe.get(cafe.id);
                return (
                  <li key={cafe.id} className={ROW_CLASS}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground sm:grid">
                        <Store className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                            {cafe.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={
                              cafe.active
                                ? "border-transparent bg-emerald-100 text-emerald-950"
                                : "text-muted-foreground"
                            }
                          >
                            {cafe.active ? "Active" : "Archived · history preserved"}
                          </Badge>
                        </div>
                        {(cafe.address || cafe.postcode) && (
                          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {[cafe.address, cafe.postcode]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </p>
                        )}
                        {pendingRequest && (
                          <Link
                            href={`/partner/cafe?id=${cafe.id}&change=${pendingRequest}`}
                            aria-label={`View pending request for ${cafe.name}`}
                            className="inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-amber-900 underline underline-offset-4"
                          >
                            <Clock3 className="size-3.5" aria-hidden="true" />
                            View pending request
                          </Link>
                        )}
                      </div>
                    </div>
                    <Button asChild variant="outline" className="min-h-11 shrink-0">
                      <Link
                        href={`/partner/cafe?id=${cafe.id}`}
                        aria-label={`Details & edit request for ${cafe.name}`}
                      >
                        Details &amp; edit request
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-3 p-5 text-sm sm:p-6">
              <p className="font-medium">
                {cafes.length ? "No cafés match these filters" : "No cafés to show"}
              </p>
              {cafes.length ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setSearch("");
                    setCafeStatus("all");
                    searchInput.current?.focus();
                  }}
                >
                  Clear café filters
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  {canAdd
                    ? "Use Request a new café to start a listing."
                    : "Ask your Owner to check which cafés you’re assigned to."}
                </p>
              )}
            </div>
          )}
        </section>

        )}
        {currentTab === "requests" && (
          <section
            id="cafe-change-requests"
            aria-labelledby="cafe-requests-heading"
            className="scroll-mt-4 rounded-2xl border bg-card"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <h2 id="cafe-requests-heading" className="font-semibold">
                  Change requests
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track reviews, resume drafts, and see feedback from Coffee Sphut.
                </p>
              </div>
            </div>
            <div className="space-y-3 border-b p-4 sm:p-5">
              <RequestQueueFilters
                location={queueLocation}
                query={queue.query}
                searchLabel="Search change requests"
                placeholder="Search by café or request reference"
                filterLabel="Filter change requests by status"
                options={[
                  { value: "all", label: "All requests" },
                  ...Object.entries(REQUEST_STATUSES).map(([value, { label }]) => ({ value, label })),
                ]}
              />
              <p className="text-sm text-muted-foreground" aria-live="polite">
                <RequestQueueCount queue={queue} />
              </p>
            </div>

            {notice && (
              <p role="status" className="border-b bg-primary/5 px-4 py-3 text-sm sm:px-5">
                {notice}
              </p>
            )}
            {requests.length > 0 && (
              <ul className="divide-y">
                {requests.map((request) => {
                  const status = REQUEST_STATUSES[request.status];
                  const action = status?.action ?? "View request";

                  return (
                    <li key={request.id} className={ROW_CLASS}>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                            {request.name}
                          </h3>
                          <Badge variant="outline" className={status?.className}>
                            {status?.label ?? request.status}
                          </Badge>
                        </div>
                        {request.dateLabel && (
                          <p className="text-sm text-muted-foreground">
                            {request.reviewed ? "Reviewed" : "Created"}{" "}
                            <time dateTime={request.date}>{request.dateLabel}</time>
                          </p>
                        )}
                        {request.reason && (
                          <div className="text-sm">
                            <p className="font-medium">Reviewer feedback</p>
                            <p className="text-muted-foreground [overflow-wrap:anywhere]">
                              {request.reason}
                            </p>
                          </div>
                        )}
                      </div>
                      {request.href ? (
                        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          <Button asChild variant="outline" className="min-h-11">
                            <Link
                              href={request.href}
                              prefetch={false}
                              aria-label={`${action}: ${request.name}`}
                            >
                              {action}
                              <ArrowRight aria-hidden="true" />
                            </Link>
                          </Button>
                          {request.removableStatus && (
                            <DiscardCafeChangeButton
                              id={request.id}
                              name={request.name}
                              status={request.removableStatus}
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Saved by a teammate
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {queue.total > queue.pageSize && (
              <div className="border-t p-4 sm:p-5">
                <RequestQueuePagination location={queueLocation} queue={queue} />
              </div>
            )}
          </section>
      )}
    </>
  );
}
