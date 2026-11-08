"use client";

import { useState } from "react";
import { ActionForm } from "./action-form";

interface CafeAccessFormProps {
  cafes: { id: string; name: string; active: boolean }[];
  savedIds: string[];
  requestId: string;
  selectionRequired: boolean;
}

const FREE_CAFE_LIMIT = 3;

export function CafeAccessForm({
  cafes,
  savedIds,
  requestId,
  selectionRequired,
}: CafeAccessFormProps) {
  const [selected, setSelected] = useState(savedIds);
  const active = cafes.filter((cafe) => cafe.active);
  const archived = cafes.filter((cafe) => !cafe.active);
  const activeCount = active.filter((cafe) => selected.includes(cafe.id)).length;
  const archivedCount = archived.filter((cafe) => selected.includes(cafe.id)).length;
  const changed = selected.length !== savedIds.length ||
    selected.some((id) => !savedIds.includes(id));

  function options(rows: typeof cafes) {
    return rows.map(({ id, name, active }) => {
      const checked = selected.includes(id);
      return (
        <label key={id} className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm has-disabled:opacity-60">
          <input
            type="checkbox"
            name="cafe_ids"
            value={id}
            className="size-4 shrink-0 accent-primary"
            checked={checked}
            disabled={active && !checked && activeCount >= FREE_CAFE_LIMIT}
            onChange={(event) => {
              const include = event.currentTarget.checked;
              setSelected((current) => include ? [...current, id] : current.filter((item) => item !== id));
            }}
          />
          <span className="[overflow-wrap:anywhere]">{name}</span>
        </label>
      );
    });
  }

  return (
    <ActionForm
      operation="select_cafes"
      context={{ request_id: requestId }}
      label="Save café access"
      submitDisabled={(!changed && !selectionRequired) || activeCount > FREE_CAFE_LIMIT}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Active cafés</legend>
        <p role="status" className="text-sm text-muted-foreground">
          {activeCount} of {FREE_CAFE_LIMIT} active cafés selected
          {activeCount === FREE_CAFE_LIMIT && ". Deselect one to choose another."}
        </p>
        {active.length ? (
          <div className="max-h-72 divide-y overflow-y-auto rounded-xl border bg-background">
            {options(active)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">There are no active cafés to select.</p>
        )}
      </fieldset>
      {archived.length > 0 && (
        <details className="rounded-xl border bg-background">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
            Archived cafés ({archivedCount} selected)
          </summary>
          <p className="border-t p-3 text-sm text-muted-foreground">
            Keep access to archived café details and reports. These cafés do not count toward the active café limit.
          </p>
          <div className="max-h-56 divide-y overflow-y-auto border-t">{options(archived)}</div>
        </details>
      )}
    </ActionForm>
  );
}
