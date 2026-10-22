"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Clock,
  CookingPot,
  FileText,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/admin/(auth)/actions";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { StaffRole } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        adminOnly: false,
      },
      {
        title: "Activity log",
        href: "/admin/activity",
        icon: Clock,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Coffee & cafés",
    items: [
      { title: "Cafés", href: "/admin/cafes", icon: Store, adminOnly: false },
      {
        title: "Chains",
        href: "/admin/chains",
        icon: Layers,
        adminOnly: false,
      },
    ],
  },
  {
    label: "Stories & community",
    items: [
      {
        title: "Posts",
        href: "/admin/posts",
        icon: FileText,
        adminOnly: false,
      },
      {
        title: "Recipes",
        href: "/admin/recipes",
        icon: CookingPot,
        adminOnly: false,
      },
      {
        title: "Events",
        href: "/admin/events",
        icon: Calendar,
        adminOnly: false,
      },
      {
        title: "Authors",
        href: "/admin/authors",
        icon: Users,
        adminOnly: false,
      },
      {
        title: "Categories",
        href: "/admin/categories",
        icon: Sparkles,
        adminOnly: false,
      },
      {
        title: "Questions",
        href: "/admin/questions",
        icon: HelpCircle,
        adminOnly: false,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users & loyalty",
        href: "/admin/users",
        icon: Users,
        adminOnly: true,
      },
      {
        title: "Waitlist",
        href: "/admin/waitlist",
        icon: Clock,
        adminOnly: true,
      },
      { title: "Team", href: "/admin/team", icon: UserCog, adminOnly: true },
    ],
  },
];

interface AdminShellProps {
  children: React.ReactNode;
  email: string | null;
  role: StaffRole;
  isStaging: boolean;
}

function SignOutButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="h-11 w-full justify-start"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function AdminShell({
  children,
  email,
  role,
  isStaging,
}: AdminShellProps): React.JSX.Element {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || role === "admin"),
  })).filter((section) => section.items.length > 0);
  const isActive = (href: string): boolean =>
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const currentItem = sections
    .flatMap((section) => section.items)
    .find((item) => isActive(item.href));
  const isDetail = currentItem && pathname !== currentItem.href;
  const detailLabel = pathname.endsWith("/new") ? "Create" : "Details";

  function navigation(mobile: boolean): React.JSX.Element {
    return (
      <nav
        aria-label={mobile ? "Mobile admin navigation" : "Admin navigation"}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
      >
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={mobile ? () => setMenuOpen(false) : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{item.title}</span>
                      {active && (
                        <span
                          className="ml-auto size-1.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    );
  }

  function account(): React.JSX.Element {
    return (
      <div className="space-y-3 border-t p-4">
        <div className="flex items-center gap-2 px-2">
          <ShieldCheck
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p
              className="truncate text-xs font-medium"
              title={email ?? undefined}
            >
              {email ?? "Team member"}
            </p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {role}
            </p>
          </div>
        </div>
        <form action={logoutAction}>
          <SignOutButton />
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-muted/25 font-sans">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex min-h-24 items-center justify-between gap-3 border-b px-6">
          <Link
            href="/admin"
            aria-label="Coffee Sphut admin dashboard"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BrandLogo />
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace
          </span>
        </div>
        {navigation(false)}
        {account()}
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col lg:pl-64">
        {isStaging && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-300">
            Development / preview environment
          </div>
        )}
        <header className="sticky top-0 z-30 flex min-h-20 min-w-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 lg:hidden"
                  aria-label="Open admin navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(20rem,100%)] gap-0 p-0"
              >
                <SheetHeader className="border-b px-7 py-6 pr-14">
                  <SheetTitle className="font-serif text-2xl font-normal">
                    Coffee Sphut
                  </SheetTitle>
                  <SheetDescription>Team workspace</SheetDescription>
                </SheetHeader>
                {navigation(true)}
                {account()}
              </SheetContent>
            </Sheet>
            <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
              <ol className="flex min-w-0 items-center gap-2">
                <li className="hidden shrink-0 sm:block">
                  <Link
                    href="/admin"
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Workspace
                  </Link>
                </li>
                <li className="hidden sm:block" aria-hidden="true">
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </li>
                <li className="truncate font-medium">
                  {isDetail ? (
                    <Link href={currentItem.href} className="hover:underline">
                      {currentItem.title}
                    </Link>
                  ) : (
                    <span aria-current="page">
                      {currentItem?.title ?? "Admin"}
                    </span>
                  )}
                </li>
                {isDetail && (
                  <>
                    <li aria-hidden="true">
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </li>
                    <li aria-current="page" className="text-muted-foreground">
                      {detailLabel}
                    </li>
                  </>
                )}
              </ol>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className="hidden capitalize md:inline-flex"
            >
              {role}
            </Badge>
            <Button
              asChild
              variant="ghost"
              className="hidden h-11 sm:inline-flex"
            >
              <Link href="/">View website</Link>
            </Button>
            <ThemeToggle className="size-11" />
          </div>
        </header>
        <main
          id="admin-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 outline-none sm:p-6 lg:p-8",
            "[&_h1]:font-serif [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-normal [&_h1]:tracking-tight [&_h1]:text-balance sm:[&_h1]:text-4xl",
            "[&_h1+p]:mt-2 [&_h1+p]:max-w-2xl [&_h1+p]:text-sm [&_h1+p]:leading-relaxed",
            "[&_[data-slot=card]]:min-w-0 [&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-border/80 [&_[data-slot=card]]:shadow-none",
            "[&_[data-slot=table-container]]:rounded-xl [&_[data-slot=table-head]]:bg-muted/60 [&_[data-slot=table-head]]:px-4 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-head]]:text-muted-foreground [&_[data-slot=table-cell]]:px-4 [&_[data-slot=table-cell]]:py-3",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
