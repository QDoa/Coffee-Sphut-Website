"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { track } from "@vercel/analytics";
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
  { label: "Features", href: "/#features" },
  { label: "App", href: "/#app" },
  { label: "Partners", href: "/#partners" },
  { label: "Download", href: "/#download" },
];

const APPLE_STORE_URL =
  "https://apps.apple.com/us/app/coffee-sphut/id6759900667";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.coffeesphut.app";

function StoreBadges({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <>
      <a href={APPLE_STORE_URL} target="_blank" rel="noopener noreferrer" className={fullWidth ? "w-full" : undefined}>
        <Button size="lg" variant="secondary" className={cn("text-base", fullWidth && "w-full h-12")}>
          <Image
            src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/apple_logo.png"
            alt="Apple logo"
            width={24}
            height={24}
          />
          <span className={fullWidth ? undefined : "hidden md:inline"}>
            Get on iOS!
          </span>
        </Button>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("Download")}
        className={fullWidth ? "w-full" : undefined}
      >
        <Button
          size="lg"
          variant="outline"
          className={cn("bg-primary text-primary-foreground hover:bg-primary text-base", fullWidth && "w-full h-12")}
          onClick={() => track("Download")}
        >
          <Image
            src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/play_store.png"
            alt="Google Play Store logo"
            width={24}
            height={24}
          />
          <span className={fullWidth ? undefined : "hidden md:inline"}>
            Get on Android!
          </span>
        </Button>
      </a>
    </>
  );
}

export function SiteHeader() {
  const scrolled = useScrolled(8);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors duration-300",
        scrolled
          ? "border-border bg-background/70 backdrop-blur-md supports-[not([backdrop-filter]:blur(0))]:bg-background"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between gap-3">
          <Link href="/" className="flex items-center" aria-label="Coffee Sphut home">
            <div className="flex h-10 w-24 items-center justify-center sm:w-30">
              <Image
                src="/icon.png"
                alt="Coffee Sphut"
                width={100}
                height={20}
                priority
              />
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              size="default"
              className="h-11 rounded-full px-5 text-sm md:h-10 md:px-4"
              onClick={() => track("Find Coffee")}
            >
              <Link href="/stores">Find Coffee</Link>
            </Button>

            <div className="hidden items-center gap-4 md:flex">
              <StoreBadges />
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-11 md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-[85vw] sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse Coffee Sphut pages and download the app.
                  </SheetDescription>
                </SheetHeader>

                <nav className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className="flex min-h-14 items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                <SheetFooter>
                  <Button asChild className="h-12 w-full rounded-full text-base" onClick={() => track("Find Coffee")}>
                    <Link href="/stores">Find Coffee</Link>
                  </Button>
                  <StoreBadges fullWidth />
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
