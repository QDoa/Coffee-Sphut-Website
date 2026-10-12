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

interface UnifiedUser {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  last_sign_in_at: string | null;
  has_profile: boolean;
  onboarding_completed: boolean;
  onboarding_responses?: any;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();
  const { q, onboarding, sort } = await searchParams;
  const supabase = await createClient();

  // 1. Fetch all profiles from public.Profile
  const { data: rawProfiles } = await supabase
    .from("Profile")
    .select("id, created_at, onboarding_completed, onboarding_responses")
    .order("created_at", { ascending: false });

  const profileMap = new Map<string, any>();
  if (rawProfiles) {
    for (const p of rawProfiles) {
      profileMap.set(p.id, p);
    }
  }

  // 2. Fetch all Auth users via service role client
  const usersMap = new Map<string, UnifiedUser>();

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (authData?.users) {
        for (const u of authData.users) {
          const meta = (u.user_metadata || {}) as Record<string, any>;
          const name =
            meta.full_name ||
            meta.name ||
            (meta["First Name"] && meta["Last Name"]
              ? `${meta["First Name"]} ${meta["Last Name"]}`.trim()
              : meta["First Name"] || undefined);

          const prof = profileMap.get(u.id);

          usersMap.set(u.id, {
            id: u.id,
            email: u.email || "",
            name: typeof name === "string" ? name.trim() : undefined,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at || null,
            has_profile: Boolean(prof),
            onboarding_completed: Boolean(prof?.onboarding_completed),
            onboarding_responses: prof?.onboarding_responses,
          });
        }
      }
    } catch (err) {
      console.error("Failed to list auth users:", err);
    }
  }

  // Also include any profiles that might not be in auth users (e.g. if service role not set or orphaned profiles)
  if (rawProfiles) {
    for (const p of rawProfiles) {
      if (!usersMap.has(p.id)) {
        usersMap.set(p.id, {
          id: p.id,
          email: "",
          created_at: p.created_at,
          last_sign_in_at: null,
          has_profile: true,
          onboarding_completed: p.onboarding_completed,
          onboarding_responses: p.onboarding_responses,
        });
      }
    }
  }

  const allUsers = Array.from(usersMap.values());
  let filteredUsers = [...allUsers];

  // Search filter (email, name, ID, or survey answers)
  if (q && q.trim()) {
    const cleanQ = q.trim().toLowerCase();
    filteredUsers = filteredUsers.filter((u) => {
      const emailMatch = u.email.toLowerCase().includes(cleanQ);
      const nameMatch = u.name?.toLowerCase().includes(cleanQ);
      const idMatch = u.id.toLowerCase().includes(cleanQ);

      let responseMatch = false;
      if (u.onboarding_responses) {
        const respStr = JSON.stringify(u.onboarding_responses).toLowerCase();
        responseMatch = respStr.includes(cleanQ);
      }

      return emailMatch || nameMatch || idMatch || responseMatch;
    });
  }

  // Onboarding status filter
  if (onboarding === "completed") {
    filteredUsers = filteredUsers.filter((u) => u.onboarding_completed);
  } else if (onboarding === "incomplete") {
    filteredUsers = filteredUsers.filter((u) => u.has_profile && !u.onboarding_completed);
  } else if (onboarding === "no_profile") {
    filteredUsers = filteredUsers.filter((u) => !u.has_profile);
  }

  // Sort order
  if (sort === "oldest") {
    filteredUsers.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } else if (sort === "last_active") {
    filteredUsers.sort((a, b) => {
      const aTime = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const bTime = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      return bTime - aTime;
    });
  } else {
    filteredUsers.sort(
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
        totalResults={filteredUsers.length}
        totalUsers={allUsers.length}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Account</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Last Signed In</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const displayName = user.name || user.email || "Anonymous User";
                const subText = user.name && user.email ? user.email : null;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <Link
                            href={`/admin/users/${user.id}`}
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
                      {user.id.slice(0, 8)}...{user.id.slice(-4)}
                    </TableCell>
                    <TableCell>
                      {user.onboarding_completed ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : user.has_profile ? (
                        <Badge variant="secondary" className="gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Incomplete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
                          No Profile
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {user.last_sign_in_at ? (
                        <div>
                          <span className="font-medium text-foreground block">
                            {new Date(user.last_sign_in_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(user.last_sign_in_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/70 italic">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(user.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/users/${user.id}`} className="gap-1">
                          Manage <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
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
