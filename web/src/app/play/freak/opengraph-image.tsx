import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE, OG_THEMES, QUIZ_META, getGradientBackground } from "@/lib/og";

export const runtime = "edge";
const quiz = QUIZ_META.freak_level;
export const alt = `${quiz.name} | ${BRAND.shortName}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const theme = OG_THEMES[quiz.theme];

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
          backgroundColor: theme.background,
          backgroundImage: getGradientBackground(quiz.theme),
        }}
      >
        {/* Logo Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 900,
              color: "#09090b",
            }}
          >
            {BRAND.shortName}
          </div>
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 96, marginBottom: 24 }}>{quiz.emoji}</div>

        {/* Title */}
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: theme.accent,
            margin: 0,
          }}
        >
          {quiz.name}
        </h1>

        {/* Question */}
        <p
          style={{
            fontSize: 32,
            color: theme.muted,
            margin: 0,
            marginTop: 20,
          }}
        >
          {quiz.question}
        </p>

        {/* Level tags */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            gap: 16,
          }}
        >
          {["🍦 Vanilla", "🌶️ Spicy", "🔥 Unhinged", "👹 Feral", "😈 Menace"].map((level) => (
            <div
              key={level}
              style={{
                padding: "10px 20px",
                backgroundColor: "rgba(217, 70, 239, 0.15)",
                borderRadius: 9999,
                color: "#d946ef",
                fontSize: 16,
              }}
            >
              {level}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
