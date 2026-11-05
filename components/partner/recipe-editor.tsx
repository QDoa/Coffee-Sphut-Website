"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PortalData } from "@/lib/partner/portal";
export function RecipeEditor({
  data,
  requestId,
}: {
  data: PortalData;
  requestId: string;
}) {
  const [id, setId] = useState("");
  const [request, setRequest] = useState(requestId);
  const recipe = data.recipes.find((r) => r.id === id);
  const [key, setKey] = useState(0);
  const [ingredients, setIngredients] = useState<
    { item_id: string; quantity: number; unit: string }[]
  >([]);
  function choose(value: string) {
    setId(value);
    setRequest(crypto.randomUUID());
    const r = data.recipes.find((x) => x.id === value);
    setIngredients((r?.ingredients as typeof ingredients) || []);
    setKey((k) => k + 1);
  }
  return (
    <>
      <label className="mb-4 block space-y-2 text-sm">
        Recipe
        <select
          aria-label="Choose recipe"
          value={id}
          onChange={(e) => choose(e.target.value)}
          className="block min-h-11 w-full rounded-lg border bg-background px-3"
        >
          <option value="">New recipe</option>
          {data.recipes.map((r) => (
            <option key={String(r.id)} value={String(r.id)}>
              {String(r.name)}
            </option>
          ))}
        </select>
      </label>
      <ActionForm
        key={key}
        operation="recipe"
        context={{
          request_id: request,
          id: id || undefined,
          revision: recipe?.revision,
        }}
        label="Save recipe"
      >
        <Label htmlFor="name">Recipe name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={String(recipe?.name || "")}
          className="min-h-11"
        />
        <Label htmlFor="yield">Serving yield</Label>
        <Input
          id="yield"
          name="yield"
          type="number"
          min="0.000001"
          step="any"
          required
          defaultValue={String(recipe?.yield || 1)}
          className="min-h-11"
        />
        <select
          name="active"
          aria-label="Recipe status"
          defaultValue={String(recipe?.active ?? true)}
          className="min-h-11 rounded border bg-background p-2"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <input
          type="hidden"
          name="ingredients"
          value={JSON.stringify(ingredients)}
        />
        {ingredients.map((item, i) => (
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
            key={i}
          >
            <select
              aria-label={`Ingredient ${i + 1}`}
              value={item.item_id}
              onChange={(e) =>
                setIngredients((old) =>
                  old.map((x, n) =>
                    n === i
                      ? {
                          ...x,
                          item_id: e.target.value,
                          unit: String(
                            data.ingredients.find(
                              (k) => k.id === e.target.value,
                            )?.unit || "",
                          ),
                        }
                      : x,
                  ),
                )
              }
              className="min-h-11 max-w-full rounded border bg-background p-2"
            >
              <option value="">Choose ingredient</option>
              {data.ingredients.map((x) => (
                <option key={String(x.id)} value={String(x.id)}>
                  {String(x.name)} ({String(x.unit)})
                </option>
              ))}
            </select>
            <Input
              className="min-h-11 w-28"
              aria-label={`Quantity ${i + 1}`}
              type="number"
              min="0.000001"
              step="any"
              value={item.quantity}
              onChange={(e) =>
                setIngredients((old) =>
                  old.map((x, n) =>
                    n === i ? { ...x, quantity: Number(e.target.value) } : x,
                  ),
                )
              }
            />
            <span className="text-sm">{item.unit}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setIngredients((old) => old.filter((_, n) => n !== i))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setIngredients((old) => [
              ...old,
              { item_id: "", quantity: 1, unit: "" },
            ])
          }
        >
          Add ingredient
        </Button>
      </ActionForm>
    </>
  );
}
