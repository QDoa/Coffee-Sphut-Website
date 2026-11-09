import { randomUUID } from "node:crypto";
import { cleanupImageAction } from "@/app/partner/media-actions";
import { EMPTY_MEDIA, type MediaSelection } from "@/lib/partner/media";
import type { PortalData } from "@/lib/partner/portal";
import type { RequestQueueQuery } from "@/lib/partner/request-queue";
import { ActionForm } from "./action-form";
import { Field } from "./workspace";
import { StaffPlanForm } from "./staff-plan-form";
import { cafeRequestFields, cafeRequestPhotos } from "@/lib/partner/reviews";
import { ReviewQueue, type ReviewRequest } from "./review-queue";

type Row = Record<string, unknown>;

const REVIEW_DATE = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function reviewRequest(change: Row, accounts: Map<string, string>): ReviewRequest {
  const payload = (change.payload || {}) as Row;
  const current = (change.current_values || {}) as Row;
  const media = (change.media as MediaSelection | null) || EMPTY_MEDIA;
  const id = String(change.id);
  const chainId = String(change.chain_id);
  const created = String(change.created_at);
  const kind = change.kind as ReviewRequest["kind"];
  return {
    id,
    name: String(change.cafe_name || payload.name || "Unnamed café"),
    chain: accounts.get(chainId) || "",
    kind,
    created,
    dateLabel: REVIEW_DATE.format(new Date(created)),
    fields: cafeRequestFields(payload, current, media, kind === "new"),
    photos: cafeRequestPhotos(media),
    approveContext: { chain_id: chainId, id, request_id: randomUUID(), decision: "approve" },
    rejectContext: { chain_id: chainId, id, request_id: randomUUID(), decision: "reject" },
  };
}

export function StaffReviews({ data, query, path }: {
  data: PortalData;
  query: RequestQueueQuery;
  path: string;
}) {
  const accounts = new Map(data.accounts.map((account) => [String(account.chain_id), String(account.name)]));
  return (
    <div className="space-y-8">
      <ReviewQueue
        requests={data.changes.map((change) => reviewRequest(change, accounts))}
        path={path}
        queue={{
          query,
          page: data.request_page,
          pageSize: data.request_page_size,
          total: data.request_total,
        }}
        showAdminTools={data.staff_admin}
      />
      {data.staff_admin && <ReviewAdminTools data={data} />}
    </div>
  );
}

function ReviewAdminTools({ data }: { data: PortalData }) {
  return (
    <section id="review-admin-tools" tabIndex={-1} aria-labelledby="review-admin-heading" className="scroll-mt-4 space-y-3">
      <div className="space-y-1">
        <h2 id="review-admin-heading" className="font-semibold">Administrator tools</h2>
        <p className="text-sm text-muted-foreground">Manage uploads, partner onboarding, and plan changes.</p>
      </div>
      <div className="divide-y rounded-2xl border bg-card">
        <details>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">
            Upload cleanup
          </summary>
          <div className="space-y-4 border-t p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              Remove an unused upload by ID. Uploads used by drafts, pending requests, or live listings are protected. Failed cleanup can be retried.
            </p>
            <ActionForm action={cleanupImageAction} label="Remove unused upload">
              <Field name="id" label="Upload ID" required />
            </ActionForm>
            {data.media.length > 0 && (
              <details className="rounded-xl border">
                <summary className="min-h-11 cursor-pointer p-3 text-sm font-medium">Recent uploads ({data.media.length})</summary>
                <ul className="max-h-80 divide-y overflow-y-auto border-t">
                  {data.media.map((upload) => (
                    <li key={String(upload.id)} className="space-y-1 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium capitalize">{String(upload.state)}</span>
                        <time dateTime={String(upload.created_at)} className="text-xs text-muted-foreground">
                          {REVIEW_DATE.format(new Date(String(upload.created_at)))} UTC
                        </time>
                      </div>
                      <code className="select-all text-xs [overflow-wrap:anywhere]">{String(upload.id)}</code>
                      {typeof upload.cleanup_error === "string" && upload.cleanup_error && (
                        <p className="text-xs text-destructive [overflow-wrap:anywhere]">{upload.cleanup_error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">
            Provision a partner Owner
          </summary>
          <div className="border-t p-4 sm:p-5">
            <ActionForm operation="provision" context={{ request_id: randomUUID() }} label="Provision partner">
              <Field name="name" label="Chain name" required />
              <Field name="chain_id" label="Existing chain ID (optional)" />
              <Field name="owner_id" label="Existing authenticated Owner user ID" required />
            </ActionForm>
          </div>
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">
            Record a plan change
          </summary>
          <div className="space-y-4 border-t p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              Record an approved activation or downgrade. Payment collection is
              handled separately. Free access changes take effect immediately.
              Choose which cafés keep workspace access or confirm an empty selection.
            </p>
            <StaffPlanForm
              requestId={randomUUID()}
              partners={data.accounts.map((account) => ({
                id: String(account.chain_id),
                label: `${account.name} · ${account.plan}`,
              }))}
            />
          </div>
        </details>
      </div>
    </section>
  );
}
