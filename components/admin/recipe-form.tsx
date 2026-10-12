"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface IngredientItem {
  name: string;
  amount: string;
  unit: string;
}

interface RecipeFormProps {
  recipe?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    servings: number | null;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    difficulty: string | null;
    ingredients: any;
    instructions: any;
  } | null;
  action: (formData: FormData) => Promise<any>;
}

export function RecipeForm({ recipe, action }: RecipeFormProps) {
  // Normalize initial ingredients
  const initialIngredients: IngredientItem[] = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((item: any) => {
        if (typeof item === "string") return { name: item, amount: "", unit: "" };
        return {
          name: item.name || item.item || "",
          amount: item.amount ? String(item.amount) : "",
          unit: item.unit || "",
        };
      })
    : [];

  // Normalize initial instructions
  const initialInstructions: string[] = Array.isArray(recipe?.instructions)
    ? recipe.instructions.map((inst: any) =>
        typeof inst === "string" ? inst : inst.text || inst.instruction || JSON.stringify(inst)
      )
    : [];

  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    initialIngredients.length > 0 ? initialIngredients : [{ name: "", amount: "", unit: "" }]
  );

  const [instructions, setInstructions] = useState<string[]>(
    initialInstructions.length > 0 ? initialInstructions : [""]
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ingredient helpers
  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", amount: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientItem, val: string) => {
    const updated = [...ingredients];
    updated[index][field] = val;
    setIngredients(updated);
  };

  // Instruction helpers
  const addInstruction = () => {
    setInstructions([...instructions, ""]);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, val: string) => {
    const updated = [...instructions];
    updated[index] = val;
    setInstructions(updated);
  };

  const moveInstruction = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= instructions.length) return;
    const updated = [...instructions];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    setInstructions(updated);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    // Filter out empty ingredients
    const cleanIngredients = ingredients.filter((i) => i.name.trim() !== "");
    formData.set("ingredients", JSON.stringify(cleanIngredients));

    // Filter out empty instructions
    const cleanInstructions = instructions
      .filter((step) => step.trim() !== "")
      .map((text, idx) => ({ step: idx + 1, text }));
    formData.set("instructions", JSON.stringify(cleanInstructions));

    try {
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
        setSubmitting(false);
      }
    } catch (err: any) {
      if (err?.message !== "NEXT_REDIRECT") {
        setError(err.message || "Failed to save recipe");
        setSubmitting(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic Details</CardTitle>
          <CardDescription>Recipe name, slug, description, and difficulty.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Recipe Title *</Label>
            <Input id="title" name="title" defaultValue={recipe?.title || ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug URL *</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={recipe?.slug || ""}
              placeholder="japanese-iced-pour-over"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Overview</Label>
            <RichTextEditor
              id="description"
              name="description"
              defaultValue={recipe?.description || ""}
              rows={4}
              placeholder="A refreshing iced filter brew method..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Cover Image URL</Label>
            <Input
              id="image_url"
              name="image_url"
              defaultValue={recipe?.image_url || ""}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                name="difficulty"
                defaultValue={recipe?.difficulty || "easy"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="easy">Easy</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="servings">Servings (cups)</Label>
              <Input
                id="servings"
                name="servings"
                type="number"
                min="1"
                defaultValue={recipe?.servings || 1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time_minutes">Prep Time (mins)</Label>
              <Input
                id="prep_time_minutes"
                name="prep_time_minutes"
                type="number"
                min="0"
                defaultValue={recipe?.prep_time_minutes || 5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cook_time_minutes">Brew Time (mins)</Label>
              <Input
                id="cook_time_minutes"
                name="cook_time_minutes"
                type="number"
                min="0"
                defaultValue={recipe?.cook_time_minutes || 4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ingredients & Coffee Specs</CardTitle>
            <CardDescription>Coffee beans, water ratio, ice, syrups, etc.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-1" /> Add Ingredient
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {ingredients.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Amount (e.g. 20)"
                value={item.amount}
                onChange={(e) => updateIngredient(idx, "amount", e.target.value)}
                className="w-24 sm:w-28"
              />
              <Input
                placeholder="Unit (g, ml, tbsp)"
                value={item.unit}
                onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                className="w-24 sm:w-28"
              />
              <Input
                placeholder="Ingredient (e.g. Medium-roast Ethiopian beans)"
                value={item.name}
                onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeIngredient(idx)}
                disabled={ingredients.length <= 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step by step instructions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Step-by-Step Instructions</CardTitle>
            <CardDescription>Detailed brewing procedure in numbered sequence.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addInstruction}>
            <Plus className="h-4 w-4 mr-1" /> Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {instructions.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex flex-col items-center justify-center pt-1">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {idx + 1}
                </span>
                <div className="flex flex-col mt-1">
                  <button
                    type="button"
                    onClick={() => moveInstruction(idx, "up")}
                    disabled={idx === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveInstruction(idx, "down")}
                    disabled={idx === instructions.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <RichTextEditor
                  rows={2}
                  placeholder={`Step ${idx + 1} instructions...`}
                  value={step}
                  onChange={(val) => updateInstruction(idx, val)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(idx)}
                disabled={instructions.length <= 1}
                className="text-muted-foreground hover:text-destructive mt-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button asChild variant="outline">
          <Link href="/admin/recipes">Cancel</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Recipe"}
        </Button>
      </div>
    </form>
  );
}
