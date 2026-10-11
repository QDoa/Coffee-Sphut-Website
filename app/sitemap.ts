import { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: "https://coffeesphut.com",
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://coffeesphut.com/stores",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://coffeesphut.com/privacy",
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
