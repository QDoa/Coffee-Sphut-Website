"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commandAction } from "@/app/partner/actions";
import { ActionForm } from "./action-form";
import { Input } from "@/components/ui/input";
import { PartnerSelect } from "./partner-select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PortalData } from "@/lib/partner/portal";

export interface RecipeIngredient {
  item_id: string;
  quantity: number;
  unit: string;
}

interface IngredientRow extends Omit<RecipeIngredient, "quantity"> {
  key: string;
  quantity: string;
}

export function recipeIngredients(value: unknown): RecipeIngredient[] {
  return Array.isArray(value) ? (value as RecipeIngredient[]) : [];
}

export function RecipeEditor({
  recipe,
  catalog,
  requestId,
  onSaved,
}: {
  recipe?: PortalData["recipes"][number];
  catalog: PortalData["ingredients"];
  requestId: string;
  onSaved: (name: string) => void;
}) {
  const id = useId();
  const [rows, setRows] = useState<IngredientRow[]>(() =>
    recipeIngredients(recipe?.ingredients).map((ingredient, index) => ({
      ...ingredient,
      key: String(index),
      quantity: String(ingredient.quantity),
    })),
  );

  function updateRow(key: string, fields: Partial<IngredientRow>) {
    setRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  }

  return (
    <ActionForm
      operation="recipe"
      context={{
        request_id: requestId,
        id: recipe?.id,
        revision: recipe?.revision,
      }}
      label="Save recipe"
      submitDisabled={!rows.length}
      action={async (previous, form) => {
        const result = await commandAction(previous, form);
        if (result.savedId) onSaved(String(form.get("name")).trim());
        return result;
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Recipe name</Label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          defaultValue={String(recipe?.name ?? "")}
          placeholder="e.g. House latte"
          className="min-h-11"
        />
      </div>
      <div className="grid gap-4 min-[375px]:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-yield`}>Servings per batch</Label>
          <Input
            id={`${id}-yield`}
            name="yield"
            type="number"
            min="0.000001"
            step="any"
            required
            defaultValue={String(recipe?.yield ?? 1)}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-status`}>Recipe status</Label>
          <PartnerSelect
            id={`${id}-status`}
            name="active"
            defaultValue={String(recipe?.active ?? true)}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </PartnerSelect>
        </div>
      </div>

      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(
          rows.map(({ item_id, quantity, unit }) => ({
            item_id,
            quantity: Number(quantity),
            unit,
          })),
        )}
      />

      <section
        className="space-y-3 border-t pt-4"
        aria-labelledby={`${id}-ingredients`}
      >
        <div>
          <h3 id={`${id}-ingredients`} className="font-medium">
            Ingredients
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the amount needed for the full batch.
          </p>
        </div>
        {!rows.length && (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Add at least one ingredient to save this recipe.
          </p>
        )}
        {rows.map((row, index) => {
          const fieldId = `${id}-${row.key}`;
          const retained =
            row.item_id && !catalog.some((item) => item.id === row.item_id);
          return (
            <div
              key={row.key}
              className="space-y-3 rounded-xl border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`${fieldId}-item`}>
                  Ingredient {index + 1}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() =>
                    setRows((previous) =>
                      previous.filter(({ key }) => key !== row.key),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <PartnerSelect
                id={`${fieldId}-item`}
                value={row.item_id}
                required
                onChange={(event) => {
                  const itemId = event.currentTarget.value;
                  const selected = catalog.find((item) => item.id === itemId);
                  updateRow(row.key, {
                    item_id: itemId,
                    unit: String(selected?.unit ?? ""),
                  });
                }}
              >
                <option value="">Choose ingredient</option>
                {retained && (
                  <option value={row.item_id}>
                    Retained ingredient ({row.unit})
                  </option>
                )}
                {catalog.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(item.name)} ({String(item.unit)})
                  </option>
                ))}
              </PartnerSelect>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-quantity`}>
                  Quantity {index + 1}
                </Label>
                <div className="relative">
                  <Input
                    id={`${fieldId}-quantity`}
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={row.quantity}
                    aria-describedby={row.unit ? `${fieldId}-unit` : undefined}
                    onChange={(event) =>
                      updateRow(row.key, {
                        quantity: event.currentTarget.value,
                      })
                    }
                    className={row.unit ? "min-h-11 pr-16" : "min-h-11"}
                  />
                  {row.unit && (
                    <span
                      id={`${fieldId}-unit`}
                      className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
                    >
                      {row.unit}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!catalog.length}
          onClick={() => {
            const key = crypto.randomUUID();
            setRows((previous) => [
              ...previous,
              { key, item_id: "", quantity: "", unit: "" },
            ]);
          }}
        >
          <Plus aria-hidden="true" />
          Add ingredient
        </Button>
      </section>
    </ActionForm>
  );
}
