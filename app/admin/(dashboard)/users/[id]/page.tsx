import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Shield, Coffee, Award, Bookmark, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResetOnboardingButton,
  AdjustPunchesButton,
  VoidRewardButton,
} from "@/components/admin/user-actions-dialogs";
import { HistoryPanel } from "@/components/admin/history-panel";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from("Profile")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Look up auth user details
  let authUserRecord: any = null;
  let userEmail = "Unknown / Not set";

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const { data: authData } = await adminClient.auth.admin.getUserById(id);
      if (authData?.user) {
        authUserRecord = authData.user;
        userEmail = authData.user.email || "No email (Anonymous)";
      }
    } catch {
      // Ignored
    }
  }

  // If neither a profile nor an auth user exists, return 404
  if (!profile && !authUserRecord) {
    notFound();
  }

  const createdAt = authUserRecord?.created_at || profile?.created_at;
  const lastSignInAt = authUserRecord?.last_sign_in_at || null;

  // Fetch Loyalty data joined with Chains
  const { data: loyaltyRecords } = await supabase
    .from("UserChainLoyalty")
    .select("*, Chains(id, name, loyalty_threshold)")
    .eq("user_id", id);

  // Fetch all chains to allow adding punch records if none exists
  const { data: allChains } = await supabase
    .from("Chains")
    .select("id, name, loyalty_threshold");

  // Fetch Rewards
  const { data: rewards } = await supabase
    .from("Rewards")
    .select("*, Chains(name), Cafe!Rewards_earned_store_fkey(name)")
    .eq("user_id", id)
    .order("issued_at", { ascending: false });

  // Fetch saved cafes & bookmarks counts
  const [{ count: savedCount }, { count: bookmarkCount }] = await Promise.all([
    supabase.from("SavedCafe").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("Bookmark").select("*", { count: "exact", head: true }).eq("user_id", id),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Users
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-muted-foreground" />
            User: {userEmail}
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">ID: {id}</p>
        </div>
        <div className="flex items-center gap-2">
          {profile && <ResetOnboardingButton userId={id} userName={userEmail} />}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile & Onboarding */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Onboarding & Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Onboarding Status</span>
              {profile?.onboarding_completed ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white mt-1 text-xs">
                  Completed
                </Badge>
              ) : profile ? (
                <Badge variant="secondary" className="mt-1 text-amber-700 dark:text-amber-400 text-xs">
                  Incomplete
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1 text-muted-foreground border-dashed text-xs">
                  No Profile Record
                </Badge>
              )}
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Member Since</span>
              <p className="font-medium" suppressHydrationWarning>
                {createdAt
                  ? new Date(createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })
                  : "Unknown"}
              </p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Last Signed In</span>
              <p className="font-medium" suppressHydrationWarning>
                {lastSignInAt
                  ? new Date(lastSignInAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Never signed in"}
              </p>
            </div>

            <div className="flex gap-4 pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500" />
                <span className="text-xs text-muted-foreground">
                  {savedCount ?? 0} saved cafes
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bookmark className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">
                  {bookmarkCount ?? 0} bookmarks
                </span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground block mb-1">
                Survey Responses JSON:
              </span>
              <pre className="p-2 rounded bg-muted text-[11px] font-mono overflow-x-auto max-h-48">
                {profile
                  ? profile.onboarding_responses
                    ? JSON.stringify(profile.onboarding_responses, null, 2)
                    : "null (no survey taken)"
                  : "No profile record created yet"}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Punch Cards */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coffee className="h-4 w-4 text-primary" /> Chain Loyalty Punches
            </CardTitle>
            <CardDescription>
              Punch balance and reward credits across participating coffee chains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loyaltyRecords && loyaltyRecords.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {loyaltyRecords.map((l: any) => {
                  const chain = l.Chains;
                  const threshold = chain?.loyalty_threshold || 10;
                  const punchCount = Number(l.punch_count || 0);

                  return (
                    <div
                      key={l.id}
                      className="p-4 rounded-lg border bg-card/60 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{chain?.name || "Chain"}</span>
                          <Badge variant="outline" className="text-xs">
                            {l.reward_count || 0} rewards
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-primary">{punchCount}</span>
                          <span className="text-xs text-muted-foreground">
                            / {threshold} punches
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex justify-end">
                        <AdjustPunchesButton
                          userId={id}
                          chainId={l.chain_id}
                          chainName={chain?.name || "Chain"}
                          currentPunches={punchCount}
                          threshold={threshold}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                This user has not yet visited or collected punches at any coffee chain.
              </p>
            )}

            {/* If there are chains where the user hasn't punched yet, allow initializing */}
            {allChains && allChains.length > (loyaltyRecords?.length || 0) && (
              <div className="pt-3 border-t">
                <span className="text-xs font-medium text-muted-foreground block mb-2">
                  Add punches for unvisited chain:
                </span>
                <div className="flex flex-wrap gap-2">
                  {allChains
                    .filter((c) => !loyaltyRecords?.some((l: any) => l.chain_id === c.id))
                    .map((chain) => (
                      <AdjustPunchesButton
                        key={chain.id}
                        userId={id}
                        chainId={chain.id}
                        chainName={chain.name}
                        currentPunches={0}
                        threshold={chain.loyalty_threshold}
                      />
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rewards Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Issued & Redeemed Rewards
          </CardTitle>
          <CardDescription>
            History of free coffee rewards granted, redeemed, or voided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chain</TableHead>
                <TableHead>Earned Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued At</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards && rewards.length > 0 ? (
                rewards.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">
                      {r.Chains?.name || "Chain"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.Cafe?.name || `Store #${r.earned_store}`}
                    </TableCell>
                    <TableCell>
                      {r.status === "issued" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                          Issued
                        </Badge>
                      ) : r.status === "redeemed" ? (
                        <Badge variant="outline" className="text-xs">
                          Redeemed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Voided
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(r.issued_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "issued" && (
                        <VoidRewardButton
                          userId={id}
                          rewardId={r.id}
                          chainName={r.Chains?.name || "Chain"}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                    No rewards earned yet by this user.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* History log */}
      <HistoryPanel tableName="Profile" recordId={id} />
    </div>
  );
}
