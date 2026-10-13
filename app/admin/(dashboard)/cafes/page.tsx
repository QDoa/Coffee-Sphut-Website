import Link from "next/link";
import Image from "next/image";
import { PlusCircle, Store, MapPin, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteCafeAction } from "./actions";
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
import { CafeFilters } from "@/components/admin/cafe-filters";

interface CafesPageProps {
  searchParams: Promise<{
    q?: string;
    chain?: string;
    status?: string;
    details?: string;
  }>;
}

export default async function CafesPage({ searchParams }: CafesPageProps) {
  const staff = await requireStaff("editor");
  const { q, chain, status, details } = await searchParams;
  const supabase = await createClient();

  // Fetch chains for filter dropdown
  const { data: chains } = await supabase
    .from("Chains")
    .select("id, name")
    .order("name", { ascending: true });

  // Fetch total count of all cafes in database
  const { count: totalCount } = await supabase
    .from("Cafe")
    .select("*", { count: "exact", head: true });

  // Build filtered query
  let query = supabase
    .from("Cafe")
    .select(
      "id, name, address, rating, is_active, show_details, reward_code, loyalty_threshold_override, chain_id, image_url, Chains(name)"
    )
    .order("name", { ascending: true });

  // Search by name and address
  if (q && q.trim()) {
    const cleanQ = q.trim().replace(/[%,()]/g, " ").trim();
    if (cleanQ) {
      query = query.or(`name.ilike.%${cleanQ}%,address.ilike.%${cleanQ}%`);
    }
  }

  // Filter by chain
  if (chain && chain !== "all") {
    query = query.eq("chain_id", chain);
  }

  // Filter by Store is active
  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  // Filter by show full details
  if (details === "yes" || details === "true") {
    query = query.eq("show_details", true);
  } else if (details === "no" || details === "false") {
    query = query.eq("show_details", false);
  }

  const { data: cafes } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cafes & Stores</h1>
          <p className="text-sm text-muted-foreground">
            Manage coffee locations, operating hours, geolocation, menus, and reward codes.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/cafes/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Cafe
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <CafeFilters
        chains={chains || []}
        totalResults={cafes?.length ?? 0}
        totalCafes={totalCount ?? 0}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store Name & Address</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>App Details</TableHead>
              <TableHead>Reward Code</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cafes && cafes.length > 0 ? (
              cafes.map((cafe) => (
                <TableRow key={cafe.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {cafe.image_url ? (
                        <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0 border">
                          <Image
                            src={cafe.image_url}
                            alt={cafe.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground border">
                          <Store className="h-5 w-5" />
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <Link
                          href={`/admin/cafes/${cafe.id}`}
                          className="font-medium hover:underline block truncate"
                        >
                          {cafe.name}
                        </Link>
                        {cafe.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cafe.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {(cafe.Chains as unknown as { name: string })?.name ?? "Independent"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cafe.is_active ? "default" : "secondary"}>
                      {cafe.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cafe.show_details ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-blue-500/50 text-blue-700 dark:text-blue-400 bg-blue-500/10 text-xs"
                      >
                        <Eye className="h-3 w-3" /> Full
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Basic
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {cafe.reward_code ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {cafe.reward_code}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cafe.rating ? (
                      <span className="text-sm font-semibold">★ {cafe.rating.toFixed(1)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/cafes/${cafe.id}`}>Edit</Link>
                      </Button>
                      {staff.role === "admin" && (
                        <DeleteButton
                          action={async () => {
                            "use server";
                            await deleteCafeAction(cafe.id);
                          }}
                          title={`Delete ${cafe.name}?`}
                          description="This will permanently remove the store and its menus/images from the platform."
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  No cafes found matching your search or filters. Click &quot;Reset&quot; to clear filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
