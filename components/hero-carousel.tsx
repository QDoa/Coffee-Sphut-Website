"use client";

import Image from "next/image";
import { BookOpen, MapPin, Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PREVIEWS = [
  {
    id: "discover",
    label: "Find a café",
    icon: MapPin,
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/map.png",
    alt: "Coffee Sphut map of cafés",
    title: "A new spot, just around the corner.",
    description: "Explore cafés on the map and find your way to your next cup.",
  },
  {
    id: "read",
    label: "Coffee stories",
    icon: BookOpen,
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/home.png",
    alt: "Coffee Sphut feed of coffee stories and brewing guides",
    title: "Something good to read with your coffee.",
    description:
      "Discover coffee stories, brewing ideas, and a little inspiration for your daily ritual.",
  },
  {
    id: "save",
    label: "Your favourites",
    icon: Bookmark,
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/account.png",
    alt: "Coffee Sphut account and saved favourites",
    title: "Keep the good finds close.",
    description:
      "Save the spots and stories you want to come back to in the app.",
  },
];

export function HeroCarousel() {
  return (
    <Tabs
      defaultValue="discover"
      className="w-full gap-0 overflow-hidden rounded-2xl border border-border bg-secondary/45"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          A look inside the app
        </span>
      </div>
      <TabsList
        aria-label="Explore app features"
        className="mx-3 mt-4 grid w-auto grid-cols-3 gap-1 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto sm:mx-5"
      >
        {PREVIEWS.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="h-auto min-h-11 rounded-full px-2 text-[11px] data-[state=active]:bg-foreground data-[state=active]:text-background [&_svg]:hidden sm:text-sm sm:[&_svg]:block"
          >
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {PREVIEWS.map((preview) => (
        <TabsContent
          key={preview.id}
          value={preview.id}
          className="px-5 pt-6 pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:px-7"
        >
          <div className="min-h-32 max-w-sm">
            <h2 className="font-serif text-2xl leading-tight tracking-tight sm:text-3xl">
              {preview.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {preview.description}
            </p>
          </div>
          <figure className="mx-auto mt-6 w-full max-w-[232px] sm:max-w-[248px]">
            {/* Hosted previews already include the iPhone frame. */}
            <Image
              src={preview.src}
              alt={preview.alt}
              width={1170}
              height={2532}
              sizes="(min-width: 640px) 248px, 232px"
              priority={preview.id === "discover"}
              className="block h-auto w-full drop-shadow-xl"
            />
          </figure>
        </TabsContent>
      ))}
    </Tabs>
  );
}
