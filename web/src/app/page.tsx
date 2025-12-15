import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <header className="border-b">
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

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
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
          <div>
            <h2 className="text-2xl font-semibold">Featured characters</h2>
            <p className="text-sm text-muted-foreground">
              A taste of who you can meet. See the full roster after sign-in.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {CHARACTERS.map((char) => (
              <div key={char.name} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{char.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {char.archetype}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{char.description}</p>
              </div>
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
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item} className="rounded-lg border bg-card p-4 text-sm text-foreground">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Privacy & Safety</h3>
          <p className="text-sm text-muted-foreground">
            Sign-in is required to chat. Characters are SFW by default; you control adult mode. Your conversations stay private.
          </p>
        </section>
      </main>

      <footer className="border-t">
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
