import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { SingleImageUploader } from "@/components/admin/single-image-uploader";
import {
  savePostAction,
  setPostPublishStatusAction,
} from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PublishingControls } from "@/components/admin/publishing-controls";
import { HistoryPanel } from "@/components/admin/history-panel";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface PostEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostEditPage({ params }: PostEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();

  const [{ data: authors }, { data: categories }] = await Promise.all([
    supabase.from("Author").select("id, name").order("name", { ascending: true }),
    supabase.from("Category").select("id, title").order("title", { ascending: true }),
  ]);

  let post = null;
  let postCategoryIds: string[] = [];

  if (!isNew) {
    const { data } = await supabase
      .from("Post")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    post = data;

    const { data: pcData } = await supabase
      .from("PostCategory")
      .select("category_id")
      .eq("post_id", id);

    postCategoryIds = pcData?.map((pc) => pc.category_id) || [];
  }

  const formAction = async (formData: FormData) => {
    "use server";
    const res = await savePostAction(isNew ? null : id, formData);
    if (res?.error) throw new Error(res.error);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/posts">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Posts
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {!isNew && post?.main_image_url && (
            <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-muted border shrink-0 shadow-sm">
              <Image
                src={post.main_image_url}
                alt={post.title || "Post"}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "Write New Post" : `Edit Post: ${post?.title}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <form action={formAction} id="post-form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Article Content</CardTitle>
                <CardDescription>Title, slug URL, author, and story text.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Post Title *</Label>
                  <Input id="title" name="title" defaultValue={post?.title || ""} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug URL *</Label>
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={post?.slug || ""}
                    placeholder="my-coffee-guide"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author_id">Author</Label>
                  <select
                    id="author_id"
                    name="author_id"
                    defaultValue={post?.author_id || ""}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">Select Author...</option>
                    {authors?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <SingleImageUploader
                  name="main_image_url"
                  initialUrl={post?.main_image_url}
                  label="Main Cover Image"
                  description="Banner and preview image for article cards."
                />

                <div className="space-y-2">
                  <Label htmlFor="summary">Summary / Excerpt</Label>
                  <RichTextEditor
                    id="summary"
                    name="summary"
                    defaultValue={post?.summary || ""}
                    placeholder="Write article summary..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_text">Body Content</Label>
                  <RichTextEditor
                    id="body_text"
                    name="body_text"
                    defaultValue={post?.body || ""}
                    rows={12}
                    placeholder="Write article content..."
                  />
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {categories?.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-1.5 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          name="category_ids"
                          value={cat.id}
                          defaultChecked={postCategoryIds.includes(cat.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>{cat.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
                  <Button asChild variant="outline">
                    <Link href="/admin/posts">Cancel</Link>
                  </Button>
                  <FormSubmitButton
                    name="intent"
                    value="draft"
                    variant={isNew ? "outline" : "default"}
                    pendingLabel="Saving..."
                    className="h-9 w-auto"
                  >
                    {isNew ? "Save Draft" : "Save Post"}
                  </FormSubmitButton>
                  {isNew && (
                    <FormSubmitButton
                      name="intent"
                      value="publish"
                      pendingLabel="Publishing..."
                      className="h-9 w-auto"
                    >
                      Publish Now
                    </FormSubmitButton>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Sidebar controls */}
        <div className="space-y-6">
          {!isNew && (
            <PublishingControls
              currentPublishedAt={post?.published_at || null}
              onPublishNow={async () => {
                "use server";
                await setPostPublishStatusAction(id, new Date().toISOString());
              }}
              onSchedule={async (isoDate) => {
                "use server";
                await setPostPublishStatusAction(id, isoDate);
              }}
              onUnpublish={async () => {
                "use server";
                await setPostPublishStatusAction(id, null);
              }}
            />
          )}

          {!isNew && <HistoryPanel tableName="Post" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
