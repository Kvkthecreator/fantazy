import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "episode-0 — Interactive Episodes";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
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
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #1e1b4b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #4c1d95 0%, transparent 50%)",
        }}
      >
        {/* Logo/Brand Mark */}
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
            ep-0
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
              color: "#ffffff",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            episode-0
          </h1>
          <p
            style={{
              fontSize: 32,
              color: "#a1a1aa",
              margin: 0,
              marginTop: 16,
            }}
          >
            Relive fantasies with your favorite characters
          </p>
        </div>

        {/* Tagline */}
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
            Free interactive stories
          </span>
          <span style={{ color: "#3f3f46", fontSize: 20 }}>•</span>
          <span style={{ color: "#71717a", fontSize: 20 }}>
            AI characters who remember
          </span>
          <span style={{ color: "#3f3f46", fontSize: 20 }}>•</span>
          <span style={{ color: "#71717a", fontSize: 20 }}>
            Your choices matter
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
