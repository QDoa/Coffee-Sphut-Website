import type { Metadata } from "next"
import { getCafes } from "./server"
import { StoreFinder } from "@/components/store-finder"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Find Coffee Stores | Coffee Sphut",
  description: "Discover coffee shops near you with Coffee Sphut's interactive store locator.",
}

export default async function StoresPage() {
  const cafes = await getCafes()

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find Coffee Stores</h1>
          <p className="text-muted-foreground">
            Browse the list or explore the map to find a coffee shop near you.
          </p>
        </div>
        <StoreFinder cafes={cafes} />
      </main>
    </div>
  )
}
