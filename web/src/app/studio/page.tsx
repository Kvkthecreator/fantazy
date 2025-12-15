'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CharacterSummary = {
  id: string
  name: string
  slug: string
  archetype: string
  avatar_url: string | null
  short_backstory: string | null
  is_premium: boolean
}

export default function StudioPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'active'>('all')

  useEffect(() => {
    fetchCharacters()
  }, [filter])

  const fetchCharacters = async () => {
    try {
      const statusParam = filter !== 'all' ? `?status_filter=${filter}` : ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/studio/characters${statusParam}`, {
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        setCharacters(data)
      }
    } catch (err) {
      console.error('Failed to fetch characters:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Studio</p>
        <h1 className="mt-2 text-3xl font-semibold">Character Creation Studio</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Create and manage AI companions. Define identity, personality, and opening beats.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Create New Character</CardTitle>
            <CardDescription>
              4-step wizard: Core &rarr; Personality &rarr; Opening Beat &rarr; Save
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Required: Name, archetype, opening situation + line</p>
              <p>Optional: Backstory, assets, world (add later)</p>
            </div>
            <Button asChild>
              <Link href="/studio/create">Create</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Character Creation Contract</CardTitle>
            <CardDescription>What defines a character</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Required:</strong> Name, archetype, personality, boundaries, opening beat</p>
            <p><strong>For activation:</strong> Avatar image</p>
            <p><strong>Optional:</strong> Backstory, likes/dislikes, world attachment, advanced tone</p>
          </CardContent>
        </Card>
      </div>

      {/* My Characters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Characters</h2>
          <div className="flex gap-1">
            {(['all', 'draft', 'active'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition',
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Loading...</p>
        ) : characters.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {filter === 'all'
                  ? "You haven't created any characters yet."
                  : `No ${filter} characters.`}
              </p>
              <Button asChild className="mt-4">
                <Link href="/studio/create">Create Your First Character</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((char) => (
              <Link key={char.id} href={`/studio/characters/${char.id}`}>
                <Card className="h-full transition hover:border-foreground/30 cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-lg flex-shrink-0">
                        {char.avatar_url ? (
                          <img
                            src={char.avatar_url}
                            alt={char.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          char.name[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{char.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{char.archetype}</p>
                        {char.short_backstory && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {char.short_backstory}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Status Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Character Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600">
              draft
            </span>
            <div>
              <p className="text-sm font-medium">Work in Progress</p>
              <p className="text-xs text-muted-foreground">
                Editable freely. Not visible to users. Cannot be used for chat.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600">
              active
            </span>
            <div>
              <p className="text-sm font-medium">Chat-Ready</p>
              <p className="text-xs text-muted-foreground">
                Requires avatar. Visible and selectable. Ready for conversations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
