'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import type { World } from '@/types'

const GENRES = [
  { value: 'romantic_tension', label: 'Romantic Tension', description: 'Will-they-won\'t-they dynamics' },
  { value: 'psychological_thriller', label: 'Psychological Thriller', description: 'Mind games and manipulation' },
  { value: 'slice_of_life', label: 'Slice of Life', description: 'Everyday warmth and comfort' },
  { value: 'dark_romance', label: 'Dark Romance', description: 'Intense, morally grey attraction' },
  { value: 'mystery', label: 'Mystery', description: 'Secrets and investigation' },
  { value: 'fantasy_romance', label: 'Fantasy Romance', description: 'Magic and otherworldly love' },
] as const

const SERIES_TYPES = [
  { value: 'standalone', label: 'Standalone', description: 'Self-contained story, any episode can be entry point' },
  { value: 'serial', label: 'Serial', description: 'Sequential narrative, Episode 0 recommended first' },
  { value: 'anthology', label: 'Anthology', description: 'Themed collection, loosely connected stories' },
  { value: 'crossover', label: 'Crossover', description: 'Multiple characters from different worlds' },
  { value: 'play', label: 'Play', description: 'Viral/game content for /play route (anonymous-first)' },
] as const

export default function CreateSeriesPage() {
  const router = useRouter()
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    title: '',
    tagline: '',
    description: '',
    genre: 'romantic_tension' as string,
    series_type: 'standalone' as 'standalone' | 'serial' | 'anthology' | 'crossover' | 'play',
    world_id: '' as string | null,
  })

  useEffect(() => {
    fetchWorlds()
  }, [])

  const fetchWorlds = async () => {
    try {
      const data = await api.worlds.list()
      setWorlds(data)
    } catch {
      // Worlds are optional, continue without them
      setWorlds([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const series = await api.series.create({
        title: form.title.trim(),
        tagline: form.tagline.trim() || undefined,
        description: form.description.trim() || undefined,
        genre: form.genre,
        seriesType: form.series_type,
        worldId: form.world_id || undefined,
      })
      router.push(`/studio/series/${series.id}`)
    } catch (err) {
      console.error('Failed to create series:', err)
      setError(err instanceof Error ? err.message : 'Failed to create series')
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field: keyof typeof form, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create New Series</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A series is a collection of episodes featuring your characters
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/studio">Cancel</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Series Details</CardTitle>
            <CardDescription>Basic information about your series</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g., Stolen Moments"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={form.tagline}
                onChange={(e) => updateForm('tagline', e.target.value)}
                placeholder="A short hook that captures the essence"
              />
              <p className="text-xs text-muted-foreground">
                One line that sells the series
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('description', e.target.value)}
                placeholder="What is this series about? What themes does it explore?"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Genre Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Genre</CardTitle>
            <CardDescription>What type of story is this?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {GENRES.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => updateForm('genre', genre.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    form.genre === genre.value
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-foreground/30"
                  )}
                >
                  <p className="font-medium">{genre.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {genre.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Series Type */}
        <Card>
          <CardHeader>
            <CardTitle>Series Type</CardTitle>
            <CardDescription>How are the episodes connected?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {SERIES_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateForm('series_type', type.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    form.series_type === type.value
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-foreground/30"
                  )}
                >
                  <p className="font-medium">{type.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* World Selection */}
        <Card>
          <CardHeader>
            <CardTitle>World Setting</CardTitle>
            <CardDescription>Where does this story take place?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="world">World</Label>
              <select
                id="world"
                value={form.world_id || ''}
                onChange={(e) => updateForm('world_id', e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No world (standalone)</option>
                {worlds.map(world => (
                  <option key={world.id} value={world.id}>
                    {world.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Worlds provide visual style and cultural context
              </p>
            </div>

            {form.world_id && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  {worlds.find(w => w.id === form.world_id)?.description || 'No description'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button asChild variant="outline">
            <Link href="/studio">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Series'}
          </Button>
        </div>
      </form>
    </div>
  )
}
