/**
 * OG Image Components
 *
 * Reusable components for generating Open Graph images.
 * These use @vercel/og ImageResponse under the hood.
 */

import { OG_THEMES, OG_SIZE, BRAND, getGradientBackground, type OGTheme } from "./og";

// =============================================================================
// SHARED STYLES
// =============================================================================

const styles = {
  container: (theme: OGTheme) => ({
    height: "100%",
    width: "100%",
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: OG_THEMES[theme].background,
    backgroundImage: getGradientBackground(theme),
  }),
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontSize: 40,
    fontWeight: 900,
    color: "#09090b",
  },
  title: {
    fontSize: 72,
    fontWeight: 900,
    color: "#ffffff",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 32,
    color: "#a1a1aa",
    margin: 0,
    marginTop: 16,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#22c55e",
  },
  featureText: {
    color: "#71717a",
    fontSize: 20,
  },
  featureSeparator: {
    color: "#3f3f46",
    fontSize: 20,
  },
};

// =============================================================================
// DEFAULT BRAND OG IMAGE
// =============================================================================

export function BrandOGImage({ theme = "default" }: { theme?: OGTheme }) {
  return (
    <div style={styles.container(theme)}>
      {/* Logo Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
        }}
      >
        <div style={styles.logoBadge}>{BRAND.shortName}</div>
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
        <h1 style={styles.title}>{BRAND.name}</h1>
        <p style={styles.subtitle}>{BRAND.tagline}</p>
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
        <div style={styles.featureDot} />
        {BRAND.features.map((feature, i) => (
          <span key={feature}>
            <span style={styles.featureText}>{feature}</span>
            {i < BRAND.features.length - 1 && (
              <span style={{ ...styles.featureSeparator, marginLeft: 12, marginRight: 0 }}>•</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// QUIZ OG IMAGE
// =============================================================================

interface QuizOGImageProps {
  theme?: OGTheme;
  emoji: string;
  title: string;
  subtitle: string;
}

export function QuizOGImage({ theme = "play", emoji, title, subtitle }: QuizOGImageProps) {
  const t = OG_THEMES[theme];

  return (
    <div style={styles.container(theme)}>
      {/* Logo Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ ...styles.logoBadge, width: 60, height: 60, fontSize: 28 }}>
          {BRAND.shortName}
        </div>
      </div>

      {/* Emoji */}
      <div style={{ fontSize: 96, marginBottom: 24 }}>{emoji}</div>

      {/* Title */}
      <h1
        style={{
          ...styles.title,
          fontSize: 64,
          background: `linear-gradient(135deg, ${t.accent}, ${t.text})`,
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {title}
      </h1>

      {/* Subtitle */}
      <p style={{ ...styles.subtitle, fontSize: 28, marginTop: 20 }}>{subtitle}</p>
    </div>
  );
}

// =============================================================================
// SHARE RESULT OG IMAGE
// =============================================================================

interface ShareResultOGImageProps {
  theme?: OGTheme;
  emoji: string;
  resultTitle: string;
  quizName: string;
  tagline?: string;
}

export function ShareResultOGImage({
  theme = "default",
  emoji,
  resultTitle,
  quizName,
  tagline,
}: ShareResultOGImageProps) {
  const t = OG_THEMES[theme];

  return (
    <div style={styles.container(theme)}>
      {/* Top: Quiz name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div style={{ ...styles.logoBadge, width: 48, height: 48, fontSize: 22 }}>
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
  );
}

export { OG_SIZE };
