import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

interface PublicPageProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  layout?: "form" | "document";
}

export function PublicPage({
  eyebrow,
  title,
  description,
  children,
  layout = "form",
}: PublicPageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-16 lg:px-8"
      >
        <Link
          href="/"
          className="mb-10 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" /> Back to Coffee Sphut
        </Link>
        <div
          className={
            layout === "form"
              ? "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20"
              : "mx-auto max-w-3xl"
          }
        >
          <header className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-balance font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          </header>
          <div
            className={
              layout === "form"
                ? "w-full min-w-0 max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 lg:justify-self-end"
                : "mt-10 border-t border-border pt-8"
            }
          >
            {children}
          </div>
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>Find your spot. Enjoy your cup.</p>
        <nav aria-label="Page support" className="flex flex-wrap gap-5">
          <Link
            href="/privacy"
            className="min-h-11 content-center underline-offset-4 hover:text-foreground hover:underline"
          >
            Privacy policy
          </Link>
          <a
            href="mailto:info@coffeesphut.com"
            className="min-h-11 content-center underline-offset-4 hover:text-foreground hover:underline"
          >
            Contact support
          </a>
        </nav>
      </footer>
    </div>
  );
}
