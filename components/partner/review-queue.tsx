"use client";

import { useActionState, useId, useState } from "react";
import Image from "next/image";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { commandAction, type PortalActionState } from "@/app/partner/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RequestQueuePage } from "@/lib/partner/request-queue";
import { RequestQueueCount, RequestQueueFilters, RequestQueuePagination } from "./request-queue-controls";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const REQUEST_TYPES = {
  new: { label: "New café", className: "bg-emerald-100 text-emerald-950" },
  edit: { label: "Listing edit", className: "bg-muted text-foreground" },
  removal: { label: "Removal", className: "bg-amber-100 text-amber-950" },
  reactivation: { label: "Reactivation", className: "bg-primary/10 text-primary" },
};

export interface ReviewField {
  key: string;
  label: string;
  current: string | null;
  proposed: string;
  changed: boolean;
}

export interface ReviewRequest {
  id: string;
  name: string;
  chain: string;
  kind: keyof typeof REQUEST_TYPES;
  created: string;
  dateLabel: string;
  fields: ReviewField[];
  photos: { id: string; label: string }[];
  approveContext: Record<string, string>;
  rejectContext: Record<string, string>;
}

export function ReviewQueue({
  requests,
  showAdminTools,
  path,
  queue,
}: {
  requests: ReviewRequest[];
  showAdminTools: boolean;
  path: string;
  queue: RequestQueuePage;
}) {
  const [expanded, setExpanded] = useState("");
  const [notice, setNotice] = useState("");
  const location = { path, anchor: "#staff-review-queue" };

  return (
    <div id="staff-review-queue" className="scroll-mt-4 space-y-4">
      <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold">Café review queue</h2>
              <p className="text-sm text-muted-foreground">
                Review proposed listing changes. Requests appear oldest first.
              </p>
            </div>
          </div>
          {showAdminTools && (
            <a href="#review-admin-tools" className="py-2 text-sm font-medium text-primary underline underline-offset-4">
              Jump to administrator tools
            </a>
          )}
        </div>
        <RequestQueueFilters
          location={location}
          query={queue.query}
          searchLabel="Search review requests"
          placeholder="Search by café, partner, or request reference"
          filterLabel="Filter by request type"
          options={[
            { value: "all", label: "All request types" },
            ...Object.entries(REQUEST_TYPES).map(([value, { label }]) => ({ value, label })),
          ]}
        />
        <div role="status" className="space-y-1 text-sm text-muted-foreground">
          {notice && <p className="font-medium text-primary">{notice}</p>}
          <p><RequestQueueCount queue={queue} /></p>
        </div>
      </div>

      {requests.map((request) => {
        const open = expanded === request.id;
        const type = REQUEST_TYPES[request.kind];
        return (
          <section
            key={request.id}
            aria-labelledby={`review-title-${request.id}`}
            className="min-w-0 rounded-2xl border bg-card"
          >
            <h3 id={`review-title-${request.id}`}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`review-body-${request.id}`}
                onClick={() => setExpanded(open ? "" : request.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl p-4 text-left hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring sm:px-5"
              >
                <span className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{request.name}</span>
                    <Badge variant="outline" className={type.className}>{type.label}</Badge>
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {request.chain && <span>{request.chain}</span>}
                    <time dateTime={request.created}>{request.dateLabel} UTC</time>
                  </span>
                </span>
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={`review-body-${request.id}`} hidden={!open}>
              {open && (
                <RequestDetails
                  request={request}
                  onReviewed={(message) => {
                    setNotice(message);
                    setExpanded("");
                  }}
                />
              )}
            </div>
          </section>
        );
      })}

      <RequestQueuePagination location={location} queue={queue} />
    </div>
  );
}

function RequestDetails({
  request,
  onReviewed,
}: {
  request: ReviewRequest;
  onReviewed: (message: string) => void;
}) {
  const changed = request.fields.filter((field) => field.changed);
  const unchanged = request.fields.filter((field) => !field.changed);
  return (
    <div className="space-y-5 border-t p-4 sm:p-5">
      {request.kind === "removal" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Approval removes this café from public listings and keeps its history in the workspace.
        </p>
      )}
      {request.kind === "reactivation" && (
        <p className="rounded-xl border bg-primary/5 p-3 text-sm">
          Approval makes this café active again.
        </p>
      )}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{request.kind === "new" ? "Proposed listing" : "Proposed changes"}</h4>
        {changed.length ? (
          <FieldList fields={changed} compare={request.kind !== "new"} />
        ) : (
          <p className="text-sm text-muted-foreground">No changed fields to compare.</p>
        )}
      </div>
      {unchanged.length > 0 && (
        <details className="rounded-xl border">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
            {request.kind === "new" ? "Empty fields" : "Unchanged fields"} ({unchanged.length})
          </summary>
          <div className="border-t p-3">
            <FieldList fields={unchanged} compare={false} />
          </div>
        </details>
      )}
      {request.photos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Uploaded photos</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {request.photos.map(({ id, label }) => {
              const src = `/partner/media/${id}?review=1`;
              return (
                <figure key={`${id}-${label}`} className="min-w-0">
                  <a href={src} target="_blank" rel="noreferrer">
                    <Image
                      src={src}
                      alt={label}
                      width={240}
                      height={180}
                      unoptimized
                      className="aspect-4/3 w-full rounded-lg bg-muted object-cover"
                    />
                  </a>
                  <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      )}
      <details>
        <summary className="min-h-11 w-fit cursor-pointer py-3 text-xs text-muted-foreground">Request reference</summary>
        <code className="select-all text-xs [overflow-wrap:anywhere]">{request.id}</code>
      </details>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <DecisionButton request={request} decision="approve" onReviewed={onReviewed} />
        <DecisionButton request={request} decision="reject" onReviewed={onReviewed} />
      </div>
    </div>
  );
}

function FieldList({ fields, compare }: { fields: ReviewField[]; compare: boolean }) {
  return (
    <dl className="divide-y rounded-xl border">
      {fields.map((field) => (
        <div key={field.key} className="grid min-w-0 gap-2 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <dt className="font-medium [overflow-wrap:anywhere]">{field.label}</dt>
          <dd className={`grid min-w-0 gap-2 ${compare ? "sm:grid-cols-2" : ""}`}>
            {compare && (
              <div className="min-w-0 rounded-lg bg-muted/45 p-2.5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Current</p>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.current ?? "Unavailable in this review"}</p>
              </div>
            )}
            <div className={compare ? "min-w-0 rounded-lg bg-primary/5 p-2.5" : "min-w-0"}>
              {compare && <p className="mb-1 text-xs font-medium text-primary">Proposed</p>}
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.proposed}</p>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DecisionButton({
  request,
  decision,
  onReviewed,
}: {
  request: ReviewRequest;
  decision: "approve" | "reject";
  onReviewed: (message: string) => void;
}) {
  const approving = decision === "approve";
  const label = approving ? "Approve request" : "Reject request";
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const [state, submit, pending] = useActionState<PortalActionState, FormData>(
    async (previous, form) => {
      const result = await commandAction(previous, form);
      if (result.message) onReviewed(`${approving ? "Approved" : "Rejected"} the request for ${request.name}.`);
      return result;
    },
    {},
  );
  return (
    <Dialog onOpenChange={(open) => { if (!open) setReason(""); }}>
      <DialogTrigger asChild>
        <Button variant={approving ? "default" : "outline"} className="min-h-11">{label}</Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onInteractOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{label}?</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {!approving
              ? `The partner will see your feedback on the request for ${request.name}.`
              : request.kind === "removal"
                ? `This removes ${request.name} from public listings and preserves its workspace history.`
                : `This publishes the proposed listing changes for ${request.name}.`}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} aria-busy={pending} className="space-y-4">
          <input type="hidden" name="operation" value="review" />
          <input type="hidden" name="context" value={JSON.stringify(approving ? request.approveContext : request.rejectContext)} />
          {!approving && (
            <div className="space-y-2">
              <label htmlFor={reasonId} className="text-sm font-medium">Rejection reason</label>
              <Textarea id={reasonId} name="reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} required rows={4} disabled={pending} />
            </div>
          )}
          {state.error && <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" variant={approving ? "default" : "destructive"} className="min-h-11" disabled={pending || (!approving && !reason.trim())}>
              {pending ? "Saving…" : label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
