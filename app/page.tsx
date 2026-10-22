import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Calendar,
  CalendarPlus,
  Coffee,
  Instagram,
  Linkedin,
  MapPin,
  BookOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { DownloadLinks } from "@/components/download-links";
import { FaqSection } from "@/components/faq-section";
import { HeroCarousel } from "@/components/hero-carousel";
import { LoyaltyDemo } from "@/components/loyalty-demo";
import { SectionReveal } from "@/components/section-reveal";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrackedLink } from "@/components/tracked-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  currentPartners,
  jobPostings,
  upcomingEvents,
  userFAQs,
  vendorFAQs,
} from "./constants";

const RITUALS = [
  {
    number: "01",
    icon: MapPin,
    title: "Find somewhere worth stopping.",
    description:
      "Explore cafés across Nigeria, from Lagos to Abuja. See where they are and get directions when you find your spot.",
    href: "/stores",
    link: "Explore the café map",
  },
  {
    number: "02",
    icon: BookOpen,
    title: "Get a little closer to your coffee.",
    description:
      "Coffee stories and brewing guides for the curious. Find something new to try with your next cup.",
    href: "#app",
    link: "Take a look inside",
  },
  {
    number: "03",
    icon: Bookmark,
    title: "Make a new find your usual.",
    description:
      "Save your favourite cafés and stories in the app. Collect digital stamps at participating cafés when you visit.",
    href: "#rewards",
    link: "See how stamps work",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main-content">
        <section id="hero" className="border-b border-border">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-8">
            <SectionReveal>
              <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Coffee className="size-4" aria-hidden="true" /> Coffee,
                community & a little curiosity
              </p>
              <h1 className="max-w-2xl text-balance font-serif text-6xl leading-[1.02] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
                Find your next{" "}
                <span className="italic text-primary">coffee spot.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                A café you haven’t tried. A story worth a read. A reason to come
                back. Discover the coffee community around you with Coffee
                Sphut.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Button asChild size="lg" className="group h-12 px-6">
                  <Link href="/stores">
                    Find a café{" "}
                    <ArrowRight className="motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Link
                  href="#download"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Get the free app <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
                <span>Rooted in Africa’s coffee community</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> Lagos · Abuja · More to
                  discover
                </span>
              </div>
            </SectionReveal>
            <div id="app" tabIndex={-1} className="min-w-0">
              <HeroCarousel />
            </div>
          </div>
        </section>

        <section
          aria-label="Cafés in the Coffee Sphut community"
          className="border-b border-border bg-card"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-12 lg:px-8">
            <p className="shrink-0 text-sm leading-relaxed text-muted-foreground">
              Good coffee.
              <br />
              <span className="font-medium text-foreground">Good company.</span>
            </p>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {currentPartners.map((partner) => (
                <div
                  key={partner.name}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-3"
                >
                  <Image
                    src={partner.logo}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-full object-contain"
                  />
                  <span className="text-xs font-medium sm:text-sm">
                    {partner.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <SectionReveal className="grid gap-6 border-b border-border pb-10 md:grid-cols-2 md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                For the love of the daily cup
              </p>
              <h2 className="mt-4 max-w-lg font-serif text-4xl tracking-tight sm:text-5xl">
                There’s more to coffee
                <br className="hidden sm:block" /> than the first sip.
              </h2>
            </div>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground md:justify-self-end">
              We bring the places, people, and stories together, so you can
              spend less time searching and more time enjoying your coffee.
            </p>
          </SectionReveal>
          <div className="grid gap-10 pt-10 md:grid-cols-3 md:gap-8">
            {RITUALS.map(
              ({ number, icon: Icon, title, description, href, link }) => (
                <SectionReveal key={number}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      {number} /
                    </span>
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 max-w-xs font-serif text-3xl leading-tight tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <Link
                    href={href}
                    className="group mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {link}
                    <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
                  </Link>
                </SectionReveal>
              ),
            )}
          </div>
        </section>

        <section
          id="rewards"
          className="border-y border-border bg-secondary/40"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-20 lg:px-8">
            <SectionReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Make a habit of good coffee
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
                A familiar face.
                <br />A favourite cup.
                <br />
                <span className="italic text-primary">A little thank you.</span>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                At participating cafés, each visit brings you closer to a
                reward. Show your personal QR code in the app and let your
                barista take care of the stamp.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Every café sets its own rewards. Your digital card keeps track.
              </p>
            </SectionReveal>
            <SectionReveal>
              <LoyaltyDemo />
            </SectionReveal>
          </div>
        </section>

        {upcomingEvents.length > 0 && (
          <section
            id="events"
            tabIndex={-1}
            className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
          >
            <SectionReveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Around the coffee table
                </p>
                <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
                  Coffee brings us together.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Meet the people behind the cups. Join our next community
                conversation.
              </p>
            </SectionReveal>
            {upcomingEvents.map((event) => (
              <SectionReveal
                key={event.id}
                className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
              >
                <div className="relative aspect-square w-full min-w-0 self-start bg-secondary">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    sizes="(max-width: 1023px) 100vw, 500px"
                    className="object-contain p-5 sm:p-8"
                  />
                </div>
                <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    <Calendar className="size-4" />
                    {event.badge ?? "Community event"}
                  </p>
                  <h3 className="mt-5 font-serif text-3xl tracking-tight sm:text-4xl">
                    {event.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                  <dl className="mt-6 space-y-3 border-y border-border py-5 text-sm">
                    <div className="flex gap-4">
                      <dt className="w-12 shrink-0 text-muted-foreground">
                        When
                      </dt>
                      <dd>
                        {event.date}
                        <br />
                        <span className="text-muted-foreground">
                          {event.time}
                        </span>
                      </dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-12 shrink-0 text-muted-foreground">
                        Where
                      </dt>
                      <dd>{event.location}</dd>
                    </div>
                  </dl>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <TrackedLink
                      href={event.registrationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      eventName="Event Registration"
                      className={cn(buttonVariants(), "h-11 w-full sm:w-auto")}
                    >
                      Register for free <ArrowUpRight />
                    </TrackedLink>
                    {event.googleCalendarUrl && (
                      <TrackedLink
                        href={event.googleCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        eventName="Event Add to Calendar"
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-11",
                        )}
                      >
                        <CalendarPlus /> Add to calendar
                      </TrackedLink>
                    )}
                    {event.instagramPostLink && (
                      <TrackedLink
                        href={event.instagramPostLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        eventName="Event Instagram Post"
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "h-11",
                        )}
                      >
                        <Instagram /> Instagram
                      </TrackedLink>
                    )}
                  </div>
                </div>
              </SectionReveal>
            ))}
          </section>
        )}

        <section
          id="partners"
          tabIndex={-1}
          className="border-y border-border bg-foreground text-background"
        >
          <SectionReveal className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-20 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                For the people behind the counter
              </p>
              <h2 className="mt-5 font-serif text-4xl tracking-tight sm:text-5xl">
                You make the coffee.
                <br />
                <span className="italic">We’ll help them find you.</span>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed opacity-75">
                Give your café a home on Coffee Sphut. Reach curious coffee
                drinkers and give your regulars another reason to return.
              </p>
              <TrackedLink
                href="https://docs.google.com/forms/d/e/1FAIpQLSf0NIlA7OQJWSNzjjKGbE1CInV9Ff5MQI65y5IN8yDXBRHITg/viewform"
                target="_blank"
                rel="noopener noreferrer"
                eventName="Signup"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "mt-8 h-12",
                )}
              >
                Join our café community <ArrowUpRight />
              </TrackedLink>
            </div>
            <div className="divide-y divide-background/20">
              {[
                [
                  "01",
                  "Put your café on the map",
                  "Help people discover your space, find your address, and plan their visit.",
                ],
                [
                  "02",
                  "Give regulars a reason to return",
                  "Build a digital loyalty programme around the rewards that work for your café.",
                ],
                [
                  "03",
                  "Get to know your community",
                  "Understand how coffee lovers discover and engage with your café.",
                ],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-5 py-6 first:pt-0">
                  <span className="pt-1 font-mono text-xs opacity-60">
                    {number}
                  </span>
                  <div>
                    <h3 className="font-serif text-lg font-medium">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed opacity-70">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
              <p className="pt-5 text-sm opacity-70">
                Free to list your café. Optional premium features available.
              </p>
            </div>
          </SectionReveal>
        </section>

        <section
          id="FAQs"
          className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              A few things you might be wondering
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
              Good questions.
              <br />
              Fresh answers.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Getting started, finding cafés, and making the most of your daily
              coffee.
            </p>
          </div>
          <FaqSection userFAQs={userFAQs} vendorFAQs={vendorFAQs} />
        </section>

        <section
          id="download"
          tabIndex={-1}
          className="border-y border-border bg-secondary/50"
        >
          <SectionReveal className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Take your coffee curiosity with you
              </p>
              <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
                Your next cup is out there.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Free on iOS and Android. Find your spot, make it your usual.
              </p>
            </div>
            <DownloadLinks className="shrink-0" />
          </SectionReveal>
        </section>

        {jobPostings.length > 0 && (
          <section
            id="jobs"
            className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
          >
            <h2 className="font-serif text-4xl">
              Help us build the coffee community.
            </h2>
            <div className="mt-8 divide-y divide-border">
              {jobPostings.map((job) => (
                <div
                  key={job.title}
                  className="flex flex-wrap items-center justify-between gap-4 py-6"
                >
                  <div>
                    <h3 className="font-serif text-lg font-medium">{job.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.location} · {job.type}
                    </p>
                  </div>
                  <a
                    href={job.jobDescriptionLink}
                    download
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Download job details (PDF) <ArrowUpRight />
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo />
            <span className="text-xs text-muted-foreground">
              Find your spot. Enjoy your cup.
            </span>
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-5 text-sm"
          >
            <Link href="/stores" className="hover:underline">
              Find cafés
            </Link>
            <Link href="/#partners" className="hover:underline">
              For café owners
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="border-transparent bg-transparent shadow-none" />
            <a
              href="https://www.instagram.com/coffeesphut/"
              aria-label="Coffee Sphut on Instagram"
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-secondary"
            >
              <Instagram className="size-5" />
            </a>
            <a
              href="https://www.linkedin.com/company/coffeesphut/"
              aria-label="Coffee Sphut on LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-secondary"
            >
              <Linkedin className="size-5" />
            </a>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">
          © 2026 Coffee Sphut. All rights reserved.{" "}
          <span className="ml-2">Sphut, pronounced “spot”.</span>
        </p>
      </footer>
    </div>
  );
}
