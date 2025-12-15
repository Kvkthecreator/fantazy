import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/ui/section-header";
import { CharacterPreviewCard } from "@/components/characters";

const CHARACTERS = [
  {
    name: "Mira",
    archetype: "Barista",
    description: "Warm, observant, playfully teasing—remembers your usual.",
  },
  {
    name: "Kai",
    archetype: "Neighbor",
    description: "Easygoing night owl with dry humor and quiet care.",
  },
  {
    name: "Sora",
    archetype: "Coworker",
    description: "Driven, sarcastic at work, secretly soft outside of it.",
  },
];

const HOW_IT_WORKS = [
  "Characters remember your story—names, hooks, promises.",
  "Chats are episodic: each session is a chapter with callbacks.",
  "Distinct personalities and boundaries; switching characters feels like switching shows.",
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
          <section className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Cozy companions that remember you
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Start chatting with AI characters who remember every chapter.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                A cozy romcom experience: episodic chats, stable personalities, and callbacks to your shared history.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login?next=/discover"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Start chatting
              </Link>
              <Link
                href="#characters"
                className="rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:border-primary"
              >
                Preview characters
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              SFW by default. Toggle adult content after sign-in if you choose.
            </p>
          </section>

          <section id="characters" className="space-y-6">
            <SectionHeader
              title="Featured characters"
              description="A taste of who you can meet. See the full roster after sign-in."
            />
            <div className="grid gap-4 md:grid-cols-3">
              {CHARACTERS.map((char) => (
                <CharacterPreviewCard
                  key={char.name}
                  name={char.name}
                  archetype={char.archetype}
                  description={char.description}
                />
              ))}
            </div>
            <div>
              <Link
                href="/login?next=/discover"
                className="text-sm font-semibold text-primary hover:underline"
              >
                See all characters →
              </Link>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader title="How it works" />
            <div className="grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map((item) => (
                <div key={item} className="rounded-lg border bg-card p-4 text-sm text-foreground shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
            <SectionHeader title="Privacy & Safety" />
            <p className="text-sm text-muted-foreground">
              Sign-in is required to chat. Characters are SFW by default; you control adult mode. Your conversations stay private.
            </p>
          </section>
        </main>
      </div>

      <footer className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>Fantazy — cozy companions that remember your story.</span>
          <Link href="/login?next=/discover" className="font-semibold text-primary hover:underline">
            Start chatting
          </Link>
        </div>
      </footer>
    </div>
  );
}
