import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { SingleImageUploader } from "@/components/admin/single-image-uploader";
import { saveAuthorAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HistoryPanel } from "@/components/admin/history-panel";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface AuthorEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuthorEditPage({ params }: AuthorEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();
  let author = null;

  if (!isNew) {
    const { data } = await supabase
      .from("Author")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    author = data;
  }

  const formAction = async (formData: FormData) => {
    "use server";
    await saveAuthorAction(isNew ? null : id, formData);
  };

  const bioDefaultValue =
    typeof author?.bio === "string"
      ? author.bio
      : author?.bio
      ? JSON.stringify(author.bio, null, 2)
      : "";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/authors">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Authors
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isNew && author?.image_url && (
            <div className="relative h-14 w-14 rounded-full overflow-hidden bg-muted border shrink-0 shadow-sm">
              <Image
                src={author.image_url}
                alt={author.name || "Author"}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "Create New Author" : `Edit Author: ${author?.name}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form action={formAction} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Author Profile</CardTitle>
                <CardDescription>Name, slug, avatar image, and bio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" name="name" defaultValue={author?.name || ""} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={author?.slug || ""}
                    placeholder="john-smith"
                    required
                  />
                </div>

                <SingleImageUploader
                  name="image_url"
                  initialUrl={author?.image_url}
                  label="Avatar Photo"
                  description="Profile avatar picture displayed alongside written articles."
                  shape="circle"
                />

                <div className="space-y-2">
                  <Label htmlFor="bio">Author Bio</Label>
                  <RichTextEditor
                    id="bio"
                    name="bio"
                    defaultValue={bioDefaultValue}
                    rows={5}
                    placeholder="Coffee enthusiast and specialty roaster based in..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button asChild variant="outline">
                    <Link href="/admin/authors">Cancel</Link>
                  </Button>
                  <Button type="submit">Save Author</Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          {!isNew && <HistoryPanel tableName="Author" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
