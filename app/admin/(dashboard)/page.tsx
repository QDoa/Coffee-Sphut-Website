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
} from "lucide-react";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function AdminDashboardPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  // Fetch summary counts in parallel
  const [
    { count: cafeCount },
    { count: postCount },
    { count: recipeCount },
    { count: eventCount },
    { count: userCount },
    { count: waitlistCount },
    { data: scheduledPosts },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from("Cafe").select("*", { count: "exact", head: true }),
    supabase.from("Post").select("*", { count: "exact", head: true }),
    supabase.from("Recipe").select("*", { count: "exact", head: true }),
    supabase.from("Event").select("*", { count: "exact", head: true }),
    staff.role === "admin"
      ? supabase.from("Profile").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    staff.role === "admin"
      ? supabase.from("Waitlist").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
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
  ]);

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
            <div className="text-2xl font-bold">{eventCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Upcoming throwdowns & tastings</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics (admin only) */}
      {staff.role === "admin" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registered App Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">User profiles with loyalty accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waitlist Entries</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{waitlistCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">Sign-ups waiting for early features</p>
            </CardContent>
          </Card>
        </div>
      )}

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
