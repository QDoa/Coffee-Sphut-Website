import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { saveCategoryAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HistoryPanel } from "@/components/admin/history-panel";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface CategoryEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryEditPage({ params }: CategoryEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();
  let category = null;

  if (!isNew) {
    const { data } = await supabase
      .from("Category")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    category = data;
  }

  const formAction = async (formData: FormData) => {
    "use server";
    await saveCategoryAction(isNew ? null : id, formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/categories">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Categories
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "Create New Category" : `Edit Category: ${category?.title}`}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form action={formAction} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Details</CardTitle>
                <CardDescription>Title and category summary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" name="title" defaultValue={category?.title || ""} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <RichTextEditor
                    id="description"
                    name="description"
                    defaultValue={category?.description || ""}
                    rows={4}
                    placeholder="Articles and tips covering brew guides..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button asChild variant="outline">
                    <Link href="/admin/categories">Cancel</Link>
                  </Button>
                  <Button type="submit">Save Category</Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          {!isNew && <HistoryPanel tableName="Category" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
