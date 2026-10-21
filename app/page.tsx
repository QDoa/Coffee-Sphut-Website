import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Calendar,
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
import { SiteHeader } from "@/components/site-header";
import { TrackedLink } from "@/components/tracked-link";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";
import { currentPartners, jobPostings, upcomingEvents, vendorBenefits, vendorFAQs } from "./constants";

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      
      {/* Hero Section */}
      <section id="hero" className="relative overflow-hidden border-b border-border bg-background">
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
            </div>
            <div className="relative flex items-center justify-center lg:justify-end">
              <HeroCarousel />
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

          <div className="mt-16 grid gap-8 sm:grid-cols-1 lg:grid-cols-4">
            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Simplify Café Discovery</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Make it easy for users to find, explore, and choose cafés and coffee shops around them.
                </p>
              </CardContent>
            </Card>


            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Newspaper className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Deliver Curated Coffee Content</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Provide relevant, curated content that educates and inspires both new and seasoned coffee drinkers.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Strengthen Customer Retention</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Offer digital loyalty tools that help cafés turn occasional visitors into repeat customers.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-background">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">Build a Reliable Data Foundation</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Create reliable data that supports cafés, brands, and investors.
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
                      <div className="relative aspect-square lg:aspect-auto lg:col-span-5 bg-muted/40 overflow-hidden flex items-center justify-center">
                        <Image
                          src={event.image}
                          alt={event.title}
                          width={640}
                          height={640}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                          priority
                        />
                        {event.badge && (
                          <div className="absolute top-4 left-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-md px-3 py-1 text-xs font-semibold text-primary shadow-sm border border-border/50">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              {event.badge}
                            </span>
                          </div>
                        )}
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
                          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="text-sm font-semibold text-foreground truncate">{event.date}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">Time</p>
                                <p className="text-sm font-semibold text-foreground truncate">{event.time}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">Location</p>
                                <p className="text-sm font-semibold text-foreground truncate">{event.location}</p>
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
              href="https://docs.google.com/forms/d/e/1FAIpQLSf0NIlA7OQJWSNzjjKGbE1CInV9Ff5MQI65y5IN8yDXBRHITg/viewform?usp=publish-editor"
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
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            FAQs
          </h2>
          <h3 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
            For Partners
          </h3>
          <Accordion type="single" collapsible className="w-full mt-6">
          {vendorFAQs.map((faq, index) => (
            <AccordionItem value={'item'+index.toString()} key={index}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
          </Accordion>
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
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex gap-6">
                <a href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
                  Privacy Policy
                </a>
                <a href="#partners" className="text-sm text-muted-foreground transition-colors hover:text-card-foreground">
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
