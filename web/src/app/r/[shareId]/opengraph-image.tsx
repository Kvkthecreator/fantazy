import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE, OG_THEMES, QUIZ_META, getGradientBackground, type QuizType } from "@/lib/og";

export const runtime = "edge";
export const alt = "Quiz Result";
export const size = OG_SIZE;
export const contentType = "image/png";

// Emoji mapping for result types
const RESULT_EMOJI: Record<string, string> = {
  // Romantic Tropes
  slow_burn: "🕯️",
  second_chance: "🌅",
  all_in: "💫",
  push_pull: "⚡",
  slow_reveal: "🌙",
  // Flirt Archetypes
  tension_builder: "🔥",
  bold_mover: "💪",
  playful_tease: "😏",
  mysterious_allure: "✨",
  // Freak Levels
  vanilla: "🍦",
  spicy: "🌶️",
  unhinged: "🔥",
  feral: "👹",
  menace: "😈",
};

interface Props {
  params: Promise<{ shareId: string }>;
}

export default async function Image({ params }: Props) {
  const { shareId } = await params;

  // Fetch result data
  let resultTitle = "Quiz Result";
  let tagline = "";
  let emoji = "✨";
  let quizName = "Quiz";
  let theme: keyof typeof OG_THEMES = "default";

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
    const response = await fetch(`${apiUrl}/games/r/${shareId}`, {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const data = await response.json();
      const result = data.result || {};
      const evalType = data.evaluation_type as QuizType;

      // Get result-specific data
      resultTitle = result.title || "Quiz Result";
      tagline = result.tagline || "";

      // Determine emoji from result type
      const resultKey = result.trope || result.level || result.archetype;
      if (resultKey && RESULT_EMOJI[resultKey]) {
        emoji = RESULT_EMOJI[resultKey];
      }

      // Get quiz metadata
      if (evalType && QUIZ_META[evalType]) {
        const quizMeta = QUIZ_META[evalType];
        quizName = quizMeta.name;
        theme = quizMeta.theme;
      }
    }
  } catch {
    // Use defaults on error
  }

  const t = OG_THEMES[theme];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.background,
          backgroundImage: getGradientBackground(theme),
        }}
      >
        {/* Top: Quiz name badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 900,
              color: "#09090b",
            }}
          >
            {BRAND.shortName}
          </div>
          <span style={{ color: "#71717a", fontSize: 24 }}>{quizName}</span>
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 120, marginBottom: 24 }}>{emoji}</div>

        {/* Result Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: t.accent,
            margin: 0,
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          {resultTitle}
        </h1>

        {/* Tagline */}
        {tagline && (
          <p
            style={{
              fontSize: 24,
              color: "#a1a1aa",
              margin: 0,
              marginTop: 16,
              fontStyle: "italic",
              textAlign: "center",
              maxWidth: "70%",
            }}
          >
            &ldquo;{tagline}&rdquo;
          </p>
        )}

        {/* CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            padding: "16px 32px",
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 9999,
          }}
        >
          <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 600 }}>
            Take the quiz at {BRAND.shortName}.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
