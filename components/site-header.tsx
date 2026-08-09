"use client";

import Image from "next/image";
import { track } from "@vercel/analytics";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-30 items-center justify-center">
              <Image
                src="/icon.png"
                alt="Next.js logo"
                width={100}
                height={20}
                priority
              />
            </div>
          </div>
          <nav className="hidden gap-6 md:flex">
            <a
              href="/#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="/#app"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              App
            </a>
            <a
              href="/#partners"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Partners
            </a>
            <a
              href="/#download"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Download
            </a>
            <a
              href="/stores"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Find Coffee
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="https://apps.apple.com/us/app/coffee-sphut/id6759900667">
              <Button size="lg" variant="secondary" className="text-base">
                <Image
                  src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/apple_logo.png"
                  alt="Apple logo"
                  width={24}
                  height={24}
                />
                <span className="hidden md:inline">Get on iOS!</span>
              </Button>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.coffeesphut.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="bg-primary text-primary-foreground hover:bg-primary text-base"
                onClick={() => track("Download")}
              >
                <Image
                  src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/play_store.png"
                  alt="Google Play Store logo"
                  width={24}
                  height={24}
                />
                <span className="hidden md:inline">Get on Android!</span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
