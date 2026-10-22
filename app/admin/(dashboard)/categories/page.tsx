import Link from "next/link";
import { PlusCircle, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteCategoryAction } from "./actions";
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

export default async function CategoriesPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("Category")
    .select("id, title, description, created_at")
    .order("title", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Post Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize articles and stories by coffee topics, guides, and brew methods.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/categories/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Category
          </Link>
        </Button>
      </div>

      <div className="min-w-0 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories && categories.length > 0 ? (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <Link
                      href={`/admin/categories/${category.id}`}
                      className="font-medium hover:underline flex items-center gap-2"
                    >
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {category.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/categories/${category.id}`}>Edit</Link>
                      </Button>
                      {staff.role === "admin" && (
                        <DeleteButton
                          action={async () => {
                            "use server";
                            await deleteCategoryAction(category.id);
                          }}
                          title={`Delete ${category.title}?`}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                  No categories found. Click &quot;New Category&quot; to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
