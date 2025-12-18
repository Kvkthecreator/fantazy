'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import type { Series, CharacterSummary, World } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

// Episode from the with-episodes endpoint
interface SeriesEpisode {
  id: string
  character_id: string
  episode_number: number
  episode_type: string
  title: string
  slug: string
  situation: string
  opening_line: string
  episode_frame?: string
  background_image_url?: string
  dramatic_question?: string
  is_default: boolean
  sort_order: number
  status: string
}

export default function SeriesDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [series, setSeries] = useState<Series | null>(null)
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>([])
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'episodes' | 'characters' | 'settings'>('overview')

  // Episode editing state
  const [editingEpisode, setEditingEpisode] = useState<SeriesEpisode | null>(null)
  const [generatingBackground, setGeneratingBackground] = useState<string | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    tagline: '',
    description: '',
    series_type: 'standalone' as Series['series_type'],
    world_id: '' as string | null,
  })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      // Fetch series with episodes
      const seriesData = await api.series.getWithEpisodes(id)
      setSeries(seriesData)
      setEpisodes((seriesData.episodes || []) as SeriesEpisode[])

      // Initialize edit form
      setEditForm({
        title: seriesData.title,
        tagline: seriesData.tagline || '',
        description: seriesData.description || '',
        series_type: seriesData.series_type,
        world_id: seriesData.world_id,
      })

      // Fetch characters if any are featured
      if (seriesData.featured_characters?.length > 0) {
        const allChars = await api.studio.listCharacters()
        setCharacters(allChars.filter(c => seriesData.featured_characters.includes(c.id)))
      }

      // Fetch worlds for dropdown
      try {
        const worldsData = await api.worlds.list()
        setWorlds(worldsData)
      } catch {
        setWorlds([])
      }
    } catch (err) {
      console.error('Failed to fetch series:', err)
      setError('Failed to load series')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!series) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.series.update(id, {
        title: editForm.title,
        tagline: editForm.tagline || undefined,
        description: editForm.description || undefined,
        seriesType: editForm.series_type,
        worldId: editForm.world_id || undefined,
      })
      setSeries(updated)
      setHasChanges(false)
      setSaveMessage('Saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to save series:', err)
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!series) return
    try {
      const updated = await api.series.activate(id)
      setSeries(updated)
      setSaveMessage('Series activated!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to activate series:', err)
      setError('Failed to activate series')
    }
  }

  const handleDelete = async () => {
    if (!series) return
    if (!confirm('Are you sure you want to delete this series? This cannot be undone.')) return

    try {
      await api.series.delete(id)
      router.push('/studio')
    } catch (err) {
      console.error('Failed to delete series:', err)
      setError('Failed to delete series')
    }
  }

  // Episode handlers
  const handleSaveEpisode = async (episode: SeriesEpisode) => {
    setSaving(true)
    setError(null)
    try {
      await api.studio.updateEpisodeTemplate(episode.id, {
        title: episode.title,
        situation: episode.situation,
        opening_line: episode.opening_line,
        episode_frame: episode.episode_frame || undefined,
      })
      await fetchData()
      setEditingEpisode(null)
      setSaveMessage('Episode saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to save episode:', err)
      setError('Failed to save episode')
    } finally {
      setSaving(false)
    }
  }

  const handleActivateEpisode = async (templateId: string) => {
    setError(null)
    try {
      await api.studio.activateEpisodeTemplate(templateId)
      await fetchData()
      setSaveMessage('Episode activated!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to activate episode:', err)
      setError('Failed to activate episode')
    }
  }

  const handleGenerateBackground = async (episode: SeriesEpisode) => {
    // Find the character for this episode
    const char = characters.find(c => c.id === episode.character_id)
    if (!char) {
      setError('Character not found for this episode')
      return
    }

    setGeneratingBackground(episode.id)
    setError(null)
    try {
      await api.studio.generateEpisodeBackground(char.name, episode.episode_number)
      await fetchData()
      setSaveMessage('Background generated!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to generate background:', err)
      setError('Failed to generate background')
    } finally {
      setGeneratingBackground(null)
    }
  }

  const updateForm = (field: keyof typeof editForm, value: string | null) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading series...</p>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">{error || 'Series not found'}</p>
        <Button asChild variant="outline">
          <Link href="/studio">Back to Studio</Link>
        </Button>
      </div>
    )
  }

  const world = worlds.find(w => w.id === series.world_id)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {series.cover_image_url ? (
            <img
              src={series.cover_image_url}
              alt={series.title}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{series.title}</h1>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                series.status === 'active' ? "bg-green-500/20 text-green-600" :
                series.status === 'featured' ? "bg-purple-500/20 text-purple-600" :
                "bg-yellow-500/20 text-yellow-600"
              )}>
                {series.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {series.series_type} · {series.genre?.replace('_', ' ') || 'No genre'} · {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
            </p>
            {world && (
              <p className="text-xs text-muted-foreground mt-1">
                World: {world.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {series.status === 'draft' && (
            <Button onClick={handleActivate} variant="default">
              Activate Series
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/studio">Back</Link>
          </Button>
        </div>
      </div>

      {/* Feedback messages */}
      {saveMessage && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600">
          {saveMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="episodes">Episodes ({episodes.length})</TabsTrigger>
          <TabsTrigger value="characters">Characters ({characters.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Series Cover Image */}
          {series.cover_image_url && (
            <Card className="overflow-hidden">
              <div className="relative aspect-video w-full max-h-64">
                <img
                  src={series.cover_image_url}
                  alt={series.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-white text-xl font-semibold">{series.title}</h2>
                  {series.tagline && (
                    <p className="text-white/80 text-sm mt-1">{series.tagline}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Series Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Series Details</CardTitle>
                <CardDescription>Basic information about this series</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    placeholder="Series title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input
                    value={editForm.tagline}
                    onChange={(e) => updateForm('tagline', e.target.value)}
                    placeholder="A short hook for the series"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('description', e.target.value)}
                    placeholder="What this series is about..."
                    rows={4}
                  />
                </div>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Series Type & World Card */}
            <Card>
              <CardHeader>
                <CardTitle>Classification</CardTitle>
                <CardDescription>Series type and world setting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Series Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['standalone', 'serial', 'anthology', 'crossover'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => updateForm('series_type', type)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition",
                          editForm.series_type === type
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-foreground/30"
                        )}
                      >
                        <span className="capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {editForm.series_type === 'standalone' && 'Self-contained story, any episode can be entry'}
                    {editForm.series_type === 'serial' && 'Sequential narrative, Episode 0 recommended first'}
                    {editForm.series_type === 'anthology' && 'Themed collection, loosely connected'}
                    {editForm.series_type === 'crossover' && 'Multiple characters from different worlds'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>World</Label>
                  <select
                    value={editForm.world_id || ''}
                    onChange={(e) => updateForm('world_id', e.target.value || null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No world (standalone)</option>
                    {worlds.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  {world && (
                    <p className="text-xs text-muted-foreground">
                      {world.description || 'No description'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{episodes.length}</div>
                <p className="text-sm text-muted-foreground">Episodes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{characters.length}</div>
                <p className="text-sm text-muted-foreground">Characters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold capitalize">{series.series_type}</div>
                <p className="text-sm text-muted-foreground">Type</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold capitalize">{series.status}</div>
                <p className="text-sm text-muted-foreground">Status</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Episodes Tab - Full Edit Capability */}
        <TabsContent value="episodes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Episode Templates</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {episodes.length} episodes
                </span>
              </CardTitle>
              <CardDescription>
                Pre-defined scenarios that users can choose to start their conversation from.
                Each episode has a unique situation, opening line, and atmospheric background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {episodes.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground">No episodes in this series yet.</p>
                  <p className="text-sm text-muted-foreground">
                    Episodes are linked to series via the series_id field.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className={cn(
                        'rounded-lg border p-4 space-y-3',
                        episode.status === 'active' ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                      )}
                    >
                      {/* Episode Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {/* Background thumbnail */}
                          <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                            {episode.background_image_url ? (
                              <img
                                src={episode.background_image_url}
                                alt={episode.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                Episode {episode.episode_number}
                              </span>
                              {episode.is_default && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                  Entry
                                </span>
                              )}
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded',
                                  episode.status === 'active'
                                    ? 'bg-green-500/20 text-green-600'
                                    : 'bg-yellow-500/20 text-yellow-600'
                                )}
                              >
                                {episode.status}
                              </span>
                            </div>
                            <h4 className="font-medium mt-1">{episode.title}</h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingEpisode(editingEpisode?.id === episode.id ? null : episode)}
                          >
                            {editingEpisode?.id === episode.id ? 'Close' : 'Edit'}
                          </Button>
                          {episode.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActivateEpisode(episode.id)}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Episode Preview (collapsed) */}
                      {editingEpisode?.id !== episode.id && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {episode.situation}
                        </div>
                      )}

                      {/* Episode Editor (expanded) */}
                      {editingEpisode?.id === episode.id && (
                        <div className="space-y-4 pt-3 border-t">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={editingEpisode.title}
                              onChange={(e) =>
                                setEditingEpisode({ ...editingEpisode, title: e.target.value })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Situation</Label>
                            <p className="text-xs text-muted-foreground">
                              The scene-setting context shown to the user before the conversation starts.
                            </p>
                            <textarea
                              className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editingEpisode.situation}
                              onChange={(e) =>
                                setEditingEpisode({ ...editingEpisode, situation: e.target.value })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Opening Line</Label>
                            <p className="text-xs text-muted-foreground">
                              The character's first message in this scenario.
                            </p>
                            <textarea
                              className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editingEpisode.opening_line}
                              onChange={(e) =>
                                setEditingEpisode({ ...editingEpisode, opening_line: e.target.value })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Episode Frame (Image Prompt)</Label>
                            <p className="text-xs text-muted-foreground">
                              Atmospheric description used to generate the background image.
                            </p>
                            <textarea
                              className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={editingEpisode.episode_frame || ''}
                              onChange={(e) =>
                                setEditingEpisode({ ...editingEpisode, episode_frame: e.target.value })
                              }
                              placeholder="e.g., Dimly lit coffee shop at night, rain on windows, warm amber lighting..."
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleSaveEpisode(editingEpisode)}
                              disabled={saving}
                            >
                              {saving ? 'Saving...' : 'Save Episode'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleGenerateBackground(editingEpisode)}
                              disabled={generatingBackground === editingEpisode.id}
                            >
                              {generatingBackground === editingEpisode.id
                                ? 'Generating...'
                                : episode.background_image_url
                                  ? 'Regenerate Background'
                                  : 'Generate Background'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Characters Tab */}
        <TabsContent value="characters" className="space-y-6 mt-6">
          <h2 className="text-xl font-semibold">Featured Characters</h2>

          {characters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No characters linked to this series yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Link characters via the series.featured_characters array.
                </p>
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Series</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this series. Episodes will be unlinked but not deleted.
                  </p>
                </div>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
