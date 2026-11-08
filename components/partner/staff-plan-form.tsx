"use client";

import { useEffect, useId, useState } from "react";
import { getPlanCafes } from "@/app/partner/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionForm } from "./action-form";

const SELECT_CLASS = "min-h-11 w-full rounded-lg border bg-background px-3 text-sm";

interface StaffPlanFormProps {
  partners: { id: string; label: string }[];
  requestId: string;
}

type CafeResult = Awaited<ReturnType<typeof getPlanCafes>>;

export function StaffPlanForm({ partners, requestId }: StaffPlanFormProps) {
  const formId = useId();
  const [chain, setChain] = useState("");
  const [plan, setPlan] = useState("paid");
  const [result, setResult] = useState<CafeResult>();
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const free = plan === "free";

  useEffect(() => {
    if (!free || !chain) return;
    let cancelled = false;
    getPlanCafes(chain)
      .then((response) => { if (!cancelled) setResult(response); })
      .catch(() => { if (!cancelled) setResult({ error: "Could not load cafés. Try again." }); });
    return () => { cancelled = true; };
  }, [chain, free, attempt]);

  function resetSelection() {
    setResult(undefined);
    setSelected([]);
    setConfirmed(false);
  }

  const cafes = result?.cafes;
  const activeCount = cafes?.filter((cafe) => cafe.active && selected.includes(cafe.id)).length ?? 0;
  const empty = selected.length === 0;

  return (
    <ActionForm
      operation="activate_plan"
      context={{ request_id: requestId }}
      label="Record plan change"
      submitDisabled={!chain || (free && (!cafes || (empty && !confirmed)))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 text-sm font-medium">
          <label htmlFor={`${formId}-chain`}>Partner</label>
          <select
            id={`${formId}-chain`}
            className={SELECT_CLASS}
            name="chain_id"
            value={chain}
            required
            onChange={(event) => {
              setChain(event.currentTarget.value);
              resetSelection();
            }}
          >
            <option value="">Choose a partner</option>
            {partners.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-sm font-medium">
          <label htmlFor={`${formId}-plan`}>Plan</label>
          <select
            id={`${formId}-plan`}
            className={SELECT_CLASS}
            name="plan"
            value={plan}
            onChange={(event) => {
              setPlan(event.currentTarget.value);
              resetSelection();
            }}
          >
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </select>
        </div>
      </div>

      <label className="block space-y-2 text-sm font-medium">
        Approval or subscription reference
        <Input name="reason" className="min-h-11" required />
      </label>

      {free && chain && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Cafés to keep on Free</legend>
          {!result && <p role="status" className="text-sm text-muted-foreground">Loading cafés…</p>}
          {result?.error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">{result.error}</p>
              <Button type="button" variant="outline" onClick={() => {
                setResult(undefined);
                setAttempt((previous) => previous + 1);
              }}>Retry</Button>
            </div>
          )}
          {cafes && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                {activeCount} of 3 active cafés selected. {cafes.length - selected.length} cafés will have restricted workspace access. Approved public listings stay visible.
              </p>
              {cafes.length > 0 && (
                <div className="max-h-64 divide-y overflow-y-auto rounded-xl border bg-background">
                  {cafes.map((cafe) => {
                    const checked = selected.includes(cafe.id);
                    return (
                      <label key={cafe.id} className="flex min-h-11 items-center gap-3 p-3 text-sm has-disabled:opacity-60">
                        <input
                          type="checkbox"
                          name="cafe_ids"
                          value={cafe.id}
                          className="size-4 shrink-0 accent-primary"
                          checked={checked}
                          disabled={cafe.active && !checked && activeCount >= 3}
                          onChange={(event) => {
                            const include = event.currentTarget.checked;
                            setSelected((current) => include ? [...current, cafe.id] : current.filter((id) => id !== cafe.id));
                            setConfirmed(false);
                          }}
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          <span className="block font-medium">{cafe.name || "Unnamed café"}{!cafe.active && " (archived)"}</span>
                          {cafe.address && <span className="block text-xs text-muted-foreground">{cafe.address}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {empty && (
                <label className="flex min-h-11 items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    name="confirm_empty_free"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    required
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.currentTarget.checked)}
                  />
                  I confirm this Free plan will remove workspace access to all cafés.
                </label>
              )}
            </>
          )}
        </fieldset>
      )}
    </ActionForm>
  );
}
