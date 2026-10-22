"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, MapPin } from "lucide-react";
import { track } from "@vercel/analytics";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "The app", href: "/#app" },
  { label: "Community", href: "/#events" },
  { label: "For café owners", href: "/#partners" },
];

export function SiteHeader() {
  const scrolled = useScrolled(8);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationTargetRef = useRef<string | null>(null);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/95 transition-colors duration-200",
        scrolled ? "border-border backdrop-blur-md" : "border-transparent",
      )}
    >
      <a
        href="#main-content"
        className="sr-only rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Coffee Sphut home"
          className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandLogo priority />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-3 text-sm text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle className="hidden size-10 border-transparent bg-transparent shadow-none sm:inline-flex" />
          <Button
            asChild
            className="h-11 px-4"
            onClick={() => track("Find Coffee")}
          >
            <Link
              href="/stores"
              aria-current={pathname === "/stores" ? "page" : undefined}
            >
              <MapPin />
              Find coffee
            </Link>
          </Button>
          <Link
            href="/#download"
            className="hidden items-center gap-1 py-3 text-sm font-medium underline-offset-4 hover:underline lg:inline-flex"
          >
            Get the app <ArrowUpRight className="size-4" />
          </Link>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[88vw] flex-col sm:max-w-sm"
              onCloseAutoFocus={(event) => {
                const targetId = navigationTargetRef.current;
                navigationTargetRef.current = null;
                if (!targetId) return;
                // Restoring focus to the menu trigger would undo same-page anchor scrolling.
                event.preventDefault();
                const target = document.getElementById(targetId);
                target?.focus({ preventScroll: true });
                target?.scrollIntoView({
                  block: "start",
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                });
              }}
            >
              <SheetHeader>
                <SheetTitle>Your next coffee starts here.</SheetTitle>
                <SheetDescription>
                  Explore Coffee Sphut and the cafés behind your daily cup.
                </SheetDescription>
              </SheetHeader>
              <nav
                aria-label="Mobile navigation"
                className="mt-6 flex flex-col px-4"
              >
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => {
                        navigationTargetRef.current = link.href.split("#")[1];
                      }}
                      className="border-b border-border py-5 text-lg transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <SheetFooter className="mt-auto">
                <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
                  Appearance <ThemeToggle />
                </div>
                <SheetClose asChild>
                  <Button asChild className="h-12">
                    <Link
                      href="/#download"
                      onClick={() => {
                        navigationTargetRef.current = "download";
                      }}
                    >
                      Get the app <ArrowUpRight />
                    </Link>
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
