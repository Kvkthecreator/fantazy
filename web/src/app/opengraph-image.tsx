import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE, OG_THEMES, getGradientBackground } from "@/lib/og";

export const runtime = "edge";
export const alt = `${BRAND.name} — Free AI stories that remember you`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const theme = OG_THEMES.default;

  // Fetch logo as base64 for edge runtime
  const logoUrl = new URL("/branding/ep0-icon.png", BRAND.url).toString();
  const logoResponse = await fetch(logoUrl);
  const logoBuffer = await logoResponse.arrayBuffer();
  const logoBase64 = `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;

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
          padding: 60,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <img
            src={logoBase64}
            alt="ep-0"
            width={100}
            height={100}
            style={{
              filter: "invert(1)", // White logo on dark background
            }}
          />
        </div>

        {/* Main Hook */}
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: theme.text,
            margin: 0,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Free AI stories that
        </h1>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: theme.accent,
            margin: 0,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          remember you
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 28,
            color: theme.muted,
            margin: 0,
            marginTop: 32,
            textAlign: "center",
          }}
        >
          Choose your story. Shape the ending.
        </p>

        {/* Value props as pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              borderRadius: 9999,
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
            <span style={{ color: "#a855f7", fontSize: 18, fontWeight: 600 }}>
              100% Free
            </span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              borderRadius: 9999,
            }}
          >
            <span style={{ color: "#a855f7", fontSize: 18, fontWeight: 600 }}>
              No sign-up required
            </span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              borderRadius: 9999,
            }}
          >
            <span style={{ color: "#a855f7", fontSize: 18, fontWeight: 600 }}>
              Characters remember
            </span>
          </div>
        </div>

        {/* Domain */}
        <p
          style={{
            fontSize: 20,
            color: "#52525b",
            margin: 0,
            marginTop: 48,
          }}
        >
          ep-0.com
        </p>
      </div>
    ),
    { ...size }
  );
}
