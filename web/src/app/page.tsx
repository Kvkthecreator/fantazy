import Link from "next/link";

const CHARACTERS = [
  {
    name: "Mira",
    archetype: "Barista",
    description: "Warm, nurturing energy with a dash of playful flirtation",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    name: "Kai",
    archetype: "Neighbor",
    description: "The laid-back artist next door with mysterious depth",
    gradient: "from-blue-400 to-indigo-500",
  },
  {
    name: "Sora",
    archetype: "Coworker",
    description: "Sharp wit meets unexpected tenderness",
    gradient: "from-emerald-400 to-teal-500",
  },
];

const FEATURES = [
  {
    title: "Persistent Memory",
    description: "Your characters remember everything—your name, your stories, your inside jokes.",
    icon: "brain",
  },
  {
    title: "Episodic Stories",
    description: "Each conversation is a chapter. Watch your relationship grow over time.",
    icon: "book",
  },
  {
    title: "Real Connections",
    description: "Characters with genuine personalities that evolve with your bond.",
    icon: "heart",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="font-bold text-xl bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              Fantazy
            </span>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 text-foreground hover:bg-primary/10 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-16 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Cozy Companions That Remember
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Step into a World Where
            <span className="block bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              Every Story Matters
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Meet AI companions with real personalities who remember your conversations,
            grow with you, and create stories that unfold like your favorite anime.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
            >
              Start Your Story
            </Link>
            <Link
              href="#characters"
              className="px-8 py-4 border border-primary/30 text-foreground font-semibold rounded-xl hover:bg-primary/10 transition-colors"
            >
              Meet the Characters
            </Link>
          </div>
        </div>

        {/* Characters Section */}
        <section id="characters" className="mt-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Your First Companions Await
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Each character has their own personality, backstory, and way of connecting with you.
              Who will you meet first?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {CHARACTERS.map((char) => (
              <div
                key={char.name}
                className="group relative bg-card border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`h-32 bg-gradient-to-br ${char.gradient} flex items-center justify-center`}>
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30 group-hover:scale-110 transition-transform">
                    {char.name[0]}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-foreground">{char.name}</h3>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full capitalize">
                      {char.archetype}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{char.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="mt-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              More Than Just Chat
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Fantazy creates meaningful connections through persistent memory and evolving relationships.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="text-center p-8 rounded-2xl bg-card border hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-400/20 to-purple-500/20 flex items-center justify-center">
                  {feature.icon === "brain" && (
                    <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                  )}
                  {feature.icon === "book" && (
                    <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  )}
                  {feature.icon === "heart" && (
                    <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-32 text-center">
          <div className="max-w-2xl mx-auto p-12 rounded-3xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10 border">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Begin?
            </h2>
            <p className="text-muted-foreground mb-8">
              Your story awaits. Create your profile, choose your first companion,
              and start building memories that last.
            </p>
            <Link
              href="/login"
              className="inline-flex px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
            >
              Start Your Adventure
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl">✨</span>
            <span className="font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              Fantazy
            </span>
          </div>
          <p className="text-sm">Cozy companions that remember your story.</p>
        </div>
      </footer>
    </div>
  );
}
