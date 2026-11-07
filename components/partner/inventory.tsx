"use client";
import { useId, useState, useRef, type ChangeEvent } from "react";
import {
  Plus,
  ArrowDownUp,
  Search,
  TriangleAlert,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import type { PortalData } from "@/lib/partner/portal";
import { stockView, amount, type Row } from "@/lib/partner/stock";
import { ActionForm } from "./action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const movementTypes = {
  receipt: {
    label: "Stock received",
    help: "Add stock that arrived in a delivery.",
    quantityLabel: "Quantity received",
  },
  consumption: {
    label: "Stock used",
    help: "Subtract stock that was used or sold.",
    quantityLabel: "Quantity used",
  },
  wastage: {
    label: "Stock wasted",
    help: "Subtract stock that was spoiled, damaged, or discarded.",
    quantityLabel: "Quantity wasted",
  },
  count: {
    label: "Stock count",
    help: "Set the balance to the total you counted on hand.",
    quantityLabel: "Total counted",
  },
  correction: {
    label: "Manual adjustment",
    help: "Correct the balance by adding or subtracting a specific quantity.",
    quantityLabel: "Quantity to adjust",
  },
  opening: {
    label: "Starting stock",
    help: "Add the stock already on hand when you start tracking this item.",
    quantityLabel: "Starting quantity",
  },
} as const;

type MovementType = keyof typeof movementTypes;

const movementOptions = Object.entries(movementTypes).map(
  ([value, { label }]) => ({ value, label }),
);

