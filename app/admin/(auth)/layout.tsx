import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Admin Sign In | Coffee Sphut",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-5 sm:px-10">
        <Link
          href="/"
          aria-label="Coffee Sphut home"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <BrandLogo priority />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
            Team workspace
          </span>
          <ThemeToggle className="size-11" />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Coffee Sphut
        </Link>
      </main>
      <footer className="px-5 pb-6 text-center text-xs text-muted-foreground">
        Coffee Sphut · Staff access only
      </footer>
    </div>
  );
}
