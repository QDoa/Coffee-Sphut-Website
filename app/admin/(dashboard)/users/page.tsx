import Link from "next/link";
import { Users, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UserFilters } from "@/components/admin/user-filters";

interface UsersPageProps {
  searchParams: Promise<{
    q?: string;
    onboarding?: string;
    sort?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();
  const { q, onboarding, sort } = await searchParams;
  const supabase = await createClient();

  // Fetch all profiles
  const { data: rawProfiles } = await supabase
    .from("Profile")
    .select("id, created_at, onboarding_completed, onboarding_responses")
    .order("created_at", { ascending: false });

  // Map user emails and metadata if service role key is available
  const userMap: Record<string, { email: string; name?: string }> = {};
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          const meta = (u.user_metadata || {}) as Record<string, any>;
          const name =
            meta.full_name ||
            meta.name ||
            (meta["First Name"] && meta["Last Name"]
              ? `${meta["First Name"]} ${meta["Last Name"]}`.trim()
              : meta["First Name"] || undefined);

          userMap[u.id] = {
            email: u.email || "",
            name: typeof name === "string" ? name.trim() : undefined,
          };
        }
      }
    } catch {
      // Ignored if service role is unavailable
    }
  }

  const allProfiles = rawProfiles || [];
  let filteredProfiles = [...allProfiles];

  // Search filter (email, name, ID, or survey answers)
  if (q && q.trim()) {
    const cleanQ = q.trim().toLowerCase();
    filteredProfiles = filteredProfiles.filter((p) => {
      const info = userMap[p.id];
      const emailMatch = info?.email?.toLowerCase().includes(cleanQ);
      const nameMatch = info?.name?.toLowerCase().includes(cleanQ);
      const idMatch = p.id.toLowerCase().includes(cleanQ);

      let responseMatch = false;
      if (p.onboarding_responses) {
        const respStr = JSON.stringify(p.onboarding_responses).toLowerCase();
        responseMatch = respStr.includes(cleanQ);
      }

      return emailMatch || nameMatch || idMatch || responseMatch;
    });
  }

  // Onboarding status filter
  if (onboarding === "completed") {
    filteredProfiles = filteredProfiles.filter((p) => p.onboarding_completed);
  } else if (onboarding === "incomplete") {
    filteredProfiles = filteredProfiles.filter((p) => !p.onboarding_completed);
  }

  // Sort order
  if (sort === "oldest") {
    filteredProfiles.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } else {
    filteredProfiles.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Users & Loyalty</h1>
          <p className="text-sm text-muted-foreground">
            View registered mobile app users, manage onboarding progress, and adjust loyalty punches.
          </p>
        </div>
      </div>

      {/* User search & filter controls */}
      <UserFilters
        totalResults={filteredProfiles.length}
        totalUsers={allProfiles.length}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Account</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.length > 0 ? (
              filteredProfiles.map((profile) => {
                const info = userMap[profile.id];
                const displayName = info?.name || info?.email || "Anonymous User";
                const subText = info?.name && info?.email ? info.email : null;

                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <Link
                            href={`/admin/users/${profile.id}`}
                            className="font-medium hover:underline block text-sm"
                          >
                            {displayName}
                          </Link>
                          {subText && (
                            <span className="text-xs text-muted-foreground block">
                              {subText}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {profile.id.slice(0, 8)}...{profile.id.slice(-4)}
                    </TableCell>
                    <TableCell>
                      {profile.onboarding_completed ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/users/${profile.id}`} className="gap-1">
                          Manage <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  No users found matching your search or filters. Click &quot;Reset&quot; to clear filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
