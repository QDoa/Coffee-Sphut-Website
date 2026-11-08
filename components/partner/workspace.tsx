import Link from "next/link";
import { CafeDirectory } from "./cafe-directory";
import { ImageUploader } from "./image-uploader";
import { type MediaSelection, EMPTY_MEDIA } from "@/lib/partner/media";
import { CAFE_AMENITIES } from "@/lib/partner/amenities";
import { randomUUID } from "node:crypto";
import { ActionForm } from "./action-form";
import type { PortalData } from "@/lib/partner/portal";
import type { RequestQueueQuery } from "@/lib/partner/request-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
type Row = Record<string, unknown>;
const str = (x: unknown) =>
  x === null || x === undefined
    ? ""
    : typeof x === "object"
      ? JSON.stringify(x)
      : String(x);
const context = (data: PortalData, extra: Row = {}) => ({
  request_id: randomUUID(),
  chain_id: data.chain_id,
  ...extra,
});
export function Field({
  name,
  label,
  value = "",
  type = "text",
  required = false,
  help,
}: {
  name: string;
  label: string;
  value?: unknown;
  type?: string;
  required?: boolean;
  help?: string;
}) {
  const id = name + "-" + randomUUID();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        className="min-h-11"
        id={id}
        name={name}
        type={type}
        defaultValue={
          type === "time" && /^\d:\d{2}$/.test(str(value))
            ? `0${str(value)}`
            : str(value)
        }
        required={required}
        step={type === "number" ? "any" : undefined}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
function Area({
  name,
  label,
  value,
  help,
}: {
  name: string;
  label: string;
  value?: unknown;
  help?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={str(value)} rows={4} />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
export function Select({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value}
        className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
const cafeOptions = (d: PortalData) =>
  d.cafes.map((c) => ({ value: str(c.id), label: str(c.name) }));
export function removableCafeChange(
  change: Row | undefined,
  actor: string,
): "draft" | "pending" | undefined {
  if (!change || change.submitter !== actor) return;
  if (change.status === "draft") return "draft";
  const payload = change.payload as Row | null;
  if (
    change.status === "pending" &&
    change.cafe_id &&
    payload?.is_active === false
  )
    return "pending";
}

export function Cafes({
  data,
  q,
  removed,
  queueQuery,
}: {
  data: PortalData;
  q?: string;
  removed?: string;
  queueQuery: RequestQueueQuery;
}) {
  const initialSearch = typeof q === "string" ? q : "";
  const cafes = data.cafes.map((cafe) => ({
    id: str(cafe.id),
    name: str(cafe.name) || "Unnamed café",
    address: str(cafe.address),
    postcode: str(cafe.postcode),
    active: cafe.is_active === true,
  }));
  const cafeNames = new Map(cafes.map((cafe) => [cafe.id, cafe.name]));
  let dateFormat: Intl.DateTimeFormat;
  try {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeZone: data.timezone || "UTC",
    });
  } catch {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  }
  const requests = data.changes.map((change) => {
    const cafeId = str(change.cafe_id);
    const status = str(change.status);
    const date = str(change.reviewed_at || change.created_at);
    const payload = change.payload as Row | null;
    const query = new URLSearchParams({ change: str(change.id) });
    if (cafeId) query.set("id", cafeId);
    return {
      id: str(change.id),
      name: str(payload?.name) || cafeNames.get(cafeId) || "Café request",
      status,
      reason: status === "rejected" ? str(change.reason) : "",
      date,
      dateLabel: date ? dateFormat.format(new Date(date)) : "",
      reviewed: Boolean(change.reviewed_at),
      removableStatus: removableCafeChange(change, data.actor),
      href:
        status === "draft" && change.submitter !== data.actor
          ? ""
          : `/partner/cafe?${query}`,
    };
  });
  return (
    <CafeDirectory
      key={initialSearch}
      initialSearch={initialSearch}
      notice={
        removed === "draft"
          ? "Draft discarded."
          : removed === "pending"
            ? "Café removal request withdrawn."
            : undefined
      }
      cafes={cafes}
      requests={requests}
      pending={data.pending_requests}
      pendingCount={data.pending_request_count}
      queue={{
        query: queueQuery,
        total: data.request_total,
        page: data.request_page,
        pageSize: data.request_page_size,
      }}
      canAdd={data.role === "owner" || data.role === "chain_manager"}
    />
  );
}
export function CafeEditor({
  data,
  approvedAmenities,
}: {
  data: PortalData;
  approvedAmenities: unknown;
}) {
  const c = data.cafe || {};
  const selectedAmenities = Array.isArray(c.amenities) ? c.amenities : [];
  const liveAmenities = Array.isArray(approvedAmenities) ? approvedAmenities : [];
  const hasLegacyAmenities = liveAmenities.some(
    (value) => !CAFE_AMENITIES.some(({ id }) => id === value),
  );
  const hours = (c.time_open || {}) as Record<
    string,
    { open?: string; close?: string }
  >;
  const socials = Object.entries((c.social_media || {}) as Row)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  return (
    <Panel title={c.id ? `Edit ${c.name}` : "Request a new café"}>
      <p className="mb-6 text-sm text-muted-foreground">
        Approved information stays live while your changes are reviewed.
        Archival and reactivation also require approval. Chain transfers are
        handled by Coffee Sphut support.
      </p>
      <ActionForm
        operation="submit_change"
        context={context(data, {
          cafe_id: c.id,
          baseline: c.partner_revision,
          id:
            data.changes[0]?.status === "draft"
              ? data.changes[0].id
              : undefined,
        })}
        label="Submit for review"
        secondaryLabel="Save draft"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Café name" value={c.name} required />
          <Field name="address" label="Address" value={c.address} />
          <Field name="postcode" label="Postal code" value={c.postcode} />
          <Field name="phone_number" label="Phone" value={c.phone_number} />
          <Field name="email" label="Email" type="email" value={c.email} />
          <Field name="link" label="Website" type="url" value={c.link} />
          <Field
            name="latitude"
            label="Latitude"
            type="number"
            value={c.latitude}
          />
          <Field
            name="longitude"
            label="Longitude"
            type="number"
            value={c.longitude}
          />
        </div>
        <Area name="description" label="Description" value={c.description} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="reward_code"
            label="Private café reward code"
            value={c.reward_code}
          />
          <Field
            name="loyalty_threshold_override"
            label="Stamp threshold override"
            type="number"
            value={c.loyalty_threshold_override}
          />
        </div>
        <fieldset className="space-y-2 rounded-xl border p-4">
          <legend className="px-2 text-sm font-medium">Amenities</legend>
          <p className="text-sm text-muted-foreground">
            Select the amenities available at this café.
            {hasLegacyAmenities &&
              " Changing this selection replaces older amenity entries."}
          </p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {CAFE_AMENITIES.map(({ id, label }) => (
              <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
                {liveAmenities.includes(id) && (
                  <input type="hidden" name="approved_amenities" value={id} />
                )}
                <input
                  type="checkbox"
                  name="amenities"
                  value={id}
                  defaultChecked={selectedAmenities.includes(id)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-6">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={c.id ? Boolean(c.is_active) : true}
            />
            Active café
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="show_details"
              defaultChecked={Boolean(c.show_details)}
            />
            Show full public details
          </label>
        </div>
        <fieldset className="space-y-3 rounded-xl border p-4">
          <legend className="px-2 text-sm font-medium">Opening hours</legend>
          <input
            type="hidden"
            name="previous_hours"
            value={JSON.stringify(c.time_open ?? null)}
          />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="hours_update" defaultChecked={!c.id} />
            Use the schedule below for this request
          </label>
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((day) => (
            <div className="grid grid-cols-2 gap-3" key={day}>
              <Field
                name={`hours_${day}_open`}
                label={`${day} opens`}
                type="time"
                value={hours[day]?.open}
              />
              <Field
                name={`hours_${day}_close`}
                label={`${day} closes`}
                type="time"
                value={hours[day]?.close}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Leave both times blank for closed days.
          </p>
        </fieldset>
        <Area
          name="social_media"
          label="Social links"
          value={socials}
          help="One per line, for example Instagram=https://instagram.com/yourcafe"
        />
        <ImageUploader
          key={`${c.id ?? "new"}:${data.changes[0]?.id ?? "live"}`}
          cafeId={c.id ? Number(c.id) : undefined}
          initialCoverUrl={str(c.image_url)}
          initialGalleryUrls={data.gallery ?? []}
          initial={
            (data.changes[0]?.media as unknown as MediaSelection) || EMPTY_MEDIA
          }
        />
      </ActionForm>
    </Panel>
  );
}
export function Rewards({
  data,
  params,
}: {
  data: PortalData;
  params: Record<string, string | undefined>;
}) {
  const offset = Number(params.offset || 0);
  const dateOptions = { dateStyle: "medium", timeStyle: "short" } as const;
  let dateFormat: Intl.DateTimeFormat;
  try {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      ...dateOptions,
      timeZone: data.timezone || "UTC",
    });
  } catch {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      ...dateOptions,
      timeZone: "UTC",
    });
  }
  function formatTime(value: unknown): string {
    const date = new Date(str(value));
    return Number.isNaN(date.getTime())
      ? "Time unavailable"
      : dateFormat.format(date);
  }
  return (
    <>
      <Panel title="Reward usage">
        <form className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            name="cafe_id"
            label="Café"
            value={params.cafe_id}
            options={[
              { value: "", label: "All accessible cafés" },
              ...cafeOptions(data),
            ]}
          />
          <Field name="from" label="From" type="date" value={params.from} />
          <Field name="to" label="Through" type="date" value={params.to} />
          <Button className="min-h-11">Apply filters</Button>
        </form>
        <p className="mt-6 font-serif text-4xl">
          {data.total || 0}{" "}
          <span className="font-sans text-sm text-muted-foreground">
            completed redemptions
          </span>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Workspace activated {data.coverage_at?.slice(0, 10)}. Earlier
          unattributed records are excluded.
          {data.refreshed_at && <> Refreshed {formatTime(data.refreshed_at)}.</>}
        </p>
      </Panel>
      <Panel title="Redemption events">
        <p className="text-sm text-muted-foreground">
          Times shown in{" "}
          {dateFormat.resolvedOptions().timeZone.replaceAll("_", " ")}.
        </p>
        {data.events.length ? (
          <ul role="list" aria-label="Redemption events" className="mt-2 divide-y">
            {data.events.map((event) => {
              const reference = str(event.id);
              return (
                <li key={reference} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 space-y-1">
                      <p className="break-words font-medium">
                        {str(event.cafe_name) || "Café"}
                      </p>
                      <time
                        dateTime={str(event.occurred_at) || undefined}
                        className="block text-sm text-muted-foreground"
                      >
                        {formatTime(event.occurred_at)}
                      </time>
                    </div>
                    <Badge variant="secondary">Redeemed</Badge>
                  </div>
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="min-h-11 w-fit cursor-pointer rounded-sm py-3 focus-visible:ring-2 focus-visible:ring-ring">
                      Reference{" "}
                      <span className="font-mono">{reference.slice(0, 8)}</span>
                    </summary>
                    <code className="block select-all break-all rounded-md bg-muted px-3 py-2 text-foreground">
                      {reference}
                    </code>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            No redemptions match these filters.
          </p>
        )}
        <div className="mt-4 flex gap-3">
          {offset > 0 && (
            <Link
              className="underline"
              href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v) as [string, string][]), offset: String(Math.max(0, offset - 50)) })}`}
            >
              Previous
            </Link>
          )}
          {offset + 50 < (data.total || 0) && (
            <Link
              className="underline"
              href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v) as [string, string][]), offset: String(offset + 50) })}`}
            >
              Next
            </Link>
          )}
        </div>
      </Panel>
    </>
  );
}
