"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Coffee,
  Store,
  ChartNoAxesCombined,
  Boxes,
  BookOpen,
  Users,
  CreditCard,
  ClipboardCheck,
  Bell,
  ArrowUpRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { partnerSignOut } from "@/app/partner/actions";
import type { PortalData } from "@/lib/partner/portal";
const links = [
  ["Dashboard", "overview", Coffee],
  ["Cafés", "cafes", Store],
  ["Reward activity", "rewards", ChartNoAxesCombined],
  ["Inventory", "inventory", Boxes],
  ["Chain recipes", "recipes", BookOpen],
  ["Team", "team", Users],
  ["Plan & settings", "billing", CreditCard],
] as const;
const previewLinks = [...links, ["Staff review", "preview-review", ClipboardCheck]] as const;
export function PartnerShell({
  data,
  preview,
  reviewUnread,
  children,
}: {
  data: PortalData;
  preview: boolean;
  reviewUnread?: number;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const navigation = preview ? previewLinks : links;
  const reviewing = preview && path === "/partner/preview-review";
  const workspaceName = data.name || (reviewing ? "Staff workspace" : "Partner workspace");
  const nav = (
    <nav aria-label="Partner navigation" className="space-y-1 p-4">
      {navigation
        .filter(([, key]) => key !== "team" || data.role === "owner")
        .map(([label, key, Icon]) => (
          <Link
            key={key}
            href={`/partner/${key}`}
            onClick={() => setOpen(false)}
            aria-current={path === `/partner/${key}` ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              path === `/partner/${key}`
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
            {["inventory", "recipes"].includes(key) && data.plan === "free" && (
              <span className="ml-auto text-[10px] uppercase">Paid</span>
            )}
          </Link>
        ))}
    </nav>
  );
  return (
    <div className="min-h-svh bg-muted/25">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-background focus:p-4"
        href="#partner-content"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r bg-background lg:flex">
        <Link href="/partner" className="border-b p-8 font-serif text-2xl">
          Coffee Sphut
          <span className="mt-2 block font-sans text-xs tracking-widest text-muted-foreground uppercase">
            Partner workspace
          </span>
        </Link>
        {nav}
        <div className="mt-auto border-t p-6">
          <p className="truncate text-sm font-medium">{workspaceName}</p>
          {data.role && (
            <p className="my-2 text-xs capitalize text-muted-foreground">
              {data.role.replaceAll("_", " ")} · {data.plan}
            </p>
          )}
          {!preview && (
            <form action={partnerSignOut}>
              <Button variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          )}
          <Link
            className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"
            href="/"
          >
            Public website <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        {preview && (
          <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-950">
            Local test workspace · synthetic data · sign-in disabled for this
            loopback preview only{" "}
            <Link className="ml-2 underline" href="/partner/preview-review">
              Test staff review
            </Link>
          </div>
        )}
        <header className="flex min-h-20 items-center gap-3 border-b bg-background px-4 sm:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                className="lg:hidden"
                variant="outline"
                size="icon"
                aria-label="Open partner navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto p-0">
              <SheetHeader className="p-6">
                <SheetTitle>Coffee Sphut partners</SheetTitle>
                <SheetDescription>
                  Navigate your partner workspace.
                </SheetDescription>
              </SheetHeader>
              {nav}
            </SheetContent>
          </Sheet>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {workspaceName}
          </p>
          {data.chain_id && (
            <Button asChild size="icon" variant="outline" className="relative size-11 shrink-0">
              <Link
                href="/partner/notifications"
                prefetch={false}
                aria-current={path === "/partner/notifications" ? "page" : undefined}
                aria-label={`Review notifications${reviewUnread ? `, ${reviewUnread} unread` : ""}`}
              >
                <Bell aria-hidden="true" />
                {!!reviewUnread && (
                  <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-hidden="true">
                    {reviewUnread > 99 ? "99+" : reviewUnread}
                  </span>
                )}
              </Link>
            </Button>
          )}
          <span className="rounded-full border px-3 py-1 text-xs capitalize">
            {data.plan || "Staff"}
          </span>
        </header>
        <main
          id="partner-content"
          tabIndex={-1}
          className="mx-auto max-w-7xl space-y-6 p-4 outline-none sm:p-8"
        >
          <div className="mb-8">
            <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
              Coffee Sphut partners
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl">
              {path === "/partner/notifications"
                ? "Review notifications"
                : navigation.find(([, k]) => path === `/partner/${k}`)?.[0] || "Café details"}
            </h1>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
