import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/ui/section-header";
import { RotatingHero, SeriesCard } from "@/components/landing";
import { Logo } from "@/components/Logo";

// Fantasy target words for rotation - expandable for future "packs"
const FANTASY_TARGETS = ["crush", "K-pop bias", "hometown crush"];

const HOW_IT_WORKS = [
  "You're mid-conversation — the scene's already started.",
  "They remember everything — the callbacks, the inside jokes, the history.",
  "Every reply matters — silence feels like loss.",
];

// Server-side fetch for featured series
async function getFeaturedSeries() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com"}/series?featured=true&limit=6`,
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;
  const series = await getFeaturedSeries();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo - matching sidebar style */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden p-1.5">
              <Logo variant="icon" size="full" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight text-foreground">
                episode-0
              </h1>
              <p className="text-xs text-muted-foreground">3, 2, 1... action</p>
            </div>
          </Link>

          {/* Auth button */}
          {isLoggedIn ? (
            <Link
              href="/discover"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Continue →
            </Link>
          ) : (
            <Link
              href="/login?next=/discover"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12">
        {/* Hero with rotating fantasy target */}
        <RotatingHero targets={FANTASY_TARGETS} />

        {/* Series section */}
        {series.length > 0 && (
          <section id="series" className="space-y-4">
            <SectionHeader
              title="Play now"
              description="Find the one that won't leave your mind."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {series.map((s: { id: string; title: string; slug: string; tagline: string | null; total_episodes: number; cover_image_url: string | null; genre: string | null }) => (
                <SeriesCard
                  key={s.id}
                  title={s.title}
                  tagline={s.tagline}
                  episodeCount={s.total_episodes}
                  coverUrl={s.cover_image_url}
                  href={`/series/${s.slug}`}
                  genre={s.genre}
                />
              ))}
            </div>
            <div>
              <Link
                href="/login?next=/discover"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Explore all series →
              </Link>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="space-y-4">
          <SectionHeader title="How it works" />
          <div className="grid gap-3 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item} className="rounded-lg border bg-card p-4 text-sm text-foreground shadow-sm">
                <span className="mr-2 font-semibold text-primary">{i + 1}.</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
          <SectionHeader title="Privacy & Safety" />
          <p className="text-sm text-muted-foreground">
            Sign-in required to chat. Your conversations stay private. Characters and stories are fiction — enjoy responsibly.
          </p>
        </section>
      </main>

      <footer className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Logo variant="icon" size="sm" className="opacity-60" />
              <span className="text-sm text-muted-foreground">episode-0</span>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              {!isLoggedIn && (
                <Link href="/login?next=/discover" className="hover:text-foreground">
                  Sign in
                </Link>
              )}
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms of Service
              </Link>
              <Link href="/dmca" className="hover:text-foreground">
                DMCA
              </Link>
              <a
                href="https://tally.so/r/kd9Xgj"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Contact
              </a>
            </nav>
          </div>
          <div className="mt-6 border-t pt-6 text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} episode-0. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
