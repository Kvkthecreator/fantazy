import type { MetadataRoute } from "next";

const BASE_URL = "https://ep-0.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/play`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/play/romance`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/play/freak`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic series pages
  let seriesPages: MetadataRoute.Sitemap = [];

  try {
    const res = await fetch(`${API_URL}/series?status=active`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (res.ok) {
      const series = await res.json();
      seriesPages = series.map(
        (s: { slug: string; updated_at?: string }) => ({
          url: `${BASE_URL}/series/${s.slug}`,
          lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.9,
        })
      );
    }
  } catch {
    // Continue without series pages if API fails
  }

  return [...staticPages, ...seriesPages];
}
