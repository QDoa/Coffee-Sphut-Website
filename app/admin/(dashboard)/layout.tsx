import type { Metadata } from "next";
import Link from "next/link";
import {
  Coffee,
  LayoutDashboard,
  Store,
  Layers,
  FileText,
  CookingPot,
  Calendar,
  Users,
  HelpCircle,
  Clock,
  ShieldCheck,
  UserCog,
  LogOut,
  Sparkles,
} from "lucide-react";
import { requireStaff, StaffUser } from "@/lib/admin/auth";
import { logoutAction } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Admin Dashboard | Coffee Sphut",
  robots: {
    index: false,
    follow: false,
  },
};

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Activity Log", href: "/admin/activity", icon: Clock, adminOnly: true },
    ],
  },
  {
    label: "Coffee & Stores",
    items: [
      { title: "Cafes", href: "/admin/cafes", icon: Store },
      { title: "Chains", href: "/admin/chains", icon: Layers },
    ],
  },
  {
    label: "Content & Community",
    items: [
      { title: "Posts", href: "/admin/posts", icon: FileText },
      { title: "Recipes", href: "/admin/recipes", icon: CookingPot },
      { title: "Events", href: "/admin/events", icon: Calendar },
      { title: "Authors", href: "/admin/authors", icon: Users },
      { title: "Categories", href: "/admin/categories", icon: Sparkles },
      { title: "Questions", href: "/admin/questions", icon: HelpCircle },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Loyalty", href: "/admin/users", icon: Users, adminOnly: true },
      { title: "Waitlist", href: "/admin/waitlist", icon: Clock, adminOnly: true },
      { title: "Team", href: "/admin/team", icon: UserCog, adminOnly: true },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff("editor");

  const isStaging =
    process.env.SUPABASE_URL?.includes("dev") ||
    process.env.SUPABASE_URL?.includes("staging") ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link href="/admin" className="flex items-center gap-2 font-bold tracking-tight text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Coffee className="h-4 w-4" />
            </div>
            <span>Coffee Sphut</span>
          </Link>
          <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="capitalize text-xs">
            {staff.role}
          </Badge>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {navSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.adminOnly || staff.role === "admin"
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label} className="space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <nav className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* User profile & sign out */}
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
            <span className="truncate max-w-[140px] font-medium text-foreground">
              {staff.email}
            </span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <form action={logoutAction}>
            <Button variant="outline" size="sm" type="submit" className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Staging warning banner */}
        {isStaging && (
          <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
            Staging Environment — Database changes will not affect production
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/admin" className="flex items-center gap-2 font-bold text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
                <Coffee className="h-4 w-4" />
              </div>
              <span>Coffee Sphut Admin</span>
            </Link>
          </div>

          <div className="hidden lg:block text-sm font-medium text-muted-foreground">
            Management Portal
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">
              Logged in as {staff.email}
            </Badge>
            <form action={logoutAction} className="lg:hidden">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
