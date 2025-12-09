import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-white font-bold text-xl">Clearinghouse</div>
          <Link
            href="/login"
            className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            IP Licensing Infrastructure
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              for the AI Era
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
            Manage your creative works, set AI permissions, and license your intellectual property with confidence in the age of generative AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mt-32 grid md:grid-cols-3 gap-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">AI Permission Control</h3>
            <p className="text-slate-400">
              Define granular permissions for AI training, generation, and commercial use of your creative works.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Semantic Search</h3>
            <p className="text-slate-400">
              Find similar works using AI-powered semantic search across your entire IP portfolio.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">License Management</h3>
            <p className="text-slate-400">
              Issue, track, and manage licenses with built-in governance and approval workflows.
            </p>
          </div>
        </div>

        {/* IP Types */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Manage All Types of IP</h2>
          <p className="text-slate-400 mb-12 max-w-2xl mx-auto">
            From music and voice to characters and visual works, Clearinghouse supports the full spectrum of creative intellectual property.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Musical Works', 'Sound Recordings', 'Voice Likeness', 'Character IP', 'Visual Works', 'Literary Works', 'Video Content'].map((type) => (
              <span
                key={type}
                className="px-4 py-2 bg-white/10 text-white rounded-full text-sm"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-6 text-center text-slate-400">
          <p>&copy; 2024 Clearinghouse. IP Licensing Infrastructure for the AI Era.</p>
        </div>
      </footer>
    </div>
  )
}
