import Link from "next/link";
import Image from "next/image";
import { ImageUploader } from "./image-uploader";
import { type MediaSelection, EMPTY_MEDIA } from "@/lib/partner/media";
import { cleanupImageAction } from "@/app/partner/media-actions";
import { RecipeEditor } from "./recipe-editor";
import { randomUUID } from "node:crypto";
import { ActionForm } from "./action-form";
import type { PortalData } from "@/lib/partner/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
function Select({
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
function Records({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return rows.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((k) => (
            <TableHead key={k}>
              {(
                {
                  id: "Reference",
                  cafe_id: "Café",
                  cafe_name: "Café",
                  created_at: "Recorded",
                  occurred_at: "Redeemed",
                  low_stock: "Stock status",
                } as Record<string, string>
              )[k] || k.replaceAll("_", " ")}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={str(row.id) || i}>
            {columns.map((k) => (
              <TableCell
                key={k}
                className="max-w-72 whitespace-normal break-words"
              >
                {str(row[k])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <p className="py-6 text-sm text-muted-foreground">No records yet.</p>
  );
}
const cafeOptions = (d: PortalData) =>
  d.cafes.map((c) => ({ value: str(c.id), label: str(c.name) }));
export function Overview({ data }: { data: PortalData }) {
  const active = data.cafes.filter((c) => c.is_active === true).length;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Your plan", data.plan === "paid" ? "Paid · monthly" : "Free"],
          ["Accessible cafés", String(active)],
          ["Review process", "Coffee Sphut approval"],
        ].map(([label, value]) => (
          <Panel key={label} title={label}>
            <p className="font-serif text-3xl">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel title="A good day starts with your cafés">
        <p className="mb-6 max-w-2xl text-muted-foreground">
          Keep your café details fresh, follow reward activity, and stay on top
          of your stock. Submitted changes are published after Coffee Sphut
          review.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/partner/cafes">Manage cafés</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/partner/rewards">View reward activity</Link>
          </Button>
        </div>
      </Panel>
      {data.selection_required && (
        <Panel title="Choose your Free cafés">
          <p className="mb-4">
            An Owner must choose up to three active cafés before operational
            access begins.
          </p>
          <Button asChild>
            <Link href="/partner/billing">Choose cafés</Link>
          </Button>
        </Panel>
      )}
    </>
  );
}
export function Cafes({ data, q = "" }: { data: PortalData; q?: string }) {
  const rows = data.cafes.filter((c) =>
    str(c.name).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-2">
          <Field name="q" label="Search cafés" value={q} />
          <Button className="min-h-11" variant="outline">
            Search
          </Button>
        </form>
        {data.role !== "cafe_manager" && (
          <Button asChild>
            <Link href="/partner/cafe">Request a new café</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((c) => (
          <Panel key={str(c.id)} title={str(c.name)}>
            <p className="text-sm text-muted-foreground">{str(c.address)}</p>
            <p className="my-4 text-xs font-medium">
              {c.is_active ? "Active" : "Archived · history preserved"}
            </p>
            <Button asChild variant="outline">
              <Link href={`/partner/cafe?id=${c.id}`}>
                Details & edit request
              </Link>
            </Button>
          </Panel>
        ))}
      </div>
      {!rows.length && (
        <Panel title="No cafés to show">
          <p className="text-sm text-muted-foreground">
            Try another search, or ask your Owner to check assignments and
            subscription access.
          </p>
        </Panel>
      )}
      <Panel title="Your change requests">
        <Records
          rows={data.changes}
          columns={["status", "cafe_id", "reason", "created_at"]}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          {data.changes
            .filter((ch) => ["draft", "rejected"].includes(str(ch.status)))
            .map((ch) => (
              <Link
                key={str(ch.id)}
                className="text-sm underline"
                href={`/partner/cafe?${ch.cafe_id ? `id=${ch.cafe_id}&` : ""}change=${ch.id}`}
              >
                {ch.status === "draft"
                  ? "Resume draft"
                  : "Revise rejected request"}
                {": "}
                {str((ch.payload as Row)?.name) || "Café request"}
              </Link>
            ))}
        </div>
      </Panel>
    </>
  );
}
export function CafeEditor({ data }: { data: PortalData }) {
  const c = data.cafe || {};
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
          <Field
            name="rating"
            label="Rating (0–5)"
            type="number"
            value={c.rating}
          />
          <Field
            name="amenities"
            label="Amenities (comma separated)"
            value={Array.isArray(c.amenities) ? c.amenities.join(", ") : ""}
          />
        </div>
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
        <Field
          name="image_url"
          label="Cover image URL"
          type="url"
          value={c.image_url}
        />
        <Area
          name="gallery"
          label="Gallery image URLs"
          value={data.gallery?.join("\n")}
          help="One image URL per line. Remove a URL to detach that image after approval."
        />
        <ImageUploader
          cafeId={c.id ? Number(c.id) : undefined}
          initial={
            (data.changes[0]?.media as unknown as MediaSelection) || EMPTY_MEDIA
          }
        />
        <Area
          name="menu"
          label="Menu"
          value={data.menu
            .map(
              (m) =>
                `${m.name} | ${m.price} | ${m.currency} | ${m.description || ""}`,
            )
            .join("\n")}
          help="One item per line: Name | price in cents | CAD | description"
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
          Timezone: {data.timezone}. Workspace activated{" "}
          {data.coverage_at?.slice(0, 10)}. Earlier unattributed records are
          excluded. Refreshed {data.refreshed_at}.
        </p>
      </Panel>
      <Panel title="Redemption events">
        <Records
          rows={data.events}
          columns={["id", "cafe_name", "occurred_at", "status"]}
        />
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
export function Inventory({ data }: { data: PortalData }) {
  return (
    <>
      <Panel title="Stock by café">
        <p className="mb-4 text-sm text-muted-foreground">
          Each café has an independent balance. Counts record an adjustment;
          history is never rewritten.
        </p>
        <Records
          rows={data.items.map((i) => ({
            ...i,
            cafe_name:
              data.cafes.find((c) => String(c.id) === String(i.cafe_id))
                ?.name || "Café",
            low_stock:
              Number(i.balance) <= Number(i.threshold)
                ? "Low stock"
                : "Healthy",
          }))}
          columns={[
            "name",
            "cafe_name",
            "type",
            "unit",
            "balance",
            "threshold",
            "low_stock",
            "active",
          ]}
        />
      </Panel>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Add inventory item">
          <ActionForm
            operation="item"
            context={context(data)}
            label="Create item"
          >
            <Select name="cafe_id" label="Café" options={cafeOptions(data)} />
            <Field name="name" label="Item name" required />
            <Field name="code" label="Item code" required />
            <Select
              name="type"
              label="Item type"
              options={[
                { value: "ingredient", label: "Ingredient" },
                { value: "product", label: "Packaged product" },
              ]}
            />
            <Select
              name="unit"
              label="Base unit"
              options={[
                { value: "g", label: "Grams" },
                { value: "ml", label: "Millilitres" },
                { value: "each", label: "Each" },
              ]}
            />
            <Field
              name="threshold"
              label="Low-stock threshold"
              value="0"
              type="number"
            />
          </ActionForm>
        </Panel>
        <Panel title="Record stock movement">
          <ActionForm
            operation="movement"
            context={context(data)}
            label="Record movement"
          >
            <Select
              name="item_id"
              label="Item and café"
              options={data.items
                .filter((i) => i.active)
                .map((i) => ({
                  value: str(i.id),
                  label: `${i.name} · café ${i.cafe_id} · ${i.unit}`,
                }))}
            />
            <Select
              name="type"
              label="Movement type"
              options={[
                "receipt",
                "consumption",
                "wastage",
                "count",
                "correction",
                "opening",
              ].map((value) => ({
                value,
                label:
                  value === "count"
                    ? "Physical count (actual quantity)"
                    : value,
              }))}
            />
            <Field
              name="quantity"
              label="Quantity in base units"
              required
              type="number"
            />
            <Select
              name="direction"
              label="Correction direction"
              options={[
                { value: "add", label: "Add" },
                { value: "subtract", label: "Subtract" },
              ]}
            />
            <Field name="reason" label="Reason / reference" required />
          </ActionForm>
        </Panel>
      </div>
      <Panel title="Deactivate an item">
        <ActionForm
          operation="item"
          context={context(data, { active: false })}
          label="Deactivate item"
        >
          <Select name="cafe_id" label="Café" options={cafeOptions(data)} />
          <Select
            name="id"
            label="Item"
            options={data.items.map((i) => ({
              value: str(i.id),
              label: `${i.name} · ${data.cafes.find((c) => String(c.id) === String(i.cafe_id))?.name || "Café"}`,
            }))}
          />
        </ActionForm>
      </Panel>
      <Panel title="Movement history">
        <Records
          rows={data.movements.map((m) => ({
            ...m,
            item_name:
              data.items.find((i) => i.id === m.item_id)?.name ||
              "Retained item",
            cafe_name:
              data.cafes.find((c) => String(c.id) === String(m.cafe_id))
                ?.name || "Café",
          }))}
          columns={[
            "item_name",
            "cafe_name",
            "type",
            "quantity",
            "resulting_balance",
            "reason",
            "created_at",
          ]}
        />
      </Panel>
    </>
  );
}
export function Recipes({ data }: { data: PortalData }) {
  return (
    <>
      <Panel title="Shared chain recipes">
        <p className="mb-5 text-sm text-muted-foreground">
          Recipes describe ingredient quantities. Saving a recipe never deducts
          stock.
        </p>
        {!data.recipes.length && (
          <p className="text-sm text-muted-foreground">No recipes yet.</p>
        )}
        <div className="space-y-4">
          {data.recipes.map((r) => (
            <div key={str(r.id)} className="rounded-xl border p-4">
              <h3 className="font-serif text-xl">{str(r.name)}</h3>
              <p className="mt-2 text-sm">
                Yield {str(r.yield)} · {r.active ? "Active" : "Inactive"}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {(r.ingredients as Row[]).map((i, index) => (
                  <li key={index}>
                    {str(
                      data.ingredients.find((x) => x.id === i.item_id)?.name,
                    ) || "Retained ingredient"}{" "}
                    · {str(i.quantity)} {str(i.unit)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
      {data.role !== "cafe_manager" && (
        <Panel title="Create or revise a recipe">
          <RecipeEditor data={data} requestId={randomUUID()} />
        </Panel>
      )}
    </>
  );
}
export function Team({ data }: { data: PortalData }) {
  return (
    <>
      <Panel title="Partner team">
        <Records
          rows={data.members}
          columns={["email", "role", "revoked_at"]}
        />
      </Panel>
      <Panel title="Invite a manager">
        <ActionForm
          operation="invite"
          context={context(data)}
          label="Create invitation link"
        >
          <Field name="email" label="Manager email" type="email" required />
          <Select
            name="role"
            label="Role"
            options={[
              {
                value: "chain_manager",
                label: "Chain Manager · all accessible cafés",
              },
              { value: "cafe_manager", label: "Café Manager · selected cafés" },
            ]}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Assigned cafés for Café Managers
            </legend>
            {data.cafes.map((c) => (
              <label
                className="flex min-h-11 items-center gap-2"
                key={str(c.id)}
              >
                <input type="checkbox" name="cafe_ids" value={str(c.id)} />
                {str(c.name)}
              </label>
            ))}
          </fieldset>
        </ActionForm>
      </Panel>
      <Panel title="Revoke a manager">
        <ActionForm
          operation="revoke_member"
          context={context(data)}
          label="Revoke access"
        >
          <Select
            name="id"
            label="Manager"
            options={data.members
              .filter((m) => m.role !== "owner" && !m.revoked_at)
              .map((m) => ({ value: str(m.id), label: str(m.email) }))}
          />
        </ActionForm>
      </Panel>
      <Panel title="Invitations">
        <Records
          rows={data.invitations}
          columns={["email", "role", "expires_at", "accepted_at", "revoked_at"]}
        />
        <ActionForm
          operation="revoke_invite"
          context={context(data)}
          label="Revoke invitation"
        >
          <Select
            name="id"
            label="Invitation"
            options={data.invitations
              .filter((i) => !i.accepted_at && !i.revoked_at)
              .map((i) => ({ value: str(i.id), label: str(i.email) }))}
          />
        </ActionForm>
      </Panel>
    </>
  );
}
export function Billing({ data }: { data: PortalData }) {
  return (
    <>
      <Panel
        title={
          data.plan === "paid"
            ? "Paid · monthly per chain"
            : "Free · up to three active cafés"
        }
      >
        <p className="mb-5 text-sm text-muted-foreground">
          Both plans include café edit requests and reward reports. Paid adds
          unlimited active cafés, café inventory and shared recipes. Monthly
          price and checkout are awaiting Coffee Sphut billing setup.
        </p>
        <Button asChild variant="outline">
          <a href="mailto:info@coffeesphut.com?subject=Partner%20plan%20enquiry">
            Contact Coffee Sphut about your plan
          </a>
        </Button>
      </Panel>
      {data.role === "owner" && (
        <>
          <Panel title="Free café access selection">
            <p className="mb-4 text-sm text-muted-foreground">
              Choose up to three active cafés. Restricted records stay stored
              and their approved public listings remain visible. Inventory and
              recipes require Paid.
            </p>
            <ActionForm
              operation="select_cafes"
              context={context(data)}
              label="Save café selection"
            >
              {data.cafes.map((c) => (
                <label
                  key={str(c.id)}
                  className="flex min-h-11 items-center gap-2"
                >
                  <input type="checkbox" name="cafe_ids" value={str(c.id)} />
                  {str(c.name)} {c.is_active ? "" : "(archived)"}
                </label>
              ))}
            </ActionForm>
          </Panel>
          <Panel title="Reporting timezone">
            <ActionForm
              operation="settings"
              context={context(data)}
              label="Save timezone"
            >
              <Field
                name="timezone"
                label="IANA timezone"
                value={data.timezone}
                help="For example America/Regina or Europe/London."
                required
              />
            </ActionForm>
          </Panel>
        </>
      )}
    </>
  );
}
export function StaffReviews({ data }: { data: PortalData }) {
  return (
    <div className="space-y-6">
      <Panel title="Pending café reviews">
        <p className="mb-6 text-sm text-muted-foreground">
          Approve the complete request or reject it with a reason. Self-review
          and outdated baselines are blocked.
        </p>
        {!data.changes.length && <p>No requests awaiting review.</p>}
        <div className="space-y-6">
          {data.changes.map((ch) => (
            <section key={str(ch.id)} className="min-w-0 rounded-xl border p-4">
              <h3 className="mb-3 font-serif text-xl">
                {str(ch.cafe_name) || "New café request"}
              </h3>
              <p className="mb-4 break-all text-xs text-muted-foreground">
                Request {str(ch.id)} · submitted {str(ch.created_at)}
              </p>
              <Records
                rows={Object.entries((ch.payload || {}) as Row).map(
                  ([field, proposed]) => ({
                    field,
                    current: str((ch.current_values as Row | null)?.[field]),
                    proposed: str(proposed),
                  }),
                )}
                columns={["field", "current", "proposed"]}
              />
              <div className="my-4 flex flex-wrap gap-4">
                {(() => {
                  const media =
                    (ch.media as unknown as MediaSelection) || EMPTY_MEDIA;
                  return [
                    ...(media.cover
                      ? [{ id: media.cover, label: "Proposed cover" }]
                      : []),
                    ...media.gallery.map((id, i) => ({
                      id,
                      label: `Proposed gallery ${i + 1}`,
                    })),
                  ].map(({ id, label }) => (
                    <figure key={`${id}-${label}`}>
                      <Image
                        src={`/partner/media/${id}?review=1`}
                        alt={label}
                        width={240}
                        height={180}
                        unoptimized
                        className="h-45 w-60 max-w-full rounded-lg object-cover"
                      />
                      <figcaption className="mt-2 text-sm">{label}</figcaption>
                    </figure>
                  ));
                })()}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ActionForm
                  operation="review"
                  context={context(data, {
                    chain_id: ch.chain_id,
                    id: ch.id,
                    decision: "approve",
                  })}
                  label="Approve request"
                >
                  <p className="text-xs text-muted-foreground">
                    Approves publication of the images and café details. If an
                    image copy fails, retry approval; the current listing stays
                    unchanged.
                  </p>
                </ActionForm>
                <ActionForm
                  operation="review"
                  context={context(data, {
                    chain_id: ch.chain_id,
                    id: ch.id,
                    decision: "reject",
                  })}
                  label="Reject request"
                >
                  <Field name="reason" label="Rejection reason" required />
                </ActionForm>
              </div>
            </section>
          ))}
        </div>
      </Panel>
      {data.staff_admin && (
        <>
          <Panel title="Upload cleanup">
            <p className="mb-4 text-sm text-muted-foreground">
              Administrators can remove an unused upload by its ID. Draft,
              pending and live image references are protected. Failed cleanup
              remains available for retry.
            </p>
            <Records
              rows={data.media.map((m) => ({
                id: m.id,
                state: m.state,
                created_at: m.created_at,
                cleanup_error: m.cleanup_error,
              }))}
              columns={["id", "state", "created_at", "cleanup_error"]}
            />
            <ActionForm
              action={cleanupImageAction}
              label="Remove unused upload"
            >
              <Field name="id" label="Upload ID" required />
            </ActionForm>
          </Panel>
          <Panel title="Provision a partner Owner">
            <ActionForm
              operation="provision"
              context={context(data)}
              label="Provision partner"
            >
              <Field name="name" label="Chain name" required />
              <Field name="chain_id" label="Existing chain ID (optional)" />
              <Field
                name="owner_id"
                label="Existing authenticated Owner user ID"
                required
              />
            </ActionForm>
          </Panel>
          <Panel title="Authoritative plan activation">
            <p className="mb-4 text-sm text-muted-foreground">
              Internal admin only. Record the approved activation reference.
              This does not charge a payment method. Free transitions take
              effect immediately and require an explicit café selection;
              scheduled cancellation and payment grace await billing policy.
            </p>
            <ActionForm
              operation="activate_plan"
              context={context(data)}
              label="Record plan change"
            >
              <Select
                name="chain_id"
                label="Partner"
                options={data.accounts.map((a) => ({
                  value: str(a.chain_id),
                  label: `${a.name} · ${a.plan}`,
                }))}
              />
              <Select
                name="plan"
                label="Plan"
                options={[
                  { value: "paid", label: "Paid" },
                  { value: "free", label: "Free" },
                ]}
              />
              <Field
                name="reason"
                label="Approval / subscription event reference"
                required
              />
              <Field
                name="cafe_ids"
                label="For Free: selected café ID 1"
                type="number"
                help="Select the agreed cafés explicitly; automatic fallback is disabled."
              />
              <Field
                name="cafe_ids"
                label="For Free: selected café ID 2"
                type="number"
              />
              <Field
                name="cafe_ids"
                label="For Free: selected café ID 3"
                type="number"
              />
            </ActionForm>
          </Panel>
        </>
      )}
    </div>
  );
}
