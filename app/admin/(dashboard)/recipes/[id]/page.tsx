import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import {
  saveRecipeAction,
  setRecipePublishStatusAction,
} from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { RecipeForm } from "@/components/admin/recipe-form";
import { PublishingControls } from "@/components/admin/publishing-controls";
import { HistoryPanel } from "@/components/admin/history-panel";

interface RecipeEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeEditPage({ params }: RecipeEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();
  let recipe = null;

  if (!isNew) {
    const { data } = await supabase
      .from("Recipe")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    recipe = data;
  }

  const formAction = saveRecipeAction.bind(null, isNew ? null : id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/recipes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Recipes
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "Create New Recipe" : `Edit Recipe: ${recipe?.title}`}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2">
          <RecipeForm recipe={recipe} action={formAction} />
        </div>

        {/* Sidebar controls */}
        <div className="space-y-6">
          {!isNew && (
            <PublishingControls
              currentPublishedAt={recipe?.published_at || null}
              onPublishNow={async () => {
                "use server";
                await setRecipePublishStatusAction(id, new Date().toISOString());
              }}
              onSchedule={async (isoDate) => {
                "use server";
                await setRecipePublishStatusAction(id, isoDate);
              }}
              onUnpublish={async () => {
                "use server";
                await setRecipePublishStatusAction(id, null);
              }}
            />
          )}

          {!isNew && <HistoryPanel tableName="Recipe" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
