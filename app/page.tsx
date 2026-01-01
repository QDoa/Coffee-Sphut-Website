"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Coffee, MapPin } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const [download_ios_text, setDownloadIosText] = useState("Download for iOS");
  const [download_andriod_text, setDownloadAndriodText] = useState("Download for Android");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Next.js logo"
                  width={100}
                  height={20}
                  priority
                />
              </div>
              <span className="text-xl font-bold text-foreground">Coffee Sphut</span>
            </div>
          <nav className="hidden gap-6 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#app"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              App
            </a>
            <a 
              href="#download"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Download
            </a>
          </nav>
          <span className="text-xl font-bold text-foreground">Comming Soon!</span>
          </div>
        </div>
      </header>
      
      <section id="hero">
      </section>

      {/* Features Section */}
      <section id="features" className="border-b border-border bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-card-foreground sm:text-4xl lg:text-5xl">
              Everything you need for coffee
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              From discovering brewing techniques to finding your next favorite café, Coffee Sphut has you covered.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Curated Content</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Access expertly curated articles, guides, and tips to perfect your coffee brewing skills and
                  knowledge.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Find Coffee Stores</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Discover select coffee stores around you with detailed information, hours, and directions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Coffee className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Coffee Education</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Learn about different coffee beans, brewing methods, and sustainable practices from our comprehensive
                  guides.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* App Preview Section */}
      <section id="app" className="border-b border-border bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Explore the App
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              A seamless experience designed for coffee lovers.
            </p>
          </div>

          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            <div className="flex flex-col items-center">
              <Image
                src="/images/home.png"
                alt="Coffee Sphut home feed with articles"
                width={250}
                height={541}
                className="rounded-[2rem] shadow-xl ring-1 ring-border"
              />
              <h3 className="mt-6 txt-xl font-semibold text-foreground">Discover Content</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Browse expertly curated articles and guides
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Image
                src="/images/map.png"
                alt="Coffee Sphut map showing nearby coffee stores"
                width={250}
                height={541}
                className="rounded-[2rem] shadow-xl ring-1 ring-border"
              />
              <h3 className="mt-6 txt-xl font-semibold text-foreground">Find Stores</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Locate select coffee stores with interactive maps
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Image
                src="/images/account.png"
                alt="Coffee Sphut account screen"
                width={250}
                height={541}
                className="rounded-[2rem] shadow-xl ring-1 ring-border"
              />
              <h3 className="mt-6 txt-xl font-semibold text-foreground">Save Favourites</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Bookmark articles and store for quick access
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="download" className="bg-primary py-16 text-primary-foreground sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to elevate your coffee experience?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg opacity-90">
            Join thousands of coffee enthusiasts discovering new flavors, techniques, and their next favorite café.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" variant="secondary" className="w-64 text-base" onMouseEnter={() => setDownloadIosText("Coming soon on iOS!")} onMouseLeave={() => setDownloadIosText("Download for iOS")}>
              {download_ios_text}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-64 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base"
              onMouseEnter={() => setDownloadAndriodText("Coming soon on Android!")}
              onMouseLeave={() => setDownloadAndriodText("Download for Android")}
            >
              {download_andriod_text}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Next.js logo"
                  width={100}
                  height={20}
                  priority
                />
              </div>
              <span className="text-lg font-bold text-card-foreground">Coffee Sphut</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Coffee Sphut. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#privacy" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Privacy Policy
              </a>
              <a href="#terms" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Terms of Service
              </a>
              <a href="#contact" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
