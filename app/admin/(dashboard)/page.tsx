import Link from "next/link";
import {
  Store,
  FileText,
  CookingPot,
  Calendar,
  Users,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
  UserPlus,
  UserCheck,
  UserX,
  Filter,
} from "lucide-react";
import { unstable_cache } from "next/cache";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardingSummary } from "@/components/admin/onboarding-summary";
import { ActiveUsersChart, type ActiveUserRecord } from "@/components/admin/active-users-chart";
import { cn } from "@/lib/utils";

interface CachedUserMetrics {
  profilesData: {
    id: string;
    onboarding_completed: boolean;
    onboarding_responses: Record<string, any> | null;
  }[];
  users: {
    id: string;
    last_sign_in_at: string | null;
    created_at: string;
    is_anonymous: boolean;
    email: string | null;
  }[];
  waitlistCount: number;
}

const getCachedUserMetrics = unstable_cache(
  async (): Promise<CachedUserMetrics> => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { profilesData: [], users: [], waitlistCount: 0 };
    }
    try {
      const adminClient = createAdminClient();
      const [profilesRes, authUsersRes, waitlistRes] = await Promise.all([
        adminClient
          .from("Profile")
          .select("id, onboarding_completed, onboarding_responses"),
        adminClient.auth.admin.listUsers({ perPage: 1000 }),
        adminClient.from("Waitlist").select("*", { count: "exact", head: true }),
      ]);

      const profiles = (profilesRes.data ?? []) as CachedUserMetrics["profilesData"];
      const users = (authUsersRes.data?.users ?? []).map((u) => ({
        id: u.id,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        is_anonymous: Boolean(u.is_anonymous || !u.email),
        email: u.email ?? null,
      }));

      return {
        profilesData: profiles,
        users,
        waitlistCount: waitlistRes.count ?? 0,
      };
    } catch {
      return { profilesData: [], users: [], waitlistCount: 0 };
    }
  },
  ["admin-dashboard-user-metrics"],
  { revalidate: 60, tags: ["admin-user-metrics"] }
);

