import { Suspense } from "react";
import type { Metadata } from "next";
import { getCafes } from "./server";
import { StoreFinder } from "@/components/store-finder";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Find Coffee Stores | Coffee Sphut",
  description:
    "Discover coffee shops near you with Coffee Sphut's interactive store locator.",
};

function StoreFinderSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:h-[70vh] md:flex-row">
      <div className="order-2 flex min-h-0 flex-col gap-3 md:order-1 md:h-full md:w-2/5 md:min-w-[320px]">
        <div className="h-9 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[74px] w-full shrink-0 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="order-1 h-[400px] animate-pulse rounded-xl bg-muted md:order-2 md:h-full md:flex-1" />
    </div>
  );
}

export default async function StoresPage() {
  const cafes = await getCafes();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      >
        <div className="mb-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            A good cup is closer than you think
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Find your next coffee spot.
          </h1>
          <p className="text-muted-foreground">
            Search for a café or neighbourhood. Pick a spot, then make your way
            there.
          </p>
        </div>
        <Suspense fallback={<StoreFinderSkeleton />}>
          <StoreFinder cafes={cafes} />
        </Suspense>
      </main>
    </div>
  );
}
