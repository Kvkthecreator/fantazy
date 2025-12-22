import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE, OG_THEMES, getGradientBackground } from "@/lib/og";

export const runtime = "edge";
export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const theme = OG_THEMES.default;

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
          backgroundImage: getGradientBackground("default"),
        }}
      >
        {/* Logo Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 900,
              color: "#09090b",
            }}
          >
            {BRAND.shortName}
          </div>
        </div>

        {/* Main Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: theme.text,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {BRAND.name}
          </h1>
          <p
            style={{
              fontSize: 32,
              color: theme.muted,
              margin: 0,
              marginTop: 16,
            }}
          >
            {BRAND.tagline}
          </p>
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#22c55e",
            }}
          />
          <span style={{ color: "#71717a", fontSize: 20 }}>
            {BRAND.features[0]}
          </span>
          <span style={{ color: "#3f3f46", fontSize: 20 }}>•</span>
          <span style={{ color: "#71717a", fontSize: 20 }}>
            {BRAND.features[1]}
          </span>
          <span style={{ color: "#3f3f46", fontSize: 20 }}>•</span>
          <span style={{ color: "#71717a", fontSize: 20 }}>
            {BRAND.features[2]}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
