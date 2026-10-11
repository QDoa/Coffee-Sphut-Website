"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

const HERO_IMAGES = [
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/home.png",
    alt: "Coffee Sphut app home screen showing coffee content",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/map.png",
    alt: "Coffee Sphut map showing nearby coffee stores",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/reward.png",
    alt: "Coffee Sphut reward program",
  },
  {
    src: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/account.png",
    alt: "Coffee Sphut account screen",
  },
]

export function HeroCarousel() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % HERO_IMAGES.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [currentImageIndex])

  return (
    <div className="relative">
      <div className="absolute inset-0 -m-12 rounded-full bg-primary/5 blur-3xl"></div>
      <div className="relative h-162.5 w-75 overflow-hidden">
        {HERO_IMAGES.map((image, index) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt}
            width={300}
            height={650}
            className={`absolute left-0 top-0 z-10 rounded-[2.5rem] transition-opacity duration-700 ease-in-out ${
              index === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
            priority={index === 0}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {HERO_IMAGES.map((image, index) => (
          <button
            key={image.src}
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
  )
}
