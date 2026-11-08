export interface RequestQueueQuery {
  search: string;
  filter: string;
  page: number;
}

const PARTNER_FILTERS = ["draft", "pending", "approved", "rejected"];
const STAFF_FILTERS = ["new", "edit", "removal", "reactivation"];

export function requestQueueQuery(input: unknown, staff = false): RequestQueueQuery {
  const query = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const search = typeof query.request_q === "string" ? query.request_q.trim().slice(0, 150) : "";
  const filters = staff ? STAFF_FILTERS : PARTNER_FILTERS;
  const filter = typeof query.request_filter === "string" && filters.includes(query.request_filter)
    ? query.request_filter : "all";
  const rawPage = typeof query.request_page === "string" && /^\d+$/.test(query.request_page)
    ? Number(query.request_page) : 1;
  return { search, filter, page: Math.min(2_147_483_647, Math.max(1, rawPage)) };
}

export interface RequestQueuePage {
  query: RequestQueueQuery;
  page: number;
  total: number;
  pageSize: number;
}
