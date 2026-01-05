'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import type { CharacterSummary, SeriesSummary, World } from '@/types'
import { HelpCircle } from 'lucide-react'

export default function StudioPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [series, setSeries] = useState<SeriesSummary[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'active'>('all')
  const [worldFilter, setWorldFilter] = useState<string | null>(null)
  // Series-First: default to series tab
  const [activeTab, setActiveTab] = useState<'overview' | 'series' | 'characters'>('series')

  useEffect(() => {
    fetchData()
  }, [filter, worldFilter])

  useEffect(() => {
    fetchWorlds()
  }, [])

  const fetchWorlds = async () => {
    try {
      const data = await api.worlds.list()
      setWorlds(data)
    } catch {
      setWorlds([])
    }
  }

  const fetchData = async () => {
    try {
      // Fetch characters
      const statusFilter = filter !== 'all' ? filter : undefined
      const charData = await api.studio.listCharacters(statusFilter)
      setCharacters(charData)

      // Fetch series (include all types including 'play' for studio management)
      try {
        const seriesData = await api.series.list({
          status: filter !== 'all' ? filter : undefined,
          worldId: worldFilter || undefined,
          includePlay: true,  // Studio sees all series types
        })
        setSeries(seriesData)
      } catch {
        // Series endpoint may not exist yet
        setSeries([])
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Studio</p>
          <h1 className="mt-2 text-3xl font-semibold">Content Creation Studio</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create and manage series, characters, and episodes.
          </p>
        </div>

        {/* Tips Modal */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              Tips
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Content Architecture</DialogTitle>
              <DialogDescription>
                How content is organized in Fantazy
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  <span>Series</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <span>Character</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  <span>Episode</span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Series</p>
                  <p className="text-muted-foreground">Narrative containers that group episodes into coherent experiences.</p>
                </div>
                <div>
                  <p className="font-medium">Character + Avatar</p>
                  <p className="text-muted-foreground">Characters with their visual identity. Avatar is created as part of character setup.</p>
                </div>
                <div>
                  <p className="font-medium">Episodes</p>
                  <p className="text-muted-foreground">Individual conversation scenarios with specific situations and opening beats.</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium">Status Lifecycle</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600">draft</span>
                  <span className="text-muted-foreground">Work in progress, not visible to users</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600">active</span>
                  <span className="text-muted-foreground">Live and ready for conversations</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tab Navigation - Series-First */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="series">Series</TabsTrigger>
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Quick Actions */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle>Create New Character</CardTitle>
                <CardDescription>
                  4-step wizard: Core → Personality → Opening Beat → Save
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
                <CardTitle>Create New Series</CardTitle>
                <CardDescription>
                  Group episodes into narrative containers
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Types: Standalone, Serial, Anthology, Crossover</p>
                  <p>Organize episodes with dramatic arcs</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/studio/series/create">Create</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{characters.length}</div>
                <p className="text-sm text-muted-foreground">Total Characters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{series.length}</div>
                <p className="text-sm text-muted-foreground">Active Series</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {characters.filter(c => c.archetype).length}
                </div>
                <p className="text-sm text-muted-foreground">Ready for Chat</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Characters Tab */}
        <TabsContent value="characters" className="space-y-6 mt-6">
          {/* Filter */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Characters</h2>
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
                          {char.backstory && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {char.backstory}
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
        </TabsContent>

        {/* Series Tab - Primary Content View */}
        <TabsContent value="series" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Series</h2>
            <div className="flex items-center gap-3">
              {/* World Filter */}
              <select
                value={worldFilter || ''}
                onChange={(e) => setWorldFilter(e.target.value || null)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">All Worlds</option>
                {worlds.map(world => (
                  <option key={world.id} value={world.id}>
                    {world.name}
                  </option>
                ))}
              </select>
              {/* Status Filter */}
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
              <Button asChild>
                <Link href="/studio/series/create">New Series</Link>
              </Button>
            </div>
          </div>

          {series.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No series created yet. Series group episodes into narrative containers.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/studio/series/create">Create Your First Series</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {series.map((s) => (
                <Link key={s.id} href={`/studio/series/${s.id}`}>
                  <Card className="h-full transition hover:border-foreground/30 cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        {s.cover_image_url ? (
                          <img
                            src={s.cover_image_url}
                            alt={s.title}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-blue-500/20 flex items-center justify-center">
                            <span className="text-lg">📚</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="capitalize">{s.series_type}</span>
                            {s.world_id && (
                              <>
                                <span>·</span>
                                <span>{worlds.find(w => w.id === s.world_id)?.name || 'Unknown World'}</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.total_episodes} episode{s.total_episodes !== 1 ? 's' : ''}
                          </p>
                          {s.tagline && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {s.tagline}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
