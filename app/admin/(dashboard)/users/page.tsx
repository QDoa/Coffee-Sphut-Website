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

export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Fetch profiles
  const { data: profiles } = await supabase
    .from("Profile")
    .select("id, created_at, onboarding_completed, onboarding_responses")
    .order("created_at", { ascending: false });

  // Map user emails if service role key is available
  const emailMap: Record<string, string> = {};
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          if (u.email) emailMap[u.id] = u.email;
        }
      }
    } catch {
      // Ignored if service role is unavailable
    }
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
            {profiles && profiles.length > 0 ? (
              profiles.map((profile) => {
                const userEmail = emailMap[profile.id] || "No email / Anonymous";

                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Link
                          href={`/admin/users/${profile.id}`}
                          className="font-medium hover:underline"
                        >
                          {userEmail}
                        </Link>
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
                  No registered users found in the database.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
