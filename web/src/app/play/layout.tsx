import type { Metadata } from "next";
import { BRAND } from "@/lib/og";

export const metadata: Metadata = {
  title: `Quizzes | ${BRAND.shortName}`,
  description: "Free personality quizzes. Discover your type, share with friends, compare results.",
  openGraph: {
    title: `Quizzes | ${BRAND.shortName}`,
    description: "Free personality quizzes. Discover your type, share with friends.",
    url: `${BRAND.url}/play`,
  },
  twitter: {
    card: "summary_large_image",
    title: `Quizzes | ${BRAND.shortName}`,
    description: "Free personality quizzes. Discover your type, share with friends.",
  },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