function movementLabel(value: unknown): string {
  return (
    movementTypes[String(value) as MovementType]?.label ?? "Stock movement"
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  value?: string;
  min?: number;
  step?: number;
  options?: { value: string; label: string }[];
  onChange?: (value: string) => void;
  describedBy?: string;
  suffix?: string;
}
function Field({
  name,
  label,
  type = "text",
  value,
  min,
  step,
  options,
  onChange,
  describedBy,
  suffix,
}: FieldProps) {
  const id = useId();
  const valueProps = onChange
    ? {
        value: value ?? "",
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
          onChange(event.currentTarget.value),
      }
    : { defaultValue: value };
  return (
    <div className="space-y-2 text-sm font-medium">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {options ? (
        <select
          id={id}
          name={name}
          {...valueProps}
          aria-describedby={describedBy}
          required
          className="min-h-11 w-full rounded-xl border bg-card px-3"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <Input
            id={id}
            name={name}
            type={type}
            min={min}
            step={step ?? (type === "number" ? "any" : undefined)}
            {...valueProps}
            aria-describedby={suffix ? `${id}-unit` : describedBy}
            required
            className={suffix ? "min-h-11 pr-16" : "min-h-11"}
          />
          {suffix && (
            <span
              id={`${id}-unit`}
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
            >
              {suffix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StockMovementFields({
  items,
  initialItemId,
  cafeName,
}: {
  items: PortalData["items"];
  initialItemId?: string;
  cafeName: (id: unknown) => string;
}) {
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const [type, setType] = useState<MovementType>("receipt");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState("add");
  const activeItems = items.filter((item) => item.active);
  const item = activeItems.find((item) => item.id === itemId) ?? activeItems[0];
  const unit = item ? String(item.unit) : undefined;
  const balance = Number(item?.balance);
  const entered = Number(quantity);
  const minimum = type === "count" ? 0 : 0.000001;
  const validQuantity =
    quantity !== "" &&
    Number.isFinite(entered) &&
    entered >= minimum &&
    Number(entered.toFixed(6)) === entered;
  const subtract =
    type === "consumption" ||
    type === "wastage" ||
    (type === "correction" && direction === "subtract");
  const projected =
    type === "count" ? entered : balance + (subtract ? -entered : entered);
  const newBalance =
    item && validQuantity ? Number(projected.toFixed(6)) : null;

  return (
    <>
      <Field
        name="item_id"
        label="Item and café"
        value={String(item?.id ?? "")}
        onChange={setItemId}
        options={activeItems.map((entry) => ({
          value: String(entry.id),
          label: `${entry.name} · ${cafeName(entry.cafe_id)} · ${entry.unit}`,
        }))}
      />
      <Field
        name="type"
        label="What happened?"
        value={type}
        options={movementOptions}
        onChange={(value) => {
          setType(value as MovementType);
          setDirection("add");
        }}
        describedBy="stock-movement-help"
      />
      <p id="stock-movement-help" className="text-sm text-muted-foreground">
        {movementTypes[type].help}
      </p>
      <Field
        name="quantity"
        label={movementTypes[type].quantityLabel}
        type="number"
        value={quantity}
        min={minimum}
        step={0.000001}
        suffix={unit}
        onChange={setQuantity}
      />
      {type === "correction" && (
        <Field
          name="direction"
          label="Adjust the balance"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "add", label: "Add to stock" },
            { value: "subtract", label: "Subtract from stock" },
          ]}
        />
      )}
      {item && (
        <div className="space-y-2 rounded-xl border bg-muted/35 p-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Current balance</dt>
              <dd className="break-words font-medium tabular-nums">
                {amount(balance)} {unit}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">New balance (preview)</dt>
              <dd
                aria-live="polite"
                className="break-words font-semibold tabular-nums"
              >
                {newBalance === null ? "—" : `${amount(newBalance)} ${unit}`}
              </dd>
            </div>
          </dl>
          {newBalance !== null && newBalance < 0 && (
            <p className="text-sm text-destructive" role="status">
              This would take stock below zero. Enter a smaller quantity.
            </p>
          )}
        </div>
      )}
      <Field name="reason" label="Reason / reference" />
    </>
  );
}

export function Inventory({ data }: { data: PortalData }) {
  const [search, setSearch] = useState(""),
    [cafe, setCafe] = useState(""),
    [filter, setFilter] = useState("all");
  const [drawer, setDrawer] = useState<{
    kind: "add" | "movement" | "manage";
    id?: string;
    request_id: string;
    thresholdRequestId?: string;
  } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = (kind: "add" | "movement" | "manage", id?: string) => {
    if (!drawer) opener.current = document.activeElement as HTMLElement | null;
    setDrawer({
      kind,
      id,
      request_id: crypto.randomUUID(),
      ...(kind === "manage" && { thresholdRequestId: crypto.randomUUID() }),
    });
  };
  const rows = data.items.map(
    (item) =>
      ({ ...item, ...stockView(item, data.stock_rates) }) as Row &
        ReturnType<typeof stockView>,
  );
  const scoped = rows.filter((i) => !cafe || String(i.cafe_id) === cafe);
  const active = scoped.filter((i) => i.active);
  const alerts = active
    .filter((i) => i.attention)
    .sort((a, b) =>
      a.balance === 0
        ? -1
        : b.balance === 0
          ? 1
          : (a.days ?? Infinity) - (b.days ?? Infinity),
    );
  const visible = scoped.filter(
    (i) =>
      `${i.name} ${i.code}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "inactive"
        ? !i.active
        : filter === "attention"
          ? i.attention
          : filter === "out"
            ? i.active && i.balance === 0
            : Boolean(i.active)),
  );
  const selected = data.items.find((i) => i.id === drawer?.id);
  const cafeName = (id: unknown) =>
    String(data.cafes.find((c) => String(c.id) === String(id))?.name || "Café");
  const movements = data.movements.filter(
    (m) => !cafe || String(m.cafe_id) === cafe,
  );
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          A clear view of every café’s supplies. Record deliveries, track usage,
          and plan your next restock.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => open("movement")}
            disabled={!rows.some((i) => i.active)}
          >
            <ArrowDownUp className="size-4" />
            Record movement
          </Button>
          <Button onClick={() => open("add")}>
            <Plus className="size-4" />
            Add item
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active items",
            value: active.length,
            detail: "At the selected cafés",
            Icon: Package,
          },
          {
            label: "Needs attention",
            value: alerts.length,
            detail: "Below threshold or ≤ 7 days left",
            Icon: TriangleAlert,
          },
          {
            label: "Out of stock",
            value: active.filter((i) => i.balance === 0).length,
            detail: "Restock these items first",
            Icon: Package,
          },
          {
            label: "Runway available",
            value: active.filter((i) => i.days !== null).length,
            detail: "Items with recorded usage history",
            Icon: ArrowDownUp,
          },
        ].map(({ label, value, detail, Icon }) => (
          <div key={label} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {label}
              <Icon className="size-4" />
            </div>
            <p className="my-3 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <Tabs defaultValue="stock">
            <div className="space-y-5 border-b p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">All inventory</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {visible.length} items shown · balances kept separately for
                    each café
                  </p>
                </div>
                <TabsList>
                  <TabsTrigger value="stock">Stock levels</TabsTrigger>
                  <TabsTrigger value="history">Activity</TabsTrigger>
                </TabsList>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="relative min-w-0 flex-1 basis-48">
                  <span className="sr-only">Search inventory</span>
                  <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
                  <Input
                    className="min-h-11 pl-9"
                    placeholder="Search items or codes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="min-w-0 flex-1 basis-40">
                  <span className="sr-only">Filter by café</span>
                  <select
                    className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
                    value={cafe}
                    onChange={(e) => setCafe(e.target.value)}
                  >
                    <option value="">All cafés</option>
                    {data.cafes.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {String(c.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 flex-1 basis-36">
                  <span className="sr-only">Filter stock status</span>
                  <select
                    className="min-h-11 w-full rounded-xl border bg-card px-3 text-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      ["all", "All active items"],
                      ["attention", "Needs attention"],
                      ["out", "Out of stock"],
                      ["inactive", "Inactive items"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <TabsContent value="stock" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Item / café</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Stock status</TableHead>
                    <TableHead>Estimated runway</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((i) => (
                    <TableRow key={String(i.id)}>
                      <TableCell className="min-w-44 py-5 pl-5">
                        <p className="font-medium">{String(i.name)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cafeName(i.cafe_id)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {String(i.code)} ·{" "}
                          {i.type === "ingredient"
                            ? "Ingredient"
                            : "Packaged product"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-28">
                        <p className="font-medium tabular-nums">
                          {amount(i.balance)}{" "}
                          <span className="text-xs font-normal">
                            {String(i.unit)}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Alert at {amount(i.threshold)} {String(i.unit)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${i.status === "Out of stock" ? "bg-red-50 text-red-800" : i.attention ? "bg-amber-50 text-amber-900" : "bg-muted text-foreground"}`}
                        >
                          {i.status}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-44">
                        <p className="text-sm font-medium">{i.runway}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {i.daily !== null && i.daily > 0
                            ? `${amount(i.daily)} ${i.unit} / day`
                            : "Record consumption to improve estimates"}
                        </p>
                        {i.days !== null && (
                          <div
                            aria-hidden="true"
                            className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className={`h-full rounded-full ${i.attention ? "bg-amber-500" : "bg-emerald-600"}`}
                              style={{
                                width: `${Math.min(100, (i.days / 14) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => open("manage", String(i.id))}
                          aria-label={`Manage ${i.name}`}
                        >
                          <SlidersHorizontal className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!visible.length && (
                <div className="space-y-2 p-10 text-center">
                  <Package className="mx-auto size-7 text-muted-foreground" />
                  <p className="font-medium">No items match this view</p>
                  <p className="text-sm text-muted-foreground">
                    Try another search or filter, or add your first item.
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="history" className="m-0 p-5">
              <p className="mb-4 text-xs text-muted-foreground">
                Latest recorded movements (up to 100). Corrections preserve the
                original history.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Item",
                      "Movement",
                      "Change",
                      "Balance after",
                      "Reason",
                      "Recorded",
                    ].map((x) => (
                      <TableHead key={x}>{x}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={String(m.id)}>
                      <TableCell>
                        {String(
                          data.items.find((i) => i.id === m.item_id)?.name ||
                            "Retained item",
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {cafeName(m.cafe_id)}
                        </span>
                      </TableCell>
                      <TableCell>{movementLabel(m.type)}</TableCell>
                      <TableCell>{amount(m.quantity)}</TableCell>
                      <TableCell>{amount(m.resulting_balance)}</TableCell>
                      <TableCell className="min-w-40 whitespace-normal">
                        {String(m.reason)}
                      </TableCell>
                      <TableCell>
                        {new Date(String(m.created_at)).toLocaleString("en", {
                          timeZone: data.timezone,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!movements.length && (
                <p className="py-6 text-sm text-muted-foreground">
                  No stock movements recorded yet.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </section>
        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-medium">
              <TriangleAlert className="size-4 text-amber-600" />
              Stock alerts
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Restock priorities at your current usage
            </p>
            <div className="mt-3 divide-y">
              {alerts.slice(0, 5).map((i) => (
                <button
                  key={String(i.id)}
                  onClick={() => open("movement", String(i.id))}
                  className="block w-full space-y-1 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-sm font-medium">
                    {String(i.name)}{" "}
                    <span className="float-right text-xs text-primary">
                      Restock →
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {cafeName(i.cafe_id)}
                  </span>
                  <span className="block text-xs text-amber-900">
                    {amount(i.balance)} {String(i.unit)} · {i.runway}
                  </span>
                </button>
              ))}
              {!alerts.length && (
                <p className="py-6 text-sm text-muted-foreground">
                  Your active stock is above alert levels.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-medium">Recent activity</h2>
            <div className="mt-2 divide-y">
              {movements.slice(0, 5).map((m) => (
                <div key={String(m.id)} className="py-3">
                  <p className="text-sm">
                    {String(
                      data.items.find((i) => i.id === m.item_id)?.name ||
                        "Item",
                    )}{" "}
                    <span className="font-medium tabular-nums">
                      {Number(m.quantity) > 0 ? "+" : ""}
                      {amount(m.quantity)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {movementLabel(m.type)} · {cafeName(m.cafe_id)}
                  </p>
                </div>
              ))}
              {!movements.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  Your next stock movement will appear here.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
      <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
        Runway = current balance ÷ average daily usage (stock used and wasted),
        measured over up to 28 days since the first recorded movement. At least
        24 hours of history is needed. The runway bar represents up to 14 days.
        Forecasts assume consistent usage and complete records.
      </p>
      <Sheet
        open={Boolean(drawer)}
        onOpenChange={(value) => {
          if (!value) setDrawer(null);
        }}
      >
        <SheetContent
          className="overflow-y-auto sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>
              {drawer?.kind === "add"
                ? "Add inventory item"
                : drawer?.kind === "manage"
                  ? `Manage ${selected?.name || "item"}`
                  : "Record stock movement"}
            </SheetTitle>
            <SheetDescription>
              {drawer?.kind === "add"
                ? "Set an opening balance with a movement after adding the item."
                : "Keep each café’s stock and movement history accurate."}
            </SheetDescription>
          </SheetHeader>
          {drawer?.kind === "manage" && selected && (
            <ActionForm
              key={drawer.thresholdRequestId}
              operation="item"
              context={{
                request_id: drawer.thresholdRequestId,
                id: selected.id,
                cafe_id: selected.cafe_id,
              }}
              label="Save threshold"
            >
              <Field
                name="threshold"
                label={`Low-stock threshold (${selected.unit})`}
                type="number"
                value={String(selected.threshold)}
                min={0}
                step={0.000001}
              />
              <p className="text-sm text-muted-foreground">
                Stock is flagged as low at or below this amount.
              </p>
            </ActionForm>
          )}
          {drawer && (
            <ActionForm
              key={drawer.request_id}
              operation={drawer.kind === "movement" ? "movement" : "item"}
              context={{
                chain_id: data.chain_id,
                request_id: drawer.request_id,
                ...(drawer.kind === "manage"
                  ? {
                      id: drawer.id,
                      cafe_id: selected?.cafe_id,
                      active: !selected?.active,
                    }
                  : {}),
              }}
              label={
                drawer.kind === "add"
                  ? "Create item"
                  : drawer.kind === "movement"
                    ? "Record movement"
                    : selected?.active
                      ? "Deactivate item"
                      : "Reactivate item"
              }
            >
              {drawer.kind === "add" ? (
                <>
                  <Field
                    name="cafe_id"
                    label="Café"
                    options={data.cafes.map((c) => ({
                      value: String(c.id),
                      label: String(c.name),
                    }))}
                  />
                  <Field name="name" label="Item name" />
                  <Field name="code" label="Item code" />
                  <Field
                    name="type"
                    label="Item type"
                    options={[
                      { value: "ingredient", label: "Ingredient" },
                      { value: "product", label: "Packaged product" },
                    ]}
                  />
                  <Field
                    name="unit"
                    label="Base unit"
                    options={["g", "ml", "each"].map((value) => ({
                      value,
                      label:
                        value === "g"
                          ? "Grams"
                          : value === "ml"
                            ? "Millilitres"
                            : "Each",
                    }))}
                  />
                  <Field
                    name="threshold"
                    label="Low-stock threshold"
                    type="number"
                    value="0"
                  />
                </>
              ) : drawer.kind === "movement" ? (
                <StockMovementFields
                  items={data.items}
                  initialItemId={drawer.id}
                  cafeName={cafeName}
                />
              ) : (
                <>
                  <p className="text-sm">
                    {cafeName(selected?.cafe_id)} · {amount(selected?.balance)}{" "}
                    {String(selected?.unit)} remaining
                  </p>
                  {selected?.active && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => open("movement", String(selected.id))}
                    >
                      Record delivery or usage
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {selected?.active
                      ? "Deactivating hides this item from active stock. Its balance and history are retained."
                      : "Reactivate this item to record new movements."}
                  </p>
                </>
              )}
            </ActionForm>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
