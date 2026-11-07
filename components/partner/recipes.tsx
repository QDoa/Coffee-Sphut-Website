"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Calculator, Pencil, Plus, Search } from "lucide-react";
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

function RecipeAmounts({
  ingredients,
  names,
  servings,
}: {
  ingredients: RecipeIngredient[];
  names: Map<string, string>;
  servings: number;
}) {
  const id = useId();
  const [target, setTarget] = useState<string | null>(null);
  const scaling = target !== null;
  const requested = Number(target);
  const factor = scaling ? requested / servings : 1;
  const valid =
    factor > 0 &&
    Number.isFinite(factor) &&
    ingredients.every(({ quantity }) => Number.isFinite(quantity * factor));

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
          onClick={() => setTarget(scaling ? null : String(servings))}
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
        </div>
      )}
      <ul className="divide-y border-y text-sm">
        {ingredients.map((ingredient, index) => {
          const quantity = ingredient.quantity * factor;
          const display =
            scaling && ingredient.quantity > 0 && quantity < 0.000001
              ? "<0.000001"
              : amount(quantity);
          return (
            <li
              key={`${ingredient.item_id}-${index}`}
              className="flex justify-between gap-3 py-2"
            >
              <span className="min-w-0 break-words">
                {names.get(ingredient.item_id) ?? "Retained ingredient"}
              </span>
              <span className="min-w-0 max-w-[55%] break-words text-right text-muted-foreground tabular-nums">
                {valid ? `${display} ${ingredient.unit}` : "—"}
              </span>
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
                    ingredients={ingredients}
                    names={names}
                    servings={servings}
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
