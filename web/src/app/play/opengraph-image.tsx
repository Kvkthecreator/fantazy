import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE, OG_THEMES, getGradientBackground } from "@/lib/og";

export const runtime = "edge";
export const alt = `Quizzes | ${BRAND.shortName}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const theme = OG_THEMES.play;

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
          backgroundImage: getGradientBackground("play"),
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

        {/* Emojis */}
        <div style={{ fontSize: 80, marginBottom: 24, display: "flex", gap: 24 }}>
          <span>💕</span>
          <span>😈</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: theme.text,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Pick Your Quiz
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 28,
            color: theme.muted,
            margin: 0,
            marginTop: 20,
          }}
        >
          Discover your type. Share with friends.
        </p>

        {/* Features */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            gap: 24,
          }}
        >
          <div
            style={{
              padding: "12px 24px",
              backgroundColor: "rgba(236, 72, 153, 0.2)",
              borderRadius: 9999,
              color: "#ec4899",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            Romance Quiz
          </div>
          <div
            style={{
              padding: "12px 24px",
              backgroundColor: "rgba(217, 70, 239, 0.2)",
              borderRadius: 9999,
              color: "#d946ef",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            Freak Test
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
