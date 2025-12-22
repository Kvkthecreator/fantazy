import { Metadata } from "next";
import { ShareResultClient } from "./ShareResultClient";
import { BRAND, QUIZ_META, type QuizType } from "@/lib/og";

interface Props {
  params: Promise<{ shareId: string }>;
}

// Generate metadata for OG tags
// Note: OG images are generated dynamically via opengraph-image.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;

  // Default metadata
  const defaultMeta: Metadata = {
    title: `Quiz Result | ${BRAND.shortName}`,
    description: `Discover your type with quizzes on ${BRAND.shortName}.com`,
    openGraph: {
      title: "Quiz Result",
      description: `Take a quiz on ${BRAND.shortName}`,
    },
    twitter: {
      card: "summary_large_image",
      title: "Quiz Result",
      description: `Take a quiz on ${BRAND.shortName}`,
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
    const result = data.result || {};
    const evalType = data.evaluation_type as QuizType;
    const resultTitle = result.title || "Quiz Result";

    // Get quiz-specific metadata
    const quizMeta = QUIZ_META[evalType] || QUIZ_META.flirt_archetype;
    const title = `${resultTitle} | ${quizMeta.name}`;
    const description = `I'm ${resultTitle}! ${quizMeta.shareQuestion} Take the ${quizMeta.name} on ${BRAND.shortName}.com`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BRAND.url}/r/${shareId}`,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
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
