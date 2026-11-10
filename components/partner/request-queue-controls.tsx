import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import type { RequestQueuePage, RequestQueueQuery } from "@/lib/partner/request-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartnerSelect } from "./partner-select";

interface QueueLocation {
  path: string;
  anchor?: string;
  directorySearch?: string;
  tab?: string;
}

function queueHref(
  { path, anchor = "", directorySearch, tab }: QueueLocation,
  query?: RequestQueueQuery,
  page = 1,
) {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (directorySearch) params.set("q", directorySearch);
  if (query?.search) params.set("request_q", query.search);
  if (query && query.filter !== "all") params.set("request_filter", query.filter);
  if (page > 1) params.set("request_page", String(page));
  return `${path}${params.size ? `?${params}` : ""}${anchor}`;
}

export function RequestQueueFilters({
  location,
  query,
  searchLabel,
  placeholder,
  filterLabel,
  options,
}: {
  location: QueueLocation;
  query: RequestQueueQuery;
  searchLabel: string;
  placeholder: string;
  filterLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Form
        action={location.path + (location.anchor || "")}
        key={JSON.stringify(query)}
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        {location.tab && <input type="hidden" name="tab" value={location.tab} />}
        {location.directorySearch && <input type="hidden" name="q" value={location.directorySearch} />}
        <label className="relative min-w-0">
          <span className="sr-only">{searchLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            name="request_q"
            type="search"
            className="min-h-11 pl-9"
            placeholder={placeholder}
            maxLength={150}
            defaultValue={query.search}
          />
        </label>
        <PartnerSelect
          name="request_filter"
          aria-label={filterLabel}
          defaultValue={query.filter}
        >
          {options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </PartnerSelect>
        <Button type="submit" variant="outline" className="min-h-11">Search requests</Button>
      </Form>
      {(query.search || query.filter !== "all") && (
        <Link className="inline-block py-1 text-sm font-medium text-primary underline underline-offset-4" href={queueHref(location)}>
          Clear request filters
        </Link>
      )}
    </div>
  );
}

export function RequestQueuePagination({
  location,
  queue,
}: {
  location: QueueLocation;
  queue: RequestQueuePage;
}) {
  const lastPage = Math.ceil(queue.total / queue.pageSize);
  if (lastPage < 2) return null;

  return (
    <nav aria-label="Request pages" className="flex flex-wrap items-center gap-3 text-sm">
      {queue.page > 1 && (
        <Button asChild variant="outline" className="min-h-11">
          <Link href={queueHref(location, queue.query, queue.page - 1)}>Previous page</Link>
        </Button>
      )}
      <span className="text-muted-foreground">Page {queue.page} of {lastPage}</span>
      {queue.page < lastPage && (
        <Button asChild variant="outline" className="min-h-11">
          <Link href={queueHref(location, queue.query, queue.page + 1)}>Next page</Link>
        </Button>
      )}
    </nav>
  );
}

export function RequestQueueCount({ queue }: { queue: RequestQueuePage }) {
  if (!queue.total)
    return queue.query.search || queue.query.filter !== "all"
      ? "No requests match these filters."
      : "No requests to show.";

  const start = (queue.page - 1) * queue.pageSize + 1;
  const end = Math.min(queue.total, start + queue.pageSize - 1);
  return `Showing ${start}–${end} of ${queue.total} ${queue.total === 1 ? "request" : "requests"}`;
}
