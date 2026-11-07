"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Calculator, Pencil, Plus, Search } from "lucide-react";
import { getRecipeStock } from "@/app/partner/actions";
import type { PortalData } from "@/lib/partner/portal";
import { amount } from "@/lib/partner/stock";
import {
  RecipeEditor,
  recipeIngredients,
  type RecipeIngredient,
} from "./recipe-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Recipe = PortalData["recipes"][number];
type StockResult = Awaited<ReturnType<typeof getRecipeStock>>;

function formatQuantity(quantity: number): string {
  return quantity > 0 && quantity < 0.000001 ? "<0.000001" : amount(quantity);
}

function RecipeAmounts({
  recipeId,
  ingredients,
  names,
  servings,
  cafes,
}: {
  recipeId: string;
  ingredients: RecipeIngredient[];
  names: Map<string, string>;
  servings: number;
  cafes: PortalData["cafes"];
}) {
  const id = useId();
  const [target, setTarget] = useState<string | null>(null);
  const [cafeId, setCafeId] = useState("");
  const [response, setResponse] = useState<{
    cafeId: string;
    result: StockResult;
  } | null>(null);
  const stock = response?.cafeId === cafeId ? response.result : null;

  useEffect(() => {
    if (!cafeId) return;
    let cancelled = false;
    getRecipeStock(recipeId, Number(cafeId))
      .then((result) => {
        if (!cancelled) setResponse({ cafeId, result });
      })
      .catch(() => {
        if (!cancelled)
          setResponse({
            cafeId,
            result: { error: "Stock could not be checked for this café." },
          });
      });
    return () => {
      cancelled = true;
    };
  }, [cafeId, recipeId]);

  const scaling = target !== null;
  const requested = Number(target);
  const factor = scaling ? requested / servings : 1;
  const matches = new Map(
    stock?.items?.map((item) => [item.ingredient_id, item]),
  );
  const rows = new Map<
    string,
    { name: string; unit: string; quantity: number; available?: number | null }
  >();
  ingredients.forEach((ingredient, index) => {
    const match = matches.get(ingredient.item_id);
    const quantity = Number(ingredient.quantity);
    const key = match?.stock_item_id
      ? `stock-${match.stock_item_id}`
      : `ingredient-${ingredient.item_id}-${index}`;
    const row = rows.get(key);
    // Several recipe lines can draw from the same stock item.
    if (row) row.quantity += quantity;
    else
      rows.set(key, {
        name: names.get(ingredient.item_id) ?? "Retained ingredient",
        unit: ingredient.unit,
        quantity,
        available: stock?.items ? (match?.available ?? null) : undefined,
      });
  });
  const valid =
    factor > 0 &&
    Number.isFinite(factor) &&
    [...rows.values()].every(({ quantity }) =>
      Number.isFinite(quantity * factor),
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Ingredients</h4>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-primary"
          aria-expanded={scaling}
          aria-controls={scaling ? `${id}-calculator` : undefined}
          onClick={() => {
            setTarget(scaling ? null : String(servings));
            setCafeId("");
            setResponse(null);
          }}
        >
          <Calculator aria-hidden="true" />
          {scaling ? "Done scaling" : "Scale recipe"}
        </Button>
      </div>
      {scaling && (
        <div
          id={`${id}-calculator`}
          className="space-y-2 rounded-xl border bg-muted/30 p-3"
        >
          <Label htmlFor={`${id}-servings`}>Target servings</Label>
          <Input
            id={`${id}-servings`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={target}
            onChange={(event) => setTarget(event.currentTarget.value)}
            aria-describedby={`${id}-serving-help`}
            aria-invalid={target !== "" && !valid}
            className="min-h-11 max-w-40 bg-background"
          />
          <p
            id={`${id}-serving-help`}
            className="break-words text-sm text-muted-foreground"
            aria-live="polite"
          >
            {valid
              ? `Preview for ${requested < 0.000001 ? target : amount(requested)} ${requested === 1 ? "serving" : "servings"}.`
              : "Enter a valid number of servings greater than zero."}
          </p>
          {cafes.length > 0 ? (
            <div className="space-y-2 pt-2">
              <Label htmlFor={`${id}-cafe`}>Check stock at café</Label>
              <select
                id={`${id}-cafe`}
                className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
                value={cafeId}
                onChange={(event) => {
                  setResponse(null);
                  setCafeId(event.currentTarget.value);
                }}
              >
                <option value="">Choose a café</option>
                {cafes.map((cafe) => (
                  <option key={String(cafe.id)} value={String(cafe.id)}>
                    {String(cafe.name)}
                    {cafe.is_active === false ? " (archived)" : ""}
                  </option>
                ))}
              </select>
              {cafeId && !stock && (
                <p role="status" className="text-sm text-muted-foreground">
                  Checking stock…
                </p>
              )}
              {stock?.error && (
                <p role="alert" className="text-sm text-destructive">
                  {stock.error}
                </p>
              )}
              {stock?.items && (
                <p className="text-xs text-muted-foreground">
                  Ingredients match by inventory code and unit.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cafés are available for a stock check.
            </p>
          )}
        </div>
      )}
      <ul className="divide-y border-y text-sm">
        {[...rows].map(([key, ingredient]) => {
          const quantity = ingredient.quantity * factor;
          const available = ingredient.available;
          const difference = available == null ? 0 : quantity - available;
          const tolerance =
            Number.EPSILON *
            Math.max(quantity, available ?? 0) *
            (ingredients.length + 2);
          const shortage = difference > tolerance ? difference : 0;
          return (
            <li key={key} className="space-y-1.5 py-2">
              <div className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{ingredient.name}</span>
                <span className="min-w-0 max-w-[55%] break-words text-right text-muted-foreground tabular-nums">
                  {valid
                    ? `${formatQuantity(quantity)} ${ingredient.unit}`
                    : "—"}
                </span>
              </div>
              {valid && available !== undefined && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {available === null ? (
                    <Badge variant="outline">No matching stock item</Badge>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        {amount(available)} {ingredient.unit} on hand
                      </span>
                      <Badge
                        variant={shortage ? "destructive" : "secondary"}
                        className="max-w-full whitespace-normal break-words"
                      >
                        {shortage
                          ? `Short by ${formatQuantity(shortage)} ${ingredient.unit}`
                          : "Enough stock"}
                      </Badge>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Recipes({ data }: { data: PortalData }) {
  const canEdit = data.role === "owner" || data.role === "chain_manager";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{
    recipe?: Recipe;
    requestId: string;
  } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const names = new Map(
    data.ingredients.map((item) => [String(item.id), String(item.name)]),
  );
  const query = search.trim().toLowerCase();
  const visible = data.recipes.filter((recipe) => {
    const matchesStatus =
      status === "all" || Boolean(recipe.active) === (status === "active");
    return (
      matchesStatus &&
      (String(recipe.name).toLowerCase().includes(query) ||
        recipeIngredients(recipe.ingredients).some(({ item_id }) =>
          names.get(item_id)?.toLowerCase().includes(query),
        ))
    );
  });

  function openEditor(recipe?: Recipe) {
    opener.current = document.activeElement as HTMLElement | null;
    setNotice("");
    setEditor({ recipe, requestId: crypto.randomUUID() });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl space-y-1 text-sm text-muted-foreground">
          <p>Shared recipes keep preparation consistent across your cafés.</p>
          <p>Use Inventory to record stock usage.</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => openEditor()}
            disabled={!data.ingredients.length}
          >
            <Plus aria-hidden="true" />
            Add recipe
          </Button>
        ) : (
          <Badge variant="outline">View only</Badge>
        )}
      </div>
      {canEdit && !data.ingredients.length && (
        <p className="rounded-xl border bg-card p-4 text-sm">
          Add an ingredient in{" "}
          <Link
            className="font-medium text-primary underline"
            href="/partner/inventory"
          >
            Inventory
          </Link>{" "}
          before creating a recipe.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border bg-primary/10 p-4 text-sm"
        >
          {notice}
        </p>
      )}

      <section className="space-y-4" aria-labelledby="recipe-library-heading">
        <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div>
            <h2 id="recipe-library-heading" className="font-medium">
              Recipe library
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {visible.length} of {data.recipes.length}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative min-w-0">
              <span className="sr-only">Search recipes</span>
              <Search
                className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInput}
                placeholder="Search by name or ingredient"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                className="min-h-11 pl-9"
              />
            </label>
            <select
              aria-label="Filter recipes by status"
              className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.currentTarget.value)}
            >
              <option value="all">All recipes</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {visible.length ? (
          <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {visible.map((recipe) => {
              const ingredients = recipeIngredients(recipe.ingredients);
              const servings = Number(recipe.yield);
              return (
                <article
                  key={String(recipe.id)}
                  className="min-w-0 space-y-4 rounded-2xl border bg-card p-5"
                  aria-labelledby={`recipe-${recipe.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3
                      id={`recipe-${recipe.id}`}
                      className="min-w-0 flex-1 break-words font-serif text-xl"
                    >
                      {String(recipe.name)}
                    </h3>
                    <Badge variant={recipe.active ? "secondary" : "outline"}>
                      {recipe.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Makes {amount(servings)}{" "}
                    {servings === 1 ? "serving" : "servings"}
                    {" · "}
                    {ingredients.length}{" "}
                    {ingredients.length === 1 ? "ingredient" : "ingredients"}
                  </p>
                  <RecipeAmounts
                    key={String(recipe.revision)}
                    recipeId={String(recipe.id)}
                    ingredients={ingredients}
                    names={names}
                    servings={servings}
                    cafes={data.cafes}
                  />
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      aria-label={`Edit ${recipe.name}`}
                      onClick={() => openEditor(recipe)}
                    >
                      <Pencil aria-hidden="true" />
                      Edit recipe
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-dashed bg-card p-8 text-center">
            <BookOpen
              className="mx-auto size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="font-medium">
              {data.recipes.length ? "No matching recipes" : "No recipes yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.recipes.length
                ? "Try a different search or status."
                : "Shared recipes will appear here when added."}
            </p>
            {data.recipes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="mt-2 min-h-11"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  searchInput.current?.focus();
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </section>

      {canEdit && (
        <Sheet
          open={Boolean(editor)}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
        >
          <SheetContent
            className="overflow-y-auto sm:max-w-xl"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (opener.current?.isConnected
                ? opener.current
                : searchInput.current
              )?.focus();
            }}
          >
            <SheetHeader>
              <SheetTitle className="break-words pr-6">
                {editor?.recipe ? `Edit ${editor.recipe.name}` : "Add recipe"}
              </SheetTitle>
              <SheetDescription>
                Set the batch yield and the amount of each ingredient.
              </SheetDescription>
            </SheetHeader>
            {editor && (
              <RecipeEditor
                key={editor.requestId}
                recipe={editor.recipe}
                catalog={data.ingredients}
                requestId={editor.requestId}
                onSaved={(name) => {
                  setNotice(`${name} saved.`);
                  setEditor((current) =>
                    current?.requestId === editor.requestId ? null : current,
                  );
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
