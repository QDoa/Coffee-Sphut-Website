import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coffee Sphut | Discover Curated Coffee & Local Stores",
  description: "Coffee Sphut is your go-to platform for discovering curated coffee content and finding the best select coffee stores near you. Download now on iOS and Android.",
  keywords: ["coffee", "coffee discovery", "coffee shops", "local cafes", "coffee content", "Coffee Sphut"],
  authors: [{ name: "Coffee Sphut" }],
  metadataBase: new URL("https://coffeesphut.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Coffee Sphut | Discover Curated Coffee & Local Stores",
    description: "Discover curated coffee content and find your select coffee stores around you.",
    url: "https://coffeesphut.com",
    siteName: "Coffee Sphut",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/home.png",
        width: 1200,
        height: 630,
        alt: "Coffee Sphut App Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coffee Sphut | Discover Curated Coffee & Local Stores",
    description: "Discover curated coffee content and find your select coffee stores around you.",
    images: ["/images/home.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Coffee Sphut",
    "url": "https://coffeesphut.com",
    "description": "Discover curated coffee content and find your select coffee stores around you.",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "Coffee Sphut",
      "logo": "https://coffeesphut.com/icon.png"
    }
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
