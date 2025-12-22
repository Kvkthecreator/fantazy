/**
 * Open Graph Configuration
 *
 * Centralized OG metadata and image generation config for ep-0.
 * This ensures consistent branding across all share surfaces.
 */

// =============================================================================
// BRAND CONSTANTS
// =============================================================================

export const BRAND = {
  name: "episode-0",
  shortName: "ep-0",
  tagline: "Relive fantasies with your favorite characters",
  description: "Free interactive stories with AI characters who remember. Your choices shape the story.",
  url: "https://ep-0.com",
  features: ["Free interactive stories", "AI characters who remember", "Your choices matter"],
} as const;

// =============================================================================
// OG IMAGE DIMENSIONS (Standard for social platforms)
// =============================================================================

export const OG_SIZE = {
  width: 1200,
  height: 630,
} as const;

// =============================================================================
// COLOR PALETTES FOR DIFFERENT CONTEXTS
// =============================================================================

export const OG_THEMES = {
  // Default brand theme (purple/indigo)
  default: {
    background: "#09090b",
    gradients: [
      { position: "25% 25%", color: "#1e1b4b" },
      { position: "75% 75%", color: "#4c1d95" },
    ],
    accent: "#a855f7",
    text: "#ffffff",
    muted: "#a1a1aa",
  },
  // Romance Quiz theme (amber/rose)
  romance: {
    background: "#0c0a09",
    gradients: [
      { position: "25% 25%", color: "#451a03" },
      { position: "75% 75%", color: "#4c0519" },
    ],
    accent: "#f59e0b",
    text: "#ffffff",
    muted: "#a1a1aa",
  },
  // Freak Test theme (fuchsia/purple)
  freak: {
    background: "#09090b",
    gradients: [
      { position: "25% 25%", color: "#4a044e" },
      { position: "75% 75%", color: "#581c87" },
    ],
    accent: "#d946ef",
    text: "#ffffff",
    muted: "#a1a1aa",
  },
  // Play/Quiz landing theme (rose/purple)
  play: {
    background: "#0c0a09",
    gradients: [
      { position: "25% 25%", color: "#4c0519" },
      { position: "75% 75%", color: "#4c1d95" },
    ],
    accent: "#ec4899",
    text: "#ffffff",
    muted: "#a1a1aa",
  },
} as const;

export type OGTheme = keyof typeof OG_THEMES;

// =============================================================================
// QUIZ TYPE METADATA (for share pages)
// =============================================================================

export const QUIZ_META = {
  romantic_trope: {
    name: "Romance Quiz",
    question: "What's your romantic trope?",
    shareQuestion: "What's your romantic trope?",
    theme: "romance" as OGTheme,
    emoji: "💕",
    path: "/play/romance",
  },
  freak_level: {
    name: "Freak Test",
    question: "How freaky are you?",
    shareQuestion: "How freaky are you?",
    theme: "freak" as OGTheme,
    emoji: "🔥",
    path: "/play/freak",
  },
  flirt_archetype: {
    name: "Flirt Test",
    question: "What's your flirt style?",
    shareQuestion: "What's your flirt style?",
    theme: "play" as OGTheme,
    emoji: "😏",
    path: "/play",
  },
} as const;

export type QuizType = keyof typeof QUIZ_META;

// =============================================================================
// HELPER: Generate background gradient CSS
// =============================================================================

export function getGradientBackground(theme: OGTheme = "default"): string {
  const t = OG_THEMES[theme];
  const gradientParts = t.gradients.map(
    (g) => `radial-gradient(circle at ${g.position}, ${g.color} 0%, transparent 50%)`
  );
  return gradientParts.join(", ");
}

// =============================================================================
// METADATA GENERATORS
// =============================================================================

export function getBaseMetadata() {
  return {
    metadataBase: new URL(BRAND.url),
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    icons: {
      icon: "/branding/ep0-icon.png",
      shortcut: "/branding/ep0-icon.png",
      apple: "/branding/ep0-icon.png",
    },
    openGraph: {
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: BRAND.description,
      url: BRAND.url,
      siteName: BRAND.name,
      locale: "en_US",
      type: "website" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: BRAND.description,
    },
  };
}

export function getQuizMetadata(quizType: QuizType) {
  const quiz = QUIZ_META[quizType];
  const title = `${quiz.name} | ${BRAND.shortName}`;
  const description = `${quiz.question} Take the ${quiz.name} on ${BRAND.shortName}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BRAND.url}${quiz.path}`,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}

export function getShareResultMetadata(
  quizType: QuizType,
  resultTitle: string,
  shareId: string
) {
  const quiz = QUIZ_META[quizType];
  const title = `${resultTitle} | ${quiz.name}`;
  const description = `I'm ${resultTitle}! ${quiz.shareQuestion} Take the ${quiz.name} on ${BRAND.shortName}.`;
  const url = `${BRAND.url}/r/${shareId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}
