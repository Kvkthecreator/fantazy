import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/ui/section-header";
import { EpisodeCard } from "@/components/episodes";

const FEATURED_MOMENTS = [
  {
    title: "Episode 0 · Late Night at the Café",
    situation: "The shop is closed. She's still here. So are you.",
    character: "Mira",
    archetype: "Barista",
    href: "/login?next=/discover",
    imageUrl: "/playground-assets/classroom-bg.jpg",
  },
  {
    title: "Episode 0 · Rooftop After Hours",
    situation: "He found you up here again. Neither of you is surprised anymore.",
    character: "Kai",
    archetype: "Neighbor",
    href: "/login?next=/discover",
    imageUrl: "/playground-assets/classroom-bg.jpg",
  },
  {
    title: "Episode 0 · Last One in the Office",
    situation: "Everyone else went home. The deadline is tomorrow. She hasn't moved.",
    character: "Sora",
    archetype: "Coworker",
    href: "/login?next=/discover",
    imageUrl: "/playground-assets/classroom-bg.jpg",
  },
];

const HOW_IT_WORKS = [
  "Episodes are moments — step into a scene already in motion.",
  "Characters remember your story — callbacks, inside jokes, shared history.",
  "Every reply matters — silence feels like loss.",
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/discover");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/branding/ep0-wordmark.svg"
              alt="ep-0"
              className="h-10 w-auto"
            />
          </Link>
          <Link
            href="/login?next=/discover"
            className="text-sm font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border bg-card shadow-lg">
          <div className="absolute inset-0">
            <img
              src="/playground-assets/classroom-bg.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/10" />
          </div>
          <div className="relative z-10 flex flex-col gap-4 p-8 sm:p-10 text-white drop-shadow-md">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              Episode-first · In media res
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Play Episode 0. The story begins now.
              </h1>
              <p className="max-w-2xl text-lg text-white/90">
                Instant hooks, sequential progression, and characters who remember every chapter you share.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login?next=/discover"
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Start Episode 0
              </Link>
              <Link
                href="#episode0"
                className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/70"
              >
                Preview scenes
              </Link>
            </div>
          </div>
        </section>

        {/* Episode 0 rail */}
        <section id="episode0" className="space-y-4">
          <SectionHeader
            title="Episode 0 · Play now"
            description="Entry episodes are the sharpest hooks. Choose a scene and jump in."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURED_MOMENTS.map((moment) => (
              <EpisodeCard
                key={moment.title}
                title={moment.title}
                subtitle={`${moment.character} · ${moment.archetype}`}
                hook={moment.situation}
                badge="Episode 0"
                href={moment.href}
                imageUrl={moment.imageUrl}
                meta="In media res • Immediate stakes"
                ctaText="Play Episode 0"
              />
            ))}
          </div>
          <div>
            <Link
              href="/login?next=/discover"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Explore all episodes →
            </Link>
          </div>
        </section>

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>ep-0 — moments that matter.</span>
          <Link href="/login?next=/discover" className="font-semibold text-primary hover:underline">
            Start your story
          </Link>
        </div>
      </footer>
    </div>
  );
}
