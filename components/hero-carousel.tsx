"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HERO_IMAGES = [
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/home.png",
    alt: "Coffee Sphut app home screen showing curated articles and coffee feeds",
    caption: "Curated Feed & Stories",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/map.png",
    alt: "Coffee Sphut map showing nearby specialty coffee stores",
    caption: "Interactive Store Locator",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/reward.png",
    alt: "Coffee Sphut digital loyalty rewards program",
    caption: "Digital Stamp Card",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/account.png",
    alt: "Coffee Sphut user account and bookmarks screen",
    caption: "Saved Spots & Rewards",
  },
];

export function HeroCarousel() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Respect user's motion preference (WCAG 2.2.2 & 2.3.3)
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion || isPaused) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % HERO_IMAGES.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="App preview carousel"
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 -m-8 rounded-full bg-primary/15 blur-3xl -z-10 pointer-events-none" />

      {/* Realistic Smartphone Frame */}
      <div className="relative rounded-[3rem] p-3 bg-neutral-950/90 shadow-2xl ring-1 ring-neutral-800/80 backdrop-blur-sm transition-transform duration-500 hover:scale-[1.02]">
        {/* Dynamic Island / Speaker Pill */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 h-4 w-20 bg-black rounded-full z-20 flex items-center justify-end pr-2 pointer-events-none">
          <div className="size-2 rounded-full bg-neutral-900 border border-neutral-800" />
        </div>

        {/* Inner Screen Display */}
        <div className="relative h-[530px] w-[255px] sm:h-[580px] sm:w-[280px] overflow-hidden rounded-[2.3rem] bg-neutral-900">
          {HERO_IMAGES.map((image, index) => (
            <Image
              key={image.src}
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 255px, 280px"
              className={`absolute inset-0 object-cover transition-opacity duration-700 ease-in-out ${
                index === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
              priority={index === 0}
            />
          ))}
        </div>
      </div>

      {/* Navigation Dots and Slide Status */}
      <div className="mt-5 flex items-center gap-2">
        {HERO_IMAGES.map((image, index) => {
          const isActive = index === currentImageIndex;
          return (
            <button
              key={image.src}
              onClick={() => setCurrentImageIndex(index)}
              className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive ? "w-8 bg-primary" : "w-2.5 bg-primary/30 hover:bg-primary/50"
              }`}
              aria-label={`Go to slide ${index + 1}: ${image.caption}`}
              aria-current={isActive ? "true" : undefined}
              type="button"
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground font-medium">
        {HERO_IMAGES[currentImageIndex].caption}
      </p>
    </div>
  );
}
