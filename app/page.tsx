import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarPlus,
  Clock,
  Database,
  Instagram,
  Linkedin,
  MapPin,
  Newspaper,
  Users,
  Video,
} from "lucide-react";
import { HeroCarousel } from "@/components/hero-carousel";
import { SectionReveal } from "@/components/section-reveal";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrackedLink } from "@/components/tracked-link";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  currentPartners,
  jobPostings,
  upcomingEvents,
  userFAQs,
  vendorBenefits,
  vendorFAQs,
} from "./constants";

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
                src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/home.png"
                alt="Coffee Sphut home feed with articles"
                width={250}
                height={541}
                className="rounded-[2rem] transition-transform duration-700 ease-in-out hover:scale-110"
              />
              <h3 className="mt-6 text-xl font-semibold text-foreground">Discover Content</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Browse expertly curated articles and guides
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Image
                src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/map.png"
                alt="Coffee Sphut map showing nearby coffee stores"
                width={250}
                height={541}
                className="rounded-[2rem] transition-transform duration-700 ease-in-out hover:scale-110"
              />
              <h3 className="mt-6 text-xl font-semibold text-foreground">Find Stores</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Locate select coffee stores with interactive maps
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Image
                src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/account.png"
                alt="Coffee Sphut account screen"
                width={250}
                height={541}
                className="rounded-[2rem] transition-transform duration-700 ease-in-out hover:scale-110"
              />
              <h3 className="mt-6 text-xl font-semibold text-foreground">Save Favourites</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Bookmark articles and store for quick access
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Events Section */}
      {upcomingEvents.length > 0 && (
        <section id="events" className="border-b border-border bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge variant="secondary" className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Community & Gatherings
              </Badge>
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Upcoming Events
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
                Connect with the coffee community, discover what we&apos;re building, and join conversations shaping the future of coffee culture.
              </p>
            </div>

            <div className="mt-12 space-y-8">
              {upcomingEvents.map((event) => (
                <Card
                  key={event.id}
                  className="overflow-hidden border-border bg-background shadow-sm transition-all hover:shadow-md"
                >
                  <CardContent className="p-0">
                    <div className="grid gap-0 lg:grid-cols-12">
                      {/* Event Poster / Image */}
                      <div className="relative aspect-square lg:aspect-auto lg:col-span-5 bg-muted/30 overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-6">
                        <div className="relative w-full max-w-[420px] aspect-square overflow-hidden rounded-2xl border border-border/50 shadow-sm">
                          <Image
                            src={event.image}
                            alt={event.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 420px"
                            className="object-cover transition-transform duration-500 hover:scale-105"
                            priority
                          />
                          {event.badge && (
                            <div className="absolute top-3.5 left-3.5 z-10">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-md px-3 py-1 text-xs font-semibold text-primary shadow-sm border border-border/50">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                {event.badge}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Event Details */}
                      <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {event.isVirtual && (
                              <Badge variant="outline" className="text-xs font-medium border-primary/20 text-primary bg-primary/5">
                                <Video className="mr-1 h-3.5 w-3.5" />
                                Virtual Event
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs font-medium">
                              Free Registration
                            </Badge>
                          </div>

                          <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {event.title}
                          </h3>
                          {event.tagline && (
                            <p className="mt-1 text-base font-medium text-primary">
                              {event.tagline}
                            </p>
                          )}

                          {/* Quick details pills */}
                          <div className="mt-6 flex flex-wrap gap-3">
                            <div className="flex flex-1 min-w-[210px] items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="text-sm font-semibold text-foreground">{event.date}</p>
                              </div>
                            </div>

                            <div className="flex flex-1 min-w-[170px] items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Time</p>
                                <p className="text-sm font-semibold text-foreground">{event.time}</p>
                              </div>
                            </div>

                            <div className="flex flex-1 min-w-[210px] items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Location</p>
                                <p className="text-sm font-semibold text-foreground">{event.location}</p>
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="mt-6 text-sm sm:text-base leading-relaxed text-muted-foreground">
                            {event.description}
                          </p>

                          {/* Target Audience */}
                          {event.targetAudience && event.targetAudience.length > 0 && (
                            <div className="mt-6">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Who Should Attend
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {event.targetAudience.map((audience, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded-md bg-muted px-2.5 py-1 text-xs text-foreground/80"
                                  >
                                    {audience}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CTA Buttons */}
                        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-border">
                          <TrackedLink
                            href={event.registrationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            eventName="Event Registration"
                            className="flex-1 sm:flex-initial"
                          >
                            <Button size="lg" className="w-full sm:w-auto text-base gap-2">
                              <span>Register Now</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </TrackedLink>

                          {event.googleCalendarUrl && (
                            <TrackedLink
                              href={event.googleCalendarUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              eventName="Event Add to Calendar"
                              className="flex-1 sm:flex-initial"
                            >
                              <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto text-base gap-2 border-border"
                              >
                                <CalendarPlus className="h-4 w-4" />
                                <span>Add to Calendar</span>
                              </Button>
                            </TrackedLink>
                          )}

                          {event.instagramPostLink && (
                            <TrackedLink
                              href={event.instagramPostLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              eventName="Event Instagram Post"
                              className="flex-1 sm:flex-initial"
                            >
                              <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto text-base gap-2 border-border"
                              >
                                <Instagram className="h-4 w-4" />
                                <span>View on Instagram</span>
                              </Button>
                            </TrackedLink>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <TrackedLink
              href="https://docs.google.com/forms/d/e/1FAIpQLSf0NIlA7OQJWSNzjjKGbE1CInV9Ff5MQI65y5IN8yDXBRHITg/viewform"
              target="_blank"
              rel="noopener noreferrer"
              eventName="Signup"
            >
              <Button size="lg" className="text-base">
                Join Our Partner Network
              </Button>
            </TrackedLink>
          </div>
        </div>
      </section>
      
      {/* Current Cafes on the App Section */}
      <section id="cafes" className="border-b border-border bg-background py-16 sm:py-24">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Current Partners on Coffee Sphut
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            A selection of the amazing cafés already on Coffee Sphut.
          </p>
          <div className="relative flex w-full py-8 flex-col items-center justify-center overflow-hidden
                        [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
            <Marquee className="[--duration:15s]">
              {currentPartners.slice(0, 4).map((partner, index) => (
                <div className="px-16" key={index}>
                  <Image
                    src={partner.logo}
                    alt={`${partner.name} logo`}
                    width={192}
                    height={192}
                  />
                </div>
              ))}
            </Marquee>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            More cafés are joining every week, so stay tuned for updates and new additions to our growing community of coffee shops.
          </p>
        </div>
      </section>


      {/* FAQs Section */}
      <section id="FAQs" className="border-b border-border bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-card-foreground sm:text-4xl lg:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              Everything you need to know about using Coffee Sphut and joining our partner network.
            </p>
          </div>

          <Tabs defaultValue="consumers" className="w-full mt-10">
            <div className="flex justify-center">
              <TabsList className="h-11 p-1 bg-muted rounded-full">
                <TabsTrigger value="consumers" className="rounded-full px-5 text-sm font-medium">
                  For Coffee Lovers
                </TabsTrigger>
                <TabsTrigger value="partners" className="rounded-full px-5 text-sm font-medium">
                  For Café Partners
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="consumers" className="mt-8">
              <Accordion type="single" collapsible className="w-full">
                {userFAQs.map((faq, index) => (
                  <AccordionItem value={`user-${index}`} key={index}>
                    <AccordionTrigger className="text-left font-medium text-foreground">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="partners" className="mt-8">
              <Accordion type="single" collapsible className="w-full">
                {vendorFAQs.map((faq, index) => (
                  <AccordionItem value={`vendor-${index}`} key={index}>
                    <AccordionTrigger className="text-left font-medium text-foreground">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
            <ThemeToggle className="border-transparent bg-transparent shadow-none" />
                ))}
              </Accordion>
            </TabsContent>
          </Tabs>
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
            <TrackedLink
              href="https://apps.apple.com/us/app/coffee-sphut/id6759900667"
              target="_blank"
              rel="noopener noreferrer"
              eventName="Download"
            >
              <Button size="lg" variant="secondary" className="w-48 text-base">
                <Image
                  src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/apple_logo.png"
                  alt="Apple logo"
                  width={24}
                  height={24}
                />
                Get on iOS!
              </Button>
            </TrackedLink>
            <TrackedLink
              href="https://play.google.com/store/apps/details?id=com.coffeesphut.app"
              target="_blank"
              rel="noopener noreferrer"
              eventName="Download"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-48 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base"
              >
                <Image
                  src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/play_store.png"
                  alt="Google Play Store logo"
                  width={24}
                  height={24}
                />
                Get on Android!
              </Button>
            </TrackedLink>
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
                         <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                       </div>
                     </div>
                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                       {job.type}
                     </span>
                   </div>
                   <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
                     <div className="flex items-center text-primary">
                       <MapPin className="h-6 w-6 text-primary" />
                       {job.location}
                     </div>
                   </div>
                   <div className="mt-6">
                     <a href={job.jobDescriptionLink} download={`Job_Description_${job.title.replace(/\s+/g, "_")}.pdf`}>
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
                  alt="Coffee Sphut"
                  width={100}
                  height={20}
                  priority
                />
              </div>
              <span className="text-lg font-bold text-card-foreground">Coffee Sphut</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Coffee Sphut. All rights reserved.</p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center">
              <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
                <Link href="/stores" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                  Find Cafés
                </Link>
                <Link href="/#events" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                  Events
                </Link>
                <Link href="/#partners" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                  Partners
                </Link>
                <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                  Privacy Policy
                </Link>
              </div>
              <div className="flex gap-4">
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
