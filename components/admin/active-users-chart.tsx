"use client";

import { useState, useMemo } from "react";
import {
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Percent,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActiveUserRecord {
  id: string;
  last_sign_in_at: string | null;
  created_at: string;
}

interface ActiveUsersChartProps {
  users: ActiveUserRecord[];
  className?: string;
}

export function ActiveUsersChart({ users, className }: ActiveUsersChartProps) {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "compare">("weekly");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute live WAU, MAU, and stickiness ratio
  const metrics = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    let wauCount = 0;
    let mauCount = 0;
    let totalSignedId = 0;

    for (const u of users) {
      if (u.last_sign_in_at) {
        totalSignedId++;
        const time = new Date(u.last_sign_in_at).getTime();
        if (time >= d7) wauCount++;
        if (time >= d30) mauCount++;
      }
    }

    const totalUsers = users.length;
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
  }, [users]);

  // Compute 8-week breakdown (WAU trend)
  const weeklyData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numWeeks = 8;

    for (let i = numWeeks - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const count = users.filter((u) => {
        if (!u.last_sign_in_at) return false;
        const t = new Date(u.last_sign_in_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `week-${i}`,
        shortLabel: `${start.getDate()} - ${endLabel}`,
        dateRange: `${startLabel} – ${endLabel}`,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [users]);

  // Compute 8-month breakdown (MAU trend)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const result = [];
    const numMonths = 8;

    for (let i = numMonths - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthName = start.toLocaleDateString("en-US", { month: "short" });
      const fullLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const count = users.filter((u) => {
        if (!u.last_sign_in_at) return false;
        const t = new Date(u.last_sign_in_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;

      result.push({
        id: `month-${i}`,
        shortLabel: `${monthName} '${String(start.getFullYear()).slice(-2)}`,
        dateRange: fullLabel,
        count,
        isCurrent: i === 0,
      });
    }

    return result;
  }, [users]);

  // Determine current active dataset for plotting
  const activeDataset = viewMode === "monthly" ? monthlyData : weeklyData;
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
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Active User Analytics</CardTitle>
            <Badge variant="outline" className="text-xs font-normal">
              Based on Last Sign-in
            </Badge>
          </div>
          <CardDescription className="text-xs mt-1">
            Tracking Weekly Active Users (WAU) and Monthly Active Users (MAU) retention trends.
          </CardDescription>
        </div>

        {/* View toggles */}
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
            Weekly (WAU)
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
            Monthly (MAU)
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
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* KPI stat summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* 1. WAU */}
          <div className="rounded-xl border bg-card/60 p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Weekly Active (WAU)</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-2xl font-bold tracking-tight">{metrics.wauCount}</span>
              <span className="text-xs text-muted-foreground">({metrics.wauPercent}% of total)</span>
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
              <span className="text-2xl font-bold tracking-tight">{metrics.mauCount}</span>
              <span className="text-xs text-muted-foreground">({metrics.mauPercent}% of total)</span>
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
              <span className="text-2xl font-bold tracking-tight">{metrics.ratio}%</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  metrics.ratio >= 50
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                    : metrics.ratio >= 20
                    ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                    : "text-muted-foreground"
                )}
              >
                {metrics.ratio >= 50 ? "High" : metrics.ratio >= 20 ? "Moderate" : "Low"}
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
              <span className="text-2xl font-bold tracking-tight">{metrics.totalUsers}</span>
              <span className="text-xs text-muted-foreground">
                ({metrics.totalSignedId} active all-time)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">All authenticated app users</p>
          </div>
        </div>

        {/* The Interactive SVG Chart */}
        <div className="rounded-xl border bg-muted/15 p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {viewMode === "monthly"
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
                <span className="h-2.5 w-2.5 rounded-xs bg-primary" />
                <span className="text-[11px]">Active Users</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full bg-primary/60" />
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
                  <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.45" />
                </linearGradient>

                {/* Highlight Gradient for Hovered Bar */}
                <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="1" />
                  <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.75" />
                </linearGradient>

                {/* Area Gradient */}
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0" />
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

              {/* Area Fill under Curve (for Trend/Compare view) */}
              {(viewMode === "compare" || viewMode === "weekly") && (
                <path d={areaD} fill="url(#areaGradient)" className="transition-all duration-300" />
              )}

              {/* Render Bars */}
              {activeDataset.map((d, index) => {
                const xCenter = paddingLeft + index * slotWidth + slotWidth / 2;
                const barX = xCenter - barWidth / 2;
                const barHeight = Math.max(3, (d.count / chartMax) * usableHeight);
                const barY = paddingTop + usableHeight - barHeight;
                const isHovered = hoveredIndex === index;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer group"
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
                        isHovered && "filter drop-shadow(0 2px 6px rgba(99,102,241,0.4))"
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
                            ? "fill-primary font-bold opacity-100"
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
                          ? "fill-primary font-medium"
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
                stroke="var(--color-primary, #6366f1)"
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
                    stroke="var(--color-primary, #6366f1)"
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
                  <span className="flex items-center gap-1 font-bold text-primary text-sm">
                    <Activity className="h-3.5 w-3.5" />
                    {activeDataset[hoveredIndex].count} Active Users
                  </span>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {metrics.totalUsers > 0
                      ? `${(
                          (activeDataset[hoveredIndex].count / metrics.totalUsers) *
                          100
                        ).toFixed(1)}%`
                      : "0%"}
                  </Badge>
                </div>
                {activeDataset[hoveredIndex].isCurrent && (
                  <div className="text-[10px] text-primary flex items-center gap-1 mt-1 font-medium">
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
