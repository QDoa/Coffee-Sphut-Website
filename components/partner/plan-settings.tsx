import { randomUUID } from "node:crypto";
import { Check, Clock3, CreditCard, Mail, Store } from "lucide-react";
import type { PortalData } from "@/lib/partner/portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionForm } from "./action-form";
import { CafeAccessForm } from "./cafe-access-form";

const FEATURES = [
  { name: "Café listings and edit requests", free: "Included", paid: "Included" },
  { name: "Reward reports", free: "Included", paid: "Included" },
  { name: "Active cafés in your workspace", free: "Up to 3", paid: "Unlimited" },
  { name: "Inventory and shared recipes", free: "Paid only", paid: "Included" },
];

function FeatureValue({ value }: { value: string }) {
  return value === "Included" ? (
    <span className="inline-flex items-center gap-1.5">
      <Check className="hidden size-4 shrink-0 text-emerald-700 sm:block" aria-hidden="true" />
      Included
    </span>
  ) : value;
}

export function PlanSettings({
  data,
  selectionCafes,
}: {
  data: PortalData;
  selectionCafes?: PortalData["cafes"];
}) {
  const paid = data.plan === "paid";
  const owner = data.role === "owner";
  const timezone = data.timezone || "UTC";
  const savedIds = data.cafes.map((cafe) => String(cafe.id));
  const cafes = selectionCafes?.filter((cafe) => typeof cafe.is_active === "boolean")
    .map((cafe) => ({ id: String(cafe.id), name: String(cafe.name), active: cafe.is_active === true }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Review your plan, café access, and the timezone used in reports.
      </p>
      <section aria-labelledby="current-plan-heading" className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="current-plan-heading" className="text-lg font-semibold">{paid ? "Paid plan" : "Free plan"}</h2>
                <Badge variant="secondary">Current plan</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {paid
                  ? "Monthly per chain, with unlimited active cafés, inventory, and recipes."
                  : "Manage up to three active cafés and view reward reports."}
              </p>
            </div>
          </div>
          {owner && (
            <Button asChild variant="outline" className="min-h-11">
              <a href="mailto:info@coffeesphut.com?subject=Partner%20plan%20enquiry">
                <Mail aria-hidden="true" />
                {paid ? "Contact plan support" : "Ask about upgrading"}
              </a>
            </Button>
          )}
        </div>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-6">
          {owner
            ? "Coffee Sphut handles pricing and plan changes. Contact us to discuss your options."
            : "Your workspace Owner manages plan changes and settings."}
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section aria-labelledby="compare-plans-heading" className="min-w-0 rounded-2xl border bg-card">
          <div className="p-4 sm:p-5">
            <h2 id="compare-plans-heading" className="font-semibold">Compare plans</h2>
          </div>
          <table aria-labelledby="compare-plans-heading" className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="border-y bg-muted/30">
              <tr>
                <th scope="col" className="w-[46%] p-2.5 font-medium sm:w-[52%] sm:px-5">Feature</th>
                <th scope="col" className="p-2.5 font-medium sm:px-4">Free</th>
                <th scope="col" className="p-2.5 font-medium sm:px-4">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FEATURES.map(({ name, free, paid }) => (
                <tr key={name}>
                  <th scope="row" className="p-2.5 font-medium sm:px-5">{name}</th>
                  <td className="p-2.5 text-muted-foreground sm:px-4"><FeatureValue value={free} /></td>
                  <td className="p-2.5 text-muted-foreground sm:px-4"><FeatureValue value={paid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="reporting-timezone-heading" className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <h2 id="reporting-timezone-heading" className="font-semibold">Reporting timezone</h2>
              <p className="text-sm text-muted-foreground">
                Sets when a day or week starts in your reward reports.
              </p>
            </div>
          </div>
          {owner ? (
            <ActionForm
              operation="settings"
              context={{ request_id: randomUUID() }}
              label="Save timezone"
            >
              <div className="space-y-2">
                <label htmlFor="reporting-timezone" className="text-sm font-medium">Timezone</label>
                <Input
                  id="reporting-timezone"
                  name="timezone"
                  list="reporting-timezones"
                  defaultValue={timezone}
                  aria-describedby="reporting-timezone-help"
                  className="min-h-11"
                  required
                />
                <datalist id="reporting-timezones">
                  {[...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")])].map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <p id="reporting-timezone-help" className="text-xs text-muted-foreground">
                  Start typing a city or region, such as America/Regina.
                </p>
              </div>
            </ActionForm>
          ) : (
            <p className="rounded-xl border bg-background p-3 text-sm font-medium [overflow-wrap:anywhere]">{timezone}</p>
          )}
        </section>
      </div>

      {owner && !paid && (
        <section aria-labelledby="cafe-access-heading" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <h2 id="cafe-access-heading" className="font-semibold">Café access on Free</h2>
              <p className="text-sm text-muted-foreground">
                Choose which cafés your team can manage. Approved public listings stay visible when workspace access is removed.
              </p>
            </div>
          </div>
          {data.selection_required && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Select up to three active cafés to finish setting up your workspace.
            </p>
          )}
          {cafes ? (
            <CafeAccessForm
              cafes={cafes}
              savedIds={savedIds}
              requestId={randomUUID()}
              selectionRequired={Boolean(data.selection_required)}
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Café choices could not be loaded. Refresh the page to try again.
            </p>
          )}
        </section>
      )}
    </>
  );
}
