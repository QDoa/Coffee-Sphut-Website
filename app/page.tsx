"use client";

import { useState, useEffect } from "react";
import { track } from '@vercel/analytics';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Coffee, MapPin, Eye, Users, TrendingUp, Trophy, Headphones, Instagram, Linkedin } from "lucide-react";
import Image from "next/image";

interface JobPosting {
  title: string;
  location: string;
  type: string;
  jobDescriptionLink: string;
}

interface VendorBenefit {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const jobPostings: JobPosting[] = [
  {
    title: "Social Media & Growth Coordinator",
    location: "Lagos, Nigeria (Hybrid)",
    type: "Contract, 6-Months",
    jobDescriptionLink: "/SocialMedia&GrowthCoordinatorJobPosting.pdf",
  },
];

const vendorBenefits: VendorBenefit[] = [
  {
    title: "Increased Visibility",
    description: "Reach thousands of coffee enthusiasts actively seeking quality coffee stores and specialty vendors.",
    icon: Eye,
  },
  {
    title: "Customer Connection",
    description: "Build loyalty and meaningful relationships with customers who appreciate your brand and offerings.",
    icon: Users,
  },
  {
    title: "Growth Analytics",
    description: "Access valuable insights about your store performance, customer preferences, and engagement metrics.",
    icon: TrendingUp,
  },
  {
    title: "Brand Authority",
    description: "Establish your authority in the specialty coffee market and showcase your expertise to coffee lovers.",
    icon: Trophy,
  },
  {
    title: "Dedicated Support",
    description: "Get dedicated partnership support to help grow your business and maximize your presence on Coffee Sphut.",
    icon: Headphones,
  },
];

export default function Home() {
  const [downloadIosText, setDownloadIosText] = useState("Download for iOS");
  const [downloadAndriodText, setDownloadAndriodText] = useState("Download for Android");
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const images = [
    {
      src: "/images/home.png",
      alt: "Coffee Sphut app home screen showing coffee content",
    },
    {
      src: "/images/map.png",
      alt: "Coffee Sphut map showing nearby coffee stores",
    },
    {
      src: "/images/account.png",
      alt: "Coffee Sphut account screen",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length)
    }, 5000)

    return () => clearInterval(timer)
  })

  return (
    <div className="min-h-screen">
      {/* Header */}
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
              href="#partners"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Partners
            </a>
            <a 
              href="#download"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Download
            </a>
          </nav>
          <span className="text-xl font-bold text-[#B40317]">Coming Soon!</span>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Discover coffee like never before
              </h1>
              <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Coffee Sphut brings you curated coffee content and helps you find the best select coffee stores around
                you. Your perfect cup is just a tap away.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button size="lg" className="w-64 text-base" onMouseEnter={() => setDownloadIosText("Coming soon on iOS!")} onMouseLeave={() => setDownloadIosText("Download for iOS")}>
                  {downloadIosText}
                </Button>
                <Button size="lg" variant="outline" className="w-64 text-base bg-transparent"
                  onMouseEnter={() => setDownloadAndriodText("Coming soon on Android!")}
                  onMouseLeave={() => setDownloadAndriodText("Download for Android")}
                >
                  {downloadAndriodText}
                </Button>
              </div>
            </div>
            <div className="relative flex items-center justify-center lg:justify-end">
              <div className="relative">
                <div className="absolute inset-0 -m-12 rounded-full bg-primary/5 blur-3xl"></div>
                <div className="relative h-162.5 w-75">
                  {images.map((image, index) => (
                    <Image
                      key={index}
                      src={image.src}
                      alt={image.alt}
                      width={300}
                      height={650}
                      className={`absolute left-0 top-0 z-10 rounded-[2.5rem] shadow-2xl ring-1 ring-border transition-opacity duration-700 ease-in-out ${
                        index === currentImageIndex ? "opacity-100" : "opacity-0"
                      }`}
                      priority={index === 0}
                    />
                  ))}
                </div>
                <div className="mt-6 flex justify-center gap-2">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`h-2 z-10 rounded-full transition-opacity ease-in-out ${
                        index === currentImageIndex ? "w-8 bg-primary" : "w-2 bg-primary/30"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
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
                className="rounded-[2rem] shadow-xl ring-1 ring-border transition-transform duration-700 ease-in-out hover:scale-110"
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
                className="rounded-[2rem] shadow-xl ring-1 ring-border transition-transform duration-700 ease-in-out hover:scale-110"
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
                className="rounded-[2rem] shadow-xl ring-1 ring-border transition-transform duration-700 ease-in-out hover:scale-110"
              />
              <h3 className="mt-6 txt-xl font-semibold text-foreground">Save Favourites</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Bookmark articles and store for quick access
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Partner with Us Section */}
      <section id="partners" className="border-b border-border bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-card-foreground sm:text-4xl lg:text-5xl">
              Partner with Us
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              Grow your coffee business and reach thousands of dedicated coffee enthusiasts.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
            {vendorBenefits.slice(0, 3).map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Card key={index} className="border-border bg-background">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{benefit.title}</h3>
                    <p className="mt-2 text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
            {vendorBenefits.slice(3).map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Card key={index + 3} className="border-border bg-background">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{benefit.title}</h3>
                    <p className="mt-2 text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSf0NIlA7OQJWSNzjjKGbE1CInV9Ff5MQI65y5IN8yDXBRHITg/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="text-base"
               onClick={() => track('Signup')}
               >
                Join Our Partner Network
              </Button>
            </a>
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
              {downloadIosText}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-64 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base"
              onMouseEnter={() => setDownloadAndriodText("Coming soon on Android!")}
              onMouseLeave={() => setDownloadAndriodText("Download for Android")}
            >
              {downloadAndriodText}
            </Button>
          </div>
        </div>
      </section>

      {/* Job Posting Section */}
      {jobPostings.length > 0 &&
      <section id="jobs" className="border-b border-border bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="font-bold text-3xl sm:text-4xl lg:text-5xl">We&apos;re Hiring!</h3>
          <h4 className="mt-6 font-semibold">Current Positions</h4>
          <div className="mt-6 max-w-7xl items-center justify-center grid grid-cols-1">
            {jobPostings.map((job, index) => (
              <Card key={index} className="border-border bg-background my-2">
                <CardContent className="">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Company Logo Placeholder */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Social Media & Growth Coordinator</h3>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Contract, 6-Months
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-600">
                    <div className="flex items-center text-primary">
                      <MapPin className="h-6 w-6 text-primary" />
                      Lagos, Nigeria(Remote)
                    </div>
                  </div>
                  <div className="mt-6">
                    <a href="/SocialMedia&GrowthCoordinatorJobPosting.pdf" download="Job_Description_Social_Media_and_Growth_Coordinator.pdf">
                      <Button size="lg" variant="outline" className="w-64 text-secondary bg-primary">
                        Download Job Details (PDF)
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      }

      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-18 w-18 items-center justify-center">
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
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
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
              <div className="flex gap-5">
                <a href="https://www.instagram.com/coffeesphut/" className="text-muted-foreground transition-colors hover:text-card-foreground" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="https://www.linkedin.com/company/coffeesphut/" className="text-muted-foreground transition-colors hover:text-card-foreground" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
