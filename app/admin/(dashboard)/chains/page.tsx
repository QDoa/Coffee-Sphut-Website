import Link from "next/link";
import { PlusCircle, Layers, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteChainAction } from "./actions";
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

export default async function ChainsPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: chains } = await supabase
    .from("Chains")
    .select("id, name, loyalty_threshold, created_at, Cafe(count)")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chains & Brands</h1>
          <p className="text-sm text-muted-foreground">
            Manage coffee chains and their default loyalty punch card thresholds.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/chains/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Chain
          </Link>
        </Button>
      </div>

      <div className="min-w-0 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chain Name</TableHead>
              <TableHead>Loyalty Threshold</TableHead>
              <TableHead>Linked Cafes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chains && chains.length > 0 ? (
              chains.map((chain) => {
                const cafeCount = (chain.Cafe as unknown as { count: number }[])?.[0]?.count ?? 0;
                return (
                  <TableRow key={chain.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/chains/${chain.id}`}
                        className="hover:underline flex items-center gap-2"
                      >
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        {chain.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{chain.loyalty_threshold}</span> punches
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        {cafeCount} {cafeCount === 1 ? "store" : "stores"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(chain.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/chains/${chain.id}`}>Edit</Link>
                        </Button>
                        {staff.role === "admin" && (
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deleteChainAction(chain.id);
                            }}
                            title={`Delete ${chain.name}?`}
                            description="Deleting this chain will fail if active cafes are still attached to it."
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
                  No chains found. Click &quot;New Chain&quot; to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
