import { Metadata } from "next";
import { ShareResultClient } from "./ShareResultClient";

interface Props {
  params: Promise<{ shareId: string }>;
}

// Generate metadata for OG tags
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;

  // Default metadata
  const defaultMeta: Metadata = {
    title: "Flirt Test Result | ep-0",
    description: "Discover your flirt archetype with the Flirt Test on ep-0.com",
    openGraph: {
      title: "Flirt Test Result",
      description: "Discover your flirt archetype with the Flirt Test",
      images: ["/branding/og-flirt-test.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "Flirt Test Result",
      description: "Discover your flirt archetype with the Flirt Test",
    },
  };

  try {
    // Fetch result data for dynamic metadata
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
    const response = await fetch(`${apiUrl}/games/r/${shareId}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return defaultMeta;
    }

    const data = await response.json();
    const result = data.result;
    const title = result?.title || "Flirt Test Result";
    const archetype = result?.archetype?.replace(/_/g, " ") || "";

    return {
      title: `${title} | Flirt Test`,
      description: `I'm ${title}! What's your flirt style? Take the Flirt Test on ep-0.com`,
      openGraph: {
        title: `${title} - Flirt Test`,
        description: `I'm ${title} (${archetype})! What's your flirt style?`,
        images: ["/branding/og-flirt-test.png"],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} - Flirt Test`,
        description: `I'm ${title}! What's your flirt style?`,
      },
    };
  } catch (err) {
    console.error("Failed to fetch share metadata:", err);
    return defaultMeta;
  }
}

export default async function ShareResultPage({ params }: Props) {
  const { shareId } = await params;
  return <ShareResultClient shareId={shareId} />;
}