interface AdminDashboardPageProps {
  searchParams?: Promise<{
    hide_anonymous?: string;
    with_profile?: string;
    filter?: string;
  }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const hideAnonymous =
    resolvedParams.hide_anonymous === "true" || resolvedParams.filter === "identified";
  const onlyWithProfile =
    resolvedParams.with_profile === "true" || resolvedParams.filter === "with_profile";
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  // Fetch summary counts in parallel
  const [
    { count: cafeCount },
    { count: postCount },
    { count: recipeCount },
    { data: eventsData },
    { count: userCount },
    { data: scheduledPosts },
    { data: recentActivity },
    { data: questions },
  ] = await Promise.all([
    supabase.from("Cafe").select("*", { count: "exact", head: true }),
    supabase.from("Post").select("*", { count: "exact", head: true }),
    supabase.from("Recipe").select("*", { count: "exact", head: true }),
    supabase.from("Event").select("id, start_time, end_time"),
    supabase.from("Profile").select("*", { count: "exact", head: true }),
    supabase
      .from("Post")
      .select("id, title, published_at")
      .gt("published_at", new Date().toISOString())
      .order("published_at", { ascending: true })
      .limit(5),
    staff.role === "admin"
      ? supabase
          .from("AdminAuditLog")
          .select("id, action, table_name, actor_email, created_at, reason")
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: null }),
    supabase
      .from("OnboardingQuestion")
      .select("id, question, options, priority, active, multi_select")
      .order("priority", { ascending: true }),
  ]);

  // Fetch user profile onboarding responses and auth users via cached metrics helper
  let profilesData: CachedUserMetrics["profilesData"] = [];
  let activeUserRecords: ActiveUserRecord[] = [];
  let waitlistCount = 0;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const cachedMetrics = await getCachedUserMetrics();
    profilesData = cachedMetrics.profilesData;
    waitlistCount = cachedMetrics.waitlistCount;
    const profileSet = new Set(profilesData.map((p) => p.id));

    if (cachedMetrics.users.length > 0) {
      activeUserRecords = cachedMetrics.users.map((u) => ({
        ...u,
        has_profile: profileSet.has(u.id),
      }));
    }
  }

  const totalAnonymousUsers = activeUserRecords.filter((u) => u.is_anonymous).length;
  const totalIdentifiedUsers = activeUserRecords.length - totalAnonymousUsers;
  const totalWithProfileUsers = activeUserRecords.filter((u) => u.has_profile).length;

  const displayedUserRecords = activeUserRecords.filter((u) => {
    if (hideAnonymous && u.is_anonymous) return false;
    if (onlyWithProfile && !u.has_profile) return false;
    return true;
  });

  const totalRegisteredUsers =
    displayedUserRecords.length > 0
      ? displayedUserRecords.length
      : hideAnonymous || onlyWithProfile
      ? displayedUserRecords.length
      : (userCount ?? 0);

  // Compute upcoming vs past events (an event is upcoming if its end_time or start_time is in the future)
  const nowMs = Date.now();
  const allEvents = eventsData ?? [];
  const totalEventCount = allEvents.length;
  const upcomingEvents = allEvents.filter((event) => {
    const eventTime = event.end_time
      ? new Date(event.end_time).getTime()
      : new Date(event.start_time).getTime();
    return eventTime >= nowMs;
  });
  const upcomingEventCount = upcomingEvents.length;
  const pastEventCount = totalEventCount - upcomingEventCount;

  // Compute weekly and monthly new sign-ups (reflecting anonymous filter)
  const d7 = nowMs - 7 * 24 * 60 * 60 * 1000;
  const d14 = nowMs - 14 * 24 * 60 * 60 * 1000;
  const d30 = nowMs - 30 * 24 * 60 * 60 * 1000;

  const newSignupsThisWeek = displayedUserRecords.filter(
    (u) => new Date(u.created_at).getTime() >= d7
  ).length;
  const newSignupsPrevWeek = displayedUserRecords.filter((u) => {
    const t = new Date(u.created_at).getTime();
    return t >= d14 && t < d7;
  }).length;
  const newSignupsThisMonth = displayedUserRecords.filter(
    (u) => new Date(u.created_at).getTime() >= d30
  ).length;

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{staff.email}</span>. Here is an overview of Coffee Sphut.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/admin/cafes/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Cafe
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/posts/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cafes</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cafeCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active stores in discovery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles & Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Curated coffee stories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipes</CardTitle>
            <CookingPot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recipeCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Brewing guides & drinks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Community Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingEventCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalEventCount === 0
                ? "No events scheduled"
                : pastEventCount > 0
                ? `${upcomingEventCount} upcoming (${pastEventCount} past)`
                : "Upcoming throwdowns & tastings"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* App Users & Growth metrics */}
      <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">App Users & Growth</h2>
                {hideAnonymous && !onlyWithProfile && (
                  <Badge
                    variant="outline"
                    className="text-[11px] px-2 py-0 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-normal flex items-center gap-1"
                  >
                    <UserX className="h-3 w-3" />
                    Filtered: {totalAnonymousUsers} Anonymous Hidden
                  </Badge>
                )}
                {onlyWithProfile && (
                  <Badge
                    variant="outline"
                    className="text-[11px] px-2 py-0 border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10 font-normal flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                    Profiles Only: {totalWithProfileUsers} Accounts
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Overview of user registrations, engagement velocity, and personalization survey metrics.
              </p>
            </div>

            {/* Quick Filter Segmented Pills */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1 shrink-0 self-start sm:self-auto">
              <Button
                asChild
                size="sm"
                variant={!hideAnonymous && !onlyWithProfile ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs font-medium"
              >
                <Link href="/admin">
                  All Users ({activeUserRecords.length})
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={hideAnonymous && !onlyWithProfile ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium transition-colors",
                  hideAnonymous && !onlyWithProfile &&
                    "border border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                )}
              >
                <Link href="/admin?hide_anonymous=true">
                  <UserCheck className="mr-1 h-3 w-3" />
                  Identified ({totalIdentifiedUsers})
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={onlyWithProfile ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium transition-colors",
                  onlyWithProfile &&
                    "border border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                )}
              >
                <Link href="/admin?with_profile=true">
                  <CheckCircle2 className="mr-1 h-3 w-3 text-blue-600" />
                  With Profile ({totalWithProfileUsers})
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Registered Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRegisteredUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {onlyWithProfile
                    ? "Accounts with survey profile"
                    : hideAnonymous
                    ? "Identified authenticated accounts"
                    : "All authenticated app accounts"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Sign-ups (Weekly)</CardTitle>
                <UserPlus className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {newSignupsThisWeek}
                  </span>
                  {newSignupsPrevWeek > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1 py-0 font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                    >
                      {newSignupsThisWeek >= newSignupsPrevWeek ? "+" : ""}
                      {Math.round(
                        ((newSignupsThisWeek - newSignupsPrevWeek) / newSignupsPrevWeek) * 100
                      )}
                      %
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Past 7 days ({newSignupsPrevWeek} prev week)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Sign-ups (Monthly)</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {newSignupsThisMonth}
                </div>
                <p className="text-xs text-muted-foreground">
                  Past 30 days ({totalRegisteredUsers > 0 ? Math.round((newSignupsThisMonth / totalRegisteredUsers) * 100) : 0}% of users)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Onboarding Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {profilesData.filter((p) => p.onboarding_completed).length}
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    / {totalRegisteredUsers} (
                    {totalRegisteredUsers > 0
                      ? Math.round(
                          (profilesData.filter((p) => p.onboarding_completed).length /
                            totalRegisteredUsers) *
                            100
                        )
                      : 0}
                    %)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Finished personalization survey</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Waitlist Entries</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{waitlistCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">Sign-ups waiting for early features</p>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Active Users Analytics (WAU & MAU) */}
      <ActiveUsersChart
        users={activeUserRecords}
        initialHideAnonymous={hideAnonymous}
        initialOnlyProfiles={onlyWithProfile}
      />

      {/* Onboarding Questions & Preferences Summary */}
      <OnboardingSummary
        questions={questions || []}
        profiles={profilesData}
      />

      {/* Content pipeline & Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scheduled items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scheduled Content</CardTitle>
                <CardDescription>Posts queued to automatically publish</CardDescription>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {scheduledPosts && scheduledPosts.length > 0 ? (
              <div className="space-y-3">
                {scheduledPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-medium leading-none">{post.title}</p>
                      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                        Releases {new Date(post.published_at!).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">Scheduled</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground/60" />
                <p>No content currently scheduled.</p>
                <Link
                  href="/admin/posts"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Manage all posts
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent staff activity (admin only) */}
        {staff.role === "admin" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Live audit log of changes made by team members</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/activity" className="text-xs">
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            {log.table_name}
                          </span>
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                            {log.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          By <span className="font-medium text-foreground">{log.actor_email}</span>
                          {log.reason ? ` — "${log.reason}"` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No staff activity recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
