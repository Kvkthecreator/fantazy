"use client";

import Link from "next/link";

function PlayHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden">
            <img
              src="/branding/ep0-mark.svg"
              alt="ep-0"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-foreground">
              episode-0
            </h1>
            <p className="text-xs text-muted-foreground">3, 2, 1... action</p>
          </div>
        </Link>

        <Link
          href="/login?next=/discover"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

export default function PlayPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PlayHeader />

      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-500/3 to-pink-500/5" />
      </div>

      {/* Content */}
      <main className="relative">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-12">
          <div className="text-center max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground mb-6">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Free • 60 seconds • No signup
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              Pick Your Quiz
            </h1>

            <p className="text-muted-foreground mb-12 text-base md:text-lg max-w-md mx-auto">
              Discover something about yourself. Share with friends. Compare results.
            </p>

            {/* Quiz Cards */}
            <div className="grid md:grid-cols-2 gap-6 max-w-xl mx-auto">
              {/* Romance Quiz */}
              <Link
                href="/play/romance"
                className="group relative p-6 rounded-2xl border border-border bg-card hover:border-rose-500/50 hover:bg-rose-500/5 transition-all duration-300"
              >
                <div className="text-5xl mb-4">💕</div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-rose-400 transition-colors">
                  Romance Type
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  What&apos;s your dating personality? Discover your romantic archetype.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full">slow burn</span>
                  <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full">all in</span>
                  <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full">push-pull</span>
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
              </Link>

              {/* Freak Quiz */}
              <Link
                href="/play/freak"
                className="group relative p-6 rounded-2xl border border-border bg-card hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 transition-all duration-300"
              >
                <div className="text-5xl mb-4">😈</div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-fuchsia-400 transition-colors">
                  Freak Level
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  How freaky are you really? Find out your true chaos tier.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="text-xs bg-fuchsia-500/10 text-fuchsia-400 px-2 py-1 rounded-full">vanilla</span>
                  <span className="text-xs bg-fuchsia-500/10 text-fuchsia-400 px-2 py-1 rounded-full">unhinged</span>
                  <span className="text-xs bg-fuchsia-500/10 text-fuchsia-400 px-2 py-1 rounded-full">menace</span>
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
              </Link>
            </div>

            {/* Footer note */}
            <p className="mt-12 text-xs text-muted-foreground">
              Results are AI-generated and meant for entertainment. Share responsibly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
