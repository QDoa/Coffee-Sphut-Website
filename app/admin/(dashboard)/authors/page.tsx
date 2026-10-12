import Link from "next/link";
import Image from "next/image";
import { PlusCircle, UserCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteAuthorAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function AuthorsPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: authors } = await supabase
    .from("Author")
    .select("id, name, slug, bio, image_url, created_at")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Article Authors</h1>
          <p className="text-sm text-muted-foreground">
            Manage contributors, baristas, and coffee writers credited on posts.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/authors/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Author
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Author</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {authors && authors.length > 0 ? (
              authors.map((author) => {
                const rawBio =
                  typeof author.bio === "string"
                    ? author.bio.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
                    : author.bio
                    ? JSON.stringify(author.bio)
                    : "—";
                const bioDisplay = rawBio || "—";

                return (
                  <TableRow key={author.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {author.image_url ? (
                          <div className="relative h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0">
                            <Image
                              src={author.image_url}
                              alt={author.name}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                            <UserCircle2 className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/admin/authors/${author.id}`}
                            className="font-medium hover:underline"
                          >
                            {author.name}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      /{author.slug}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                      {bioDisplay}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/authors/${author.id}`}>Edit</Link>
                        </Button>
                        {staff.role === "admin" && (
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deleteAuthorAction(author.id);
                            }}
                            title={`Delete ${author.name}?`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                  No authors found. Click &quot;New Author&quot; to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
