import type { Metadata } from "next";
import { BRAND, QUIZ_META } from "@/lib/og";

const quiz = QUIZ_META.freak_level;

export const metadata: Metadata = {
  title: `${quiz.name} | ${BRAND.shortName}`,
  description: `${quiz.question} Find out where you fall on the spectrum with the ${quiz.name} on ${BRAND.shortName}.`,
  openGraph: {
    title: `${quiz.name} | ${BRAND.shortName}`,
    description: `${quiz.question} Find out your true chaos tier.`,
    url: `${BRAND.url}${quiz.path}`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${quiz.name} | ${BRAND.shortName}`,
    description: `${quiz.question} Find out your true chaos tier.`,
  },
};

export default function FreakQuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
