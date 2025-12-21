import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "episode-0 — Relive fantasies with your favorite characters",
  description: "Free interactive stories with AI characters who remember. Your choices shape the story.",
  metadataBase: new URL("https://ep-0.com"),
  icons: {
    icon: "/branding/ep0-icon.png",
    shortcut: "/branding/ep0-icon.png",
    apple: "/branding/ep0-icon.png",
  },
  openGraph: {
    title: "episode-0 — Relive fantasies with your favorite characters",
    description: "Free interactive stories with AI characters who remember. Your choices shape the story.",
    url: "https://ep-0.com",
    siteName: "episode-0",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "episode-0 — Relive fantasies with your favorite characters",
    description: "Free interactive stories with AI characters who remember. Your choices shape the story.",
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
