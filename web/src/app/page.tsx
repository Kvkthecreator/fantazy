import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/ui/section-header";

const FEATURED_MOMENTS = [
  {
    title: "Late Night at the Café",
    situation: "The shop is closed. She's still here. So are you.",
    character: "Luna",
    archetype: "Barista",
  },
  {
    title: "Rooftop After Hours",
    situation: "He found you up here again. Neither of you is surprised anymore.",
    character: "Kai",
    archetype: "Neighbor",
  },
  {
    title: "Last One in the Office",
    situation: "Everyone else went home. The deadline is tomorrow. She hasn't moved.",
    character: "Sora",
    archetype: "Coworker",
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
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-[-80px] h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute right-[-40px] top-10 h-72 w-72 rounded-full bg-accent/14 blur-3xl" />
        </div>
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <span className="text-lg font-semibold">Fantazy</span>
            </div>
            <Link
              href="/login?next=/discover"
              className="text-sm font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </header>

        <main className="relative mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
          {/* Hero - Episode-first messaging */}
          <section className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Interactive episodic experiences
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Step into moments that matter.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Choose a scene. The story begins now. AI characters who remember every chapter of your shared history.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login?next=/discover"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Start your story
              </Link>
              <Link
                href="#moments"
                className="rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:border-primary"
              >
                Preview moments
              </Link>
            </div>
          </section>

          {/* Featured Moments */}
          <section id="moments" className="space-y-6">
            <SectionHeader
              title="Featured moments"
              description="A taste of scenes waiting for you. Sign in to explore more."
            />
            <div className="grid gap-4 md:grid-cols-3">
              {FEATURED_MOMENTS.map((moment) => (
                <div
                  key={moment.title}
                  className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
                >
                  {/* Placeholder gradient background */}
                  <div className="aspect-[16/10] bg-gradient-to-br from-primary/20 via-accent/10 to-muted relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                      <p className="text-white/90 text-xs italic line-clamp-2">
                        &ldquo;{moment.situation}&rdquo;
                      </p>
                      <h4 className="font-semibold text-white text-sm">
                        {moment.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-semibold text-white">
                          {moment.character[0]}
                        </div>
                        <span className="text-xs text-white/70">
                          {moment.character} · {moment.archetype}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Link
                href="/login?next=/discover"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Explore all moments →
              </Link>
            </div>
          </section>

          {/* How it works */}
          <section className="space-y-4">
            <SectionHeader title="How it works" />
            <div className="grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map((item, i) => (
                <div key={item} className="rounded-lg border bg-card p-4 text-sm text-foreground shadow-sm">
                  <span className="text-primary font-semibold mr-2">{i + 1}.</span>
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
      </div>

      <footer className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>Fantazy — moments that matter.</span>
          <Link href="/login?next=/discover" className="font-semibold text-primary hover:underline">
            Start your story
          </Link>
        </div>
      </footer>
    </div>
  );
}
