import type { Metadata } from "next";
import { BRAND } from "@/lib/og";
import SeriesPageClient from "./SeriesPageClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com";

// Server-side metadata generation for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const res = await fetch(`${API_URL}/series?status=active`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("Failed to fetch");

    const allSeries = await res.json();
    const series = allSeries.find((s: { slug: string }) => s.slug === slug);

    if (series) {
      const title = `${series.title} | ${BRAND.shortName}`;
      const description = series.tagline || series.description || BRAND.description;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `${BRAND.url}/series/${slug}`,
          images: series.cover_image_url ? [{ url: series.cover_image_url }] : undefined,
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
        },
      };
    }
  } catch {
    // Fall back to default metadata
  }

  return {
    title: `Series | ${BRAND.shortName}`,
    description: BRAND.description,
  };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function SeriesPage({ params }: PageProps) {
  return <SeriesPageClient params={params} />;
}
