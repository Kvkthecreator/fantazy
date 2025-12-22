import type { Metadata } from "next";
import { BRAND, QUIZ_META } from "@/lib/og";

const quiz = QUIZ_META.romantic_trope;

export const metadata: Metadata = {
  title: `${quiz.name} | ${BRAND.shortName}`,
  description: `${quiz.question} Discover your romantic type with the ${quiz.name} on ${BRAND.shortName}.`,
  openGraph: {
    title: `${quiz.name} | ${BRAND.shortName}`,
    description: `${quiz.question} Discover your romantic type.`,
    url: `${BRAND.url}${quiz.path}`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${quiz.name} | ${BRAND.shortName}`,
    description: `${quiz.question} Discover your romantic type.`,
  },
};

export default function RomanceQuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
