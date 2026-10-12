"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Percent,
  Sparkles,
  UserPlus,
  ArrowUpRight,
  Filter,
  UserCheck,
  UserX,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActiveUserRecord {
  id: string;
  last_sign_in_at: string | null;
  created_at: string;
  is_anonymous: boolean;
  has_profile?: boolean;
  email?: string | null;
}

interface ActiveUsersChartProps {
  users: ActiveUserRecord[];
  initialHideAnonymous?: boolean;
  initialOnlyProfiles?: boolean;
  className?: string;
}

export function ActiveUsersChart({
  users,
  initialHideAnonymous = false,
  initialOnlyProfiles = false,
  className,
}: ActiveUsersChartProps) {
  const [metricCategory, setMetricCategory] = useState<"signups" | "active">("signups");
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "compare">("weekly");
  const [hideAnonymous, setHideAnonymous] = useState(initialHideAnonymous);
  const [onlyProfiles, setOnlyProfiles] = useState(initialOnlyProfiles);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sync if parent props change
  useEffect(() => {
    setHideAnonymous(initialHideAnonymous);
  }, [initialHideAnonymous]);

  useEffect(() => {
    setOnlyProfiles(initialOnlyProfiles);
  }, [initialOnlyProfiles]);

  const isSignups = metricCategory === "signups";

  // Filter anonymous users and profiles
  const anonymousCount = useMemo(() => users.filter((u) => u.is_anonymous).length, [users]);
  const identifiedCount = users.length - anonymousCount;
  const withProfileCount = useMemo(() => users.filter((u) => u.has_profile).length, [users]);

  const displayUsers = useMemo(() => {
    return users.filter((u) => {
      if (hideAnonymous && u.is_anonymous) return false;
      if (onlyProfiles && !u.has_profile) return false;
      return true;
    });
  }, [users, hideAnonymous, onlyProfiles]);

  // Compute live WAU, MAU, and stickiness ratio (Sign-in based)
  const activeMetrics = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    let wauCount = 0;
    let mauCount = 0;
    let totalSignedId = 0;

    for (const u of displayUsers) {
      if (u.last_sign_in_at) {
        totalSignedId++;
        const time = new Date(u.last_sign_in_at).getTime();
        if (time >= d7) wauCount++;
        if (time >= d30) mauCount++;
      }
    }

    const totalUsers = displayUsers.length;
    const wauPercent = totalUsers > 0 ? ((wauCount / totalUsers) * 100).toFixed(1) : "0";
    const mauPercent = totalUsers > 0 ? ((mauCount / totalUsers) * 100).toFixed(1) : "0";
    const ratio = mauCount > 0 ? ((wauCount / mauCount) * 100).toFixed(1) : "0";

    return {
      wauCount,
      mauCount,
      wauPercent,
      mauPercent,
      ratio: Number(ratio),
      totalUsers,
      totalSignedId,
    };
  }, [displayUsers]);

  // Compute Sign-ups KPI metrics (Registration based)
  const signupMetrics = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d14 = now - 14 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    let weekCount = 0;
    let prevWeekCount = 0;
    let monthCount = 0;

    for (const u of displayUsers) {
      const time = new Date(u.created_at).getTime();
      if (time >= d7) {
        weekCount++;
      } else if (time >= d14) {
        prevWeekCount++;
      }

      if (time >= d30) {
        monthCount++;
      }
    }

    const growthVsPrevWeek =
      prevWeekCount > 0
        ? Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100)
        : null;

    const totalUsers = displayUsers.length;
    const weekPercent = totalUsers > 0 ? ((weekCount / totalUsers) * 100).toFixed(1) : "0";
    const monthPercent = totalUsers > 0 ? ((monthCount / totalUsers) * 100).toFixed(1) : "0";
    const velocityPerWeek = (monthCount / 4.3).toFixed(1);

    return {
      weekCount,
      prevWeekCount,
      growthVsPrevWeek,
      monthCount,
      monthPercent,
      weekPercent,
      velocityPerWeek,
      totalUsers,
    };
  }, [displayUsers]);

  // Compute 8-week breakdown for active users (last_sign_in_at)
  const weeklyActiveData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numWeeks = 8;

    for (let i = numWeeks - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const count = displayUsers.filter((u) => {
        if (!u.last_sign_in_at) return false;
        const t = new Date(u.last_sign_in_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `active-week-${i}`,
        shortLabel: `${start.getDate()} - ${endLabel}`,
        dateRange: `${startLabel} – ${endLabel}`,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [displayUsers]);

  // Compute 8-month breakdown for active users (last_sign_in_at)
  const monthlyActiveData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numMonths = 8;

    for (let i = numMonths - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthName = start.toLocaleDateString("en-US", { month: "short" });
      const fullLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const count = displayUsers.filter((u) => {
        if (!u.last_sign_in_at) return false;
        const t = new Date(u.last_sign_in_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `active-month-${i}`,
        shortLabel: `${monthName} '${String(start.getFullYear()).slice(-2)}`,
        dateRange: fullLabel,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [displayUsers]);

  // Compute 8-week breakdown for new sign-ups (created_at)
  const weeklySignupData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numWeeks = 8;

    for (let i = numWeeks - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const count = displayUsers.filter((u) => {
        const t = new Date(u.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `signup-week-${i}`,
        shortLabel: `${start.getDate()} - ${endLabel}`,
        dateRange: `${startLabel} – ${endLabel}`,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [displayUsers]);

  // Compute 8-month breakdown for new sign-ups (created_at)
  const monthlySignupData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numMonths = 8;

    for (let i = numMonths - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthName = start.toLocaleDateString("en-US", { month: "short" });
      const fullLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const count = displayUsers.filter((u) => {
        const t = new Date(u.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `signup-month-${i}`,
        shortLabel: `${monthName} '${String(start.getFullYear()).slice(-2)}`,
        dateRange: fullLabel,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [displayUsers]);

  // Determine current active dataset for plotting
  const activeDataset = useMemo(() => {
    if (isSignups) {
      return viewMode === "monthly" ? monthlySignupData : weeklySignupData;
    }
    return viewMode === "monthly" ? monthlyActiveData : weeklyActiveData;
  }, [isSignups, viewMode, monthlySignupData, weeklySignupData, monthlyActiveData, weeklyActiveData]);

  const maxCount = Math.max(1, ...activeDataset.map((d) => d.count));
  // Round chart max up to comfortable ceiling
  const chartMax = Math.ceil(maxCount * 1.25) || 5;

  // Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const barCount = activeDataset.length;
  const slotWidth = usableWidth / barCount;
  const barWidth = Math.min(44, slotWidth * 0.55);

  // SVG grid lines (4 horizontal steps)
  const gridTicks = [0, Math.round(chartMax * 0.33), Math.round(chartMax * 0.66), chartMax];

  // Generate curve points for smooth spline overlay
  const points = activeDataset.map((d, index) => {
    const x = paddingLeft + index * slotWidth + slotWidth / 2;
    const y = paddingTop + usableHeight - (d.count / chartMax) * usableHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    return `${acc} C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }, "");

  // Area fill under curve
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + usableHeight} L ${points[0].x} ${
          paddingTop + usableHeight
        } Z`
      : "";

  return (
    <Card className={cn("overflow-hidden border shadow-sm", className)}>
      <CardHeader className="flex flex-col gap-4 border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isSignups ? (
                <UserPlus className="h-5 w-5 text-emerald-600" />
              ) : (
                <Activity className="h-5 w-5 text-primary" />
              )}
              <CardTitle className="text-lg font-bold">
                {isSignups ? "New User Sign-ups" : "Active User Analytics"}
              </CardTitle>
              <Badge variant="outline" className="text-xs font-normal">
                {isSignups ? "Registrations (Weekly & Monthly)" : "Last Sign-in (WAU & MAU)"}
              </Badge>
              {hideAnonymous && (
                <Badge
                  variant="outline"
                  className="text-[11px] px-2 py-0 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-normal flex items-center gap-1"
                >
                  <UserX className="h-3 w-3" />
                  Hiding {anonymousCount} Anonymous
                </Badge>
              )}
              {onlyProfiles && (
                <Badge
                  variant="outline"
                  className="text-[11px] px-2 py-0 border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10 font-normal flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  Profiles Only ({withProfileCount})
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-1">
              {isSignups
                ? `Tracking ${displayUsers.length} account registrations created per week and per month.`
                : `Tracking Weekly Active Users (WAU) and Monthly Active Users (MAU) across ${displayUsers.length} accounts.`}
            </CardDescription>
          </div>

          {/* Metric Category Toggle (Sign-ups vs Active Users) */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-1 shrink-0 self-start sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={isSignups ? "default" : "ghost"}
              onClick={() => {
                setMetricCategory("signups");
                setHoveredIndex(null);
              }}
              className={cn(
                "h-7 px-3 text-xs font-medium transition-colors",
                isSignups && "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              New Sign-ups
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isSignups ? "default" : "ghost"}
              onClick={() => {
                setMetricCategory("active");
                setHoveredIndex(null);
              }}
              className="h-7 px-3 text-xs font-medium"
            >
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Active Users
            </Button>
          </div>
        </div>

        {/* View toggles & Filter buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dashed">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                isSignups ? "bg-emerald-500" : "bg-primary"
              )}
            />
            {isSignups
              ? viewMode === "monthly"
                ? "Monthly Sign-ups Breakdown (Past 8 Months)"
                : viewMode === "compare"
                ? "Sign-ups Growth Curve (Weekly Spline)"
                : "Weekly Sign-ups Breakdown (Past 8 Weeks)"
              : viewMode === "monthly"
              ? "Monthly Active Users (Past 8 Months)"
              : viewMode === "compare"
              ? "Active User Trendline (WAU with Spline)"
              : "Weekly Active Users (Past 8 Weeks)"}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Filter Anonymous Users Toggle Button */}
            <Button
              type="button"
              size="sm"
              variant={hideAnonymous ? "secondary" : "outline"}
              onClick={() => {
                setHideAnonymous(!hideAnonymous);
                setHoveredIndex(null);
              }}
              className={cn(
                "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                hideAnonymous
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={
                hideAnonymous
                  ? "Showing identified accounts only. Click to include anonymous."
                  : `Click to filter out ${anonymousCount} anonymous users.`
              }
            >
              {hideAnonymous ? (
                <>
                  <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                  <span>Hide Anonymous</span>
                </>
              ) : (
                <>
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter Anonymous ({anonymousCount})</span>
                </>
              )}
            </Button>

            {/* Filter Users With Profiles Toggle Button */}
            <Button
              type="button"
              size="sm"
              variant={onlyProfiles ? "secondary" : "outline"}
              onClick={() => {
                setOnlyProfiles(!onlyProfiles);
                setHoveredIndex(null);
              }}
              className={cn(
                "h-7 px-2.5 text-xs font-medium gap-1.5 transition-all",
                onlyProfiles
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={
                onlyProfiles
                  ? "Showing accounts with profile only. Click to show all."
                  : `Click to show only ${withProfileCount} accounts with profiles.`
              }
            >
              <CheckCircle2 className={cn("h-3.5 w-3.5", onlyProfiles ? "text-blue-600" : "")} />
              <span>{onlyProfiles ? `Profiles Only (${withProfileCount})` : `Filter Profiles (${withProfileCount})`}</span>
            </Button>

            {/* Period View Toggles */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 shrink-0">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "weekly" ? "secondary" : "ghost"}
                onClick={() => {
                  setViewMode("weekly");
                  setHoveredIndex(null);
                }}
                className="h-7 px-2.5 text-xs font-medium"
              >
                Weekly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "monthly" ? "secondary" : "ghost"}
                onClick={() => {
                  setViewMode("monthly");
                  setHoveredIndex(null);
                }}
                className="h-7 px-2.5 text-xs font-medium"
              >
                Monthly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "compare" ? "secondary" : "ghost"}
                onClick={() => {
                  setViewMode("compare");
                  setHoveredIndex(null);
                }}
                className="h-7 px-2.5 text-xs font-medium"
              >
                Dual Trend
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* KPI stat summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isSignups ? (
            <>
              {/* 1. Sign-ups Weekly */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">New Sign-ups (7d)</span>
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {signupMetrics.weekCount}
                  </span>
                  {signupMetrics.growthVsPrevWeek !== null && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1 py-0 font-mono",
                        signupMetrics.growthVsPrevWeek >= 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "text-muted-foreground"
                      )}
                    >
                      {signupMetrics.growthVsPrevWeek >= 0 ? "+" : ""}
                      {signupMetrics.growthVsPrevWeek}% vs prior 7d
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Registered in past 7 days</p>
              </div>

              {/* 2. Sign-ups Monthly */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">New Sign-ups (30d)</span>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {signupMetrics.monthCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({signupMetrics.monthPercent}% of total)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Registered in past 30 days</p>
              </div>

              {/* 3. Signup Velocity */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Weekly Velocity</span>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    ~{signupMetrics.velocityPerWeek}
                  </span>
                  <span className="text-xs text-muted-foreground">/ week</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Average registration pace</p>
              </div>

              {/* 4. Total User Base */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Total Registrations</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {signupMetrics.totalUsers}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {onlyProfiles ? "with profile" : hideAnonymous ? "identified" : "total"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {onlyProfiles
                    ? "Users with personalization profile"
                    : hideAnonymous
                    ? "Excluding anonymous guests"
                    : "All authenticated accounts"}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* 1. WAU */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Weekly Active (WAU)</span>
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {activeMetrics.wauCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({activeMetrics.wauPercent}% of total)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Signed in past 7 days</p>
              </div>

              {/* 2. MAU */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Monthly Active (MAU)</span>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {activeMetrics.mauCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({activeMetrics.mauPercent}% of total)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Signed in past 30 days</p>
              </div>

              {/* 3. WAU / MAU Stickiness */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Stickiness (WAU/MAU)</span>
                  <Percent className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {activeMetrics.ratio}%
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      activeMetrics.ratio >= 50
                        ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                        : activeMetrics.ratio >= 20
                        ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        : "text-muted-foreground"
                    )}
                  >
                    {activeMetrics.ratio >= 50
                      ? "High"
                      : activeMetrics.ratio >= 20
                      ? "Moderate"
                      : "Low"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">User retention engagement</p>
              </div>

              {/* 4. Total User Base */}
              <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Registered Accounts</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {activeMetrics.totalUsers}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({activeMetrics.totalSignedId} active all-time)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {onlyProfiles
                    ? "Users with personalization profile"
                    : hideAnonymous
                    ? "Identified users only"
                    : "All authenticated app users"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* The Interactive SVG Chart */}
        <div className="rounded-xl border bg-muted/15 p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {isSignups
                  ? viewMode === "monthly"
                    ? "Monthly Registrations (Past 8 Months)"
                    : viewMode === "compare"
                    ? "Sign-ups Growth Trendline (Weekly)"
                    : "Weekly Registrations (Past 8 Weeks)"
                  : viewMode === "monthly"
                  ? "Monthly Active Users (Past 8 Months)"
                  : viewMode === "compare"
                  ? "Active User Trendline (WAU with Spline)"
                  : "Weekly Active Users (Past 8 Weeks)"}
              </span>
              <span className="text-[11px] text-muted-foreground">• Hover bars for details</span>
            </div>

            {/* Quick legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-xs",
                    isSignups ? "bg-emerald-500" : "bg-primary"
                  )}
                />
                <span className="text-[11px]">
                  {isSignups ? "New Sign-ups" : "Active Users"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-3 rounded-full",
                    isSignups ? "bg-emerald-500/60" : "bg-primary/60"
                  )}
                />
                <span className="text-[11px]">Trend</span>
              </div>
            </div>
          </div>

          {/* SVG Plot */}
          <div className="relative w-full aspect-[720/240] max-h-[300px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-full overflow-visible select-none"
            >
              <defs>
                {/* Bar Gradient */}
                <linearGradient id="primaryBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    stopOpacity="0.9"
                  />
                  <stop
                    offset="100%"
                    stopColor={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    stopOpacity="0.45"
                  />
                </linearGradient>

                {/* Highlight Gradient for Hovered Bar */}
                <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isSignups ? "#059669" : "var(--color-primary, #6366f1)"}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    stopOpacity="0.75"
                  />
                </linearGradient>

                {/* Area Gradient */}
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    stopOpacity="0.25"
                  />
                  <stop
                    offset="100%"
                    stopColor={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis values */}
              {gridTicks.map((val) => {
                const y = paddingTop + usableHeight - (val / chartMax) * usableHeight;
                return (
                  <g key={`grid-${val}`}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area Under Trend Curve (In compare mode) */}
              {viewMode === "compare" && areaD && (
                <path d={areaD} fill="url(#areaGradient)" className="transition-all duration-300" />
              )}

              {/* Bars for Each Time Bucket */}
              {activeDataset.map((d, index) => {
                const barHeight = Math.max(3, (d.count / chartMax) * usableHeight);
                const xCenter = paddingLeft + index * slotWidth + slotWidth / 2;
                const barX = xCenter - barWidth / 2;
                const barY = paddingTop + usableHeight - barHeight;
                const isHovered = hoveredIndex === index;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Invisible wider target for easy hover */}
                    <rect
                      x={paddingLeft + index * slotWidth}
                      y={paddingTop}
                      width={slotWidth}
                      height={usableHeight}
                      fill="transparent"
                    />

                    {/* Background column highlight on hover */}
                    {isHovered && (
                      <rect
                        x={paddingLeft + index * slotWidth + 2}
                        y={paddingTop}
                        width={slotWidth - 4}
                        height={usableHeight}
                        fill="currentColor"
                        className="fill-foreground/5 rounded-md"
                      />
                    )}

                    {/* Bar */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      ry={4}
                      fill={isHovered ? "url(#hoverBarGradient)" : "url(#primaryBarGradient)"}
                      className={cn(
                        "transition-all duration-200",
                        isHovered &&
                          (isSignups
                            ? "filter drop-shadow(0 2px 6px rgba(16,185,129,0.4))"
                            : "filter drop-shadow(0 2px 6px rgba(99,102,241,0.4))")
                      )}
                    />

                    {/* Count label directly above bar */}
                    {d.count > 0 && (
                      <text
                        x={xCenter}
                        y={barY - 6}
                        textAnchor="middle"
                        className={cn(
                          "text-[10px] font-semibold transition-opacity",
                          isHovered
                            ? cn(
                                "font-bold opacity-100",
                                isSignups ? "fill-emerald-600" : "fill-primary"
                              )
                            : "fill-muted-foreground opacity-80"
                        )}
                      >
                        {d.count}
                      </text>
                    )}

                    {/* X-Axis label */}
                    <text
                      x={xCenter}
                      y={chartHeight - 8}
                      textAnchor="middle"
                      className={cn(
                        "text-[10px] transition-colors",
                        isHovered
                          ? "fill-foreground font-semibold"
                          : d.isCurrent
                          ? isSignups
                            ? "fill-emerald-600 font-medium"
                            : "fill-primary font-medium"
                          : "fill-muted-foreground"
                      )}
                    >
                      {d.shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Smooth Trend Spline Line */}
              <path
                d={pathD}
                fill="none"
                stroke={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                strokeWidth={2.5}
                strokeLinecap="round"
                className="transition-all duration-300 opacity-90"
              />

              {/* Data Node Dots on Curve */}
              {points.map((p, index) => {
                const isHovered = hoveredIndex === index;
                return (
                  <circle
                    key={`dot-${p.id}`}
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 5 : 3.5}
                    fill="var(--color-background, #ffffff)"
                    stroke={isSignups ? "#10b981" : "var(--color-primary, #6366f1)"}
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all duration-200 pointer-events-none"
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip Popover */}
            {hoveredIndex !== null && activeDataset[hoveredIndex] && (
              <div
                className="absolute z-20 pointer-events-none -translate-x-1/2 rounded-lg border bg-popover/95 p-2.5 text-xs text-popover-foreground shadow-lg backdrop-blur-xs transition-all duration-150"
                style={{
                  left: `${
                    ((paddingLeft + hoveredIndex * slotWidth + slotWidth / 2) / chartWidth) * 100
                  }%`,
                  top: `${Math.max(
                    0,
                    ((paddingTop +
                      usableHeight -
                      (activeDataset[hoveredIndex].count / chartMax) * usableHeight) /
                      chartHeight) *
                      100 -
                      25
                  )}%`,
                }}
              >
                <div className="font-semibold text-foreground text-[11px] whitespace-nowrap">
                  {activeDataset[hoveredIndex].dateRange}
                </div>
                <div className="flex items-center gap-2 mt-1 whitespace-nowrap">
                  <span
                    className={cn(
                      "flex items-center gap-1 font-bold text-sm",
                      isSignups
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-primary"
                    )}
                  >
                    {isSignups ? (
                      <UserPlus className="h-3.5 w-3.5" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}
                    {activeDataset[hoveredIndex].count}{" "}
                    {isSignups ? "New Sign-ups" : "Active Users"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {displayUsers.length > 0
                      ? `${(
                          (activeDataset[hoveredIndex].count / displayUsers.length) *
                          100
                        ).toFixed(1)}%`
                      : "0%"}
                  </Badge>
                </div>
                {activeDataset[hoveredIndex].isCurrent && (
                  <div
                    className={cn(
                      "text-[10px] flex items-center gap-1 mt-1 font-medium",
                      isSignups ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                    )}
                  >
                    <Sparkles className="h-3 w-3" /> Current Period
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
