import Link from "next/link";
import Image from "next/image";
import { PlusCircle, FileText, CheckCircle2, Clock, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deletePostAction } from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function PostsPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("Post")
    .select("id, title, slug, published_at, created_at, main_image_url, Author(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articles & Posts</h1>
          <p className="text-sm text-muted-foreground">
            Curate coffee guides, gear reviews, and articles with drafts and scheduling.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/posts/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title & Slug</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts && posts.length > 0 ? (
              posts.map((post) => {
                const isPublished =
                  post.published_at !== null &&
                  new Date(post.published_at).getTime() <= Date.now();
                const isScheduled =
                  post.published_at !== null &&
                  new Date(post.published_at).getTime() > Date.now();

                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {post.main_image_url ? (
                          <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0 border">
                            <Image
                              src={post.main_image_url}
                              alt={post.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground border">
                            <FileText className="h-5 w-5" />
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <Link
                            href={`/admin/posts/${post.id}`}
                            className="font-medium hover:underline block truncate"
                          >
                            {post.title}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            /{post.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(post.Author as unknown as { name: string })?.name ?? "No author"}
                    </TableCell>
                    <TableCell>
                      {isPublished ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      ) : isScheduled ? (
                        <Badge variant="secondary" className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Scheduled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleString()
                        : "Unpublished"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/posts/${post.id}`}>Edit</Link>
                        </Button>
                        {staff.role === "admin" && (
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deletePostAction(post.id);
                            }}
                            title={`Delete ${post.title}?`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  No posts found. Click &quot;New Post&quot; to write one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
