import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/ui/section-header";
import { RotatingHero, SeriesCard, AvatarGallery } from "@/components/landing";
import { Logo } from "@/components/Logo";

// Server-side fetch for featured series
async function getFeaturedSeries() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com"}/series?featured=true&limit=6`,
      { next: { revalidate: 60 } }
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
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden p-1.5">
              <Logo variant="icon" size="full" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight text-foreground">
                episode-0
              </h1>
              <p className="text-xs text-muted-foreground">Your story awaits</p>
            </div>
          </Link>

          {/* Auth button */}
          {isLoggedIn ? (
            <Link
              href="/discover"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Continue
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
        {/* Hero with chat preview */}
        <RotatingHero />

        {/* Series section */}
        {series.length > 0 && (
          <section id="series" className="space-y-4">
            <SectionHeader
              title="Pick your story"
              description="Curated scenarios. Real emotional stakes. Choose one and step in."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {series.map(
                (s: {
                  id: string;
                  title: string;
                  slug: string;
                  tagline: string | null;
                  total_episodes: number;
                  cover_image_url: string | null;
                  genre: string | null;
                }) => (
                  <SeriesCard
                    key={s.id}
                    title={s.title}
                    tagline={s.tagline}
                    episodeCount={s.total_episodes}
                    coverUrl={s.cover_image_url}
                    href={`/series/${s.slug}`}
                    genre={s.genre}
                  />
                )
              )}
            </div>
            <div>
              <Link
                href="/login?next=/discover"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Explore all stories
              </Link>
            </div>
          </section>
        )}

        {/* Create Your Character section */}
        <section className="relative overflow-hidden rounded-2xl border bg-card">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-2 md:gap-8">
            {/* Left: Copy */}
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/50 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300">
                  Personalization
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Create your own character
              </h2>
              <p className="text-foreground/70">
                Design who you want to be. Choose your appearance, pick an archetype,
                and play any story as <span className="font-medium text-foreground">your</span> character.
              </p>
              <ul className="flex flex-col gap-2 text-sm text-foreground/70">
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-purple-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Custom appearance with AI-generated avatar
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-purple-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Choose your personality archetype
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-purple-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Play any episode as your character
                </li>
              </ul>
              <div className="pt-2">
                <Link
                  href="/login?next=/my-characters"
                  className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  Create character
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="flex items-center justify-center">
              <AvatarGallery />
            </div>
          </div>
        </section>

        {/* Social proof / Trust */}
        <section className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Join readers exploring interactive romance stories
          </p>
          <p className="text-xs text-muted-foreground/60">
            Free to play. No credit card required.
          </p>
        </section>

        {/* Privacy */}
        <section className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
          <SectionHeader title="Privacy & Safety" />
          <p className="text-sm text-muted-foreground">
            Sign-in required to chat. Your conversations stay private and are
            never used for training. Characters and stories are fiction — enjoy
            responsibly.
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
                <Link
                  href="/login?next=/discover"
                  className="hover:text-foreground"
                >
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
