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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Series, CharacterSummary, World, GenreSettings, GenreSettingsOptions } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

const GENRES = [
  { value: 'romantic_tension', label: 'Romantic Tension', description: "Will-they-won't-they dynamics" },
  { value: 'psychological_thriller', label: 'Psychological Thriller', description: 'Mind games and manipulation' },
  { value: 'slice_of_life', label: 'Slice of Life', description: 'Everyday warmth and comfort' },
  { value: 'dark_romance', label: 'Dark Romance', description: 'Intense, morally grey attraction' },
  { value: 'mystery', label: 'Mystery', description: 'Secrets and investigation' },
  { value: 'fantasy_romance', label: 'Fantasy Romance', description: 'Magic and otherworldly love' },
] as const

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
  const [expandedImage, setExpandedImage] = useState<{ url: string; title: string } | null>(null)
  const [generatingCover, setGeneratingCover] = useState(false)

  // Genre settings state
  const [genreOptions, setGenreOptions] = useState<GenreSettingsOptions | null>(null)
  const [genreSettings, setGenreSettings] = useState<GenreSettings | null>(null)
  const [genrePromptPreview, setGenrePromptPreview] = useState<string>('')
  const [genreSettingsHasChanges, setGenreSettingsHasChanges] = useState(false)
  const [savingGenreSettings, setSavingGenreSettings] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    tagline: '',
    description: '',
    series_type: 'standalone' as Series['series_type'],
    genre: '' as string | null,
    world_id: '' as string | null,
  })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  // ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedImage) {
        setExpandedImage(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedImage])

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
        genre: seriesData.genre,
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

      // Fetch genre settings options and current settings
      try {
        const [options, currentSettings] = await Promise.all([
          api.series.getGenreOptions(),
          api.series.getGenreSettings(id),
        ])
        setGenreOptions(options)
        setGenreSettings(currentSettings.settings)
        setGenrePromptPreview(currentSettings.prompt_section)
      } catch (err) {
        console.error('Failed to fetch genre settings:', err)
        // Don't fail the whole page if genre settings fail
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
        genre: editForm.genre || undefined,
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

  const updateGenreSetting = (field: keyof GenreSettings, value: string) => {
    if (!genreSettings) return
    setGenreSettings(prev => prev ? { ...prev, [field]: value } : null)
    setGenreSettingsHasChanges(true)
  }

  const handleSaveGenreSettings = async () => {
    if (!series || !genreSettings) return
    setSavingGenreSettings(true)
    setError(null)
    try {
      await api.series.updateGenreSettings(id, genreSettings)
      // Refresh to get updated prompt preview
      const currentSettings = await api.series.getGenreSettings(id)
      setGenreSettings(currentSettings.settings)
      setGenrePromptPreview(currentSettings.prompt_section)
      setGenreSettingsHasChanges(false)
      setSaveMessage('Genre settings saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to save genre settings:', err)
      setError('Failed to save genre settings')
    } finally {
      setSavingGenreSettings(false)
    }
  }

  const handleApplyGenrePreset = async (presetName: string) => {
    if (!series || !genreOptions) return
    setSavingGenreSettings(true)
    setError(null)
    try {
      await api.series.applyGenrePreset(id, presetName)
      // Refresh to get updated settings and prompt preview
      const currentSettings = await api.series.getGenreSettings(id)
      setGenreSettings(currentSettings.settings)
      setGenrePromptPreview(currentSettings.prompt_section)
      setGenreSettingsHasChanges(false)
      setSaveMessage(`Applied "${presetName}" preset!`)
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      console.error('Failed to apply genre preset:', err)
      setError('Failed to apply genre preset')
    } finally {
      setSavingGenreSettings(false)
    }
  }

  const handleGenerateCover = async () => {
    if (!series) return

    setGeneratingCover(true)
    setError(null)
    try {
      const result = await api.series.generateCover(id, true) // force=true to regenerate
      if (result.success) {
        await fetchData()
        setSaveMessage('Cover generated!')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to generate cover')
      }
    } catch (err) {
      console.error('Failed to generate cover:', err)
      setError('Failed to generate cover')
    } finally {
      setGeneratingCover(false)
    }
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
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Series Cover</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                >
                  {generatingCover ? 'Generating...' : series.cover_image_url ? 'Regenerate Cover' : 'Generate Cover'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {series.cover_image_url ? (
                <button
                  type="button"
                  className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                  onClick={() => setExpandedImage({ url: series.cover_image_url!, title: series.title })}
                >
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
                </button>
              ) : (
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">No cover image yet. Click &quot;Generate Cover&quot; to create one.</p>
                </div>
              )}
            </CardContent>
          </Card>

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
                <CardDescription>Series type, genre, and world setting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Series Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['standalone', 'serial', 'anthology', 'crossover', 'play'] as const).map(type => (
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
                    {editForm.series_type === 'play' && 'Viral/game content for /play route (anonymous-first)'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Genre</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENRES.map(genre => (
                      <button
                        key={genre.value}
                        onClick={() => updateForm('genre', genre.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition",
                          editForm.genre === genre.value
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-foreground/30"
                        )}
                      >
                        <div className="font-medium">{genre.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{genre.description}</div>
                      </button>
                    ))}
                  </div>
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

          {/* Genre Settings Card - Tone & Pacing */}
          {genreOptions && genreSettings && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tone & Pacing</CardTitle>
                    <CardDescription>
                      Genre doctrine settings that shape conversation dynamics across all episodes
                    </CardDescription>
                  </div>
                  {/* Quick Apply Preset */}
                  <Select
                    onValueChange={handleApplyGenrePreset}
                    disabled={savingGenreSettings}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Apply preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(genreOptions.presets).map(preset => (
                        <SelectItem key={preset} value={preset}>
                          {preset.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Tension Style */}
                  <div className="space-y-2">
                    <Label>Tension Style</Label>
                    <Select
                      value={genreSettings.tension_style}
                      onValueChange={(v) => updateGenreSetting('tension_style', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genreOptions.tension_styles.map(style => (
                          <SelectItem key={style} value={style}>
                            {style.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {genreSettings.tension_style === 'subtle' && 'Express tension through implication and unspoken desire'}
                      {genreSettings.tension_style === 'playful' && 'Use teasing, banter, and push-pull energy'}
                      {genreSettings.tension_style === 'moderate' && 'Balance clear attraction with restraint'}
                      {genreSettings.tension_style === 'direct' && 'Be bold while maintaining some mystery'}
                    </p>
                  </div>

                  {/* Vulnerability Timing */}
                  <div className="space-y-2">
                    <Label>Vulnerability Timing</Label>
                    <Select
                      value={genreSettings.vulnerability_timing}
                      onValueChange={(v) => updateGenreSetting('vulnerability_timing', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genreOptions.vulnerability_timings.map(timing => (
                          <SelectItem key={timing} value={timing}>
                            {timing.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {genreSettings.vulnerability_timing === 'early' && 'Show vulnerability early to build connection'}
                      {genreSettings.vulnerability_timing === 'middle' && 'Reveal vulnerability as trust develops'}
                      {genreSettings.vulnerability_timing === 'late' && 'Hold vulnerability until critical moments'}
                      {genreSettings.vulnerability_timing === 'earned' && 'Only show vulnerability when user has earned it'}
                    </p>
                  </div>

                  {/* Pacing Curve */}
                  <div className="space-y-2">
                    <Label>Pacing Curve</Label>
                    <Select
                      value={genreSettings.pacing_curve}
                      onValueChange={(v) => updateGenreSetting('pacing_curve', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genreOptions.pacing_curves.map(curve => (
                          <SelectItem key={curve} value={curve}>
                            {curve.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {genreSettings.pacing_curve === 'slow_burn' && 'Build tension gradually - patience creates anticipation'}
                      {genreSettings.pacing_curve === 'steady' && 'Maintain consistent escalation with regular beats'}
                      {genreSettings.pacing_curve === 'fast_escalate' && 'Move quickly through tension beats - high intensity'}
                    </p>
                  </div>

                  {/* Resolution Mode */}
                  <div className="space-y-2">
                    <Label>Resolution Mode</Label>
                    <Select
                      value={genreSettings.resolution_mode}
                      onValueChange={(v) => updateGenreSetting('resolution_mode', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genreOptions.resolution_modes.map(mode => (
                          <SelectItem key={mode} value={mode}>
                            {mode.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {genreSettings.resolution_mode === 'open' && 'Leave tension unresolved, inviting continuation'}
                      {genreSettings.resolution_mode === 'closed' && 'Provide clear emotional resolution per episode'}
                      {genreSettings.resolution_mode === 'cliffhanger' && 'End on heightened tension, create urgency'}
                    </p>
                  </div>
                </div>

                {/* Genre Notes */}
                <div className="space-y-2">
                  <Label>Genre Notes (Custom)</Label>
                  <Textarea
                    value={genreSettings.genre_notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateGenreSetting('genre_notes', e.target.value)}
                    placeholder="Add specific guidance for this series... (e.g., 'Focus on intellectual sparring over physical tension')"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Free-text guidance injected into character prompts for fine-tuning
                  </p>
                </div>

                {/* Prompt Preview */}
                {genrePromptPreview && (
                  <div className="space-y-2">
                    <Label>Prompt Preview</Label>
                    <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                      {genrePromptPreview}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is injected into the character's system prompt during conversations
                    </p>
                  </div>
                )}

                {genreSettingsHasChanges && (
                  <Button onClick={handleSaveGenreSettings} disabled={savingGenreSettings}>
                    {savingGenreSettings ? 'Saving...' : 'Save Genre Settings'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

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
                          {/* Background thumbnail (clickable to expand) */}
                          <button
                            type="button"
                            className="h-16 w-24 rounded-lg bg-muted overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer disabled:cursor-default disabled:hover:ring-0"
                            onClick={() => episode.background_image_url && setExpandedImage({ url: episode.background_image_url, title: episode.title })}
                            disabled={!episode.background_image_url}
                          >
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
                          </button>
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

                          {/* Current Background Preview (expanded view) */}
                          {episode.background_image_url && (
                            <div className="space-y-2">
                              <Label>Current Background</Label>
                              <button
                                type="button"
                                className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                                onClick={() => setExpandedImage({ url: episode.background_image_url!, title: episode.title })}
                              >
                                <img
                                  src={episode.background_image_url}
                                  alt={`${episode.title} background`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                                  <span className="opacity-0 hover:opacity-100 text-white text-sm bg-black/50 px-2 py-1 rounded">
                                    Click to expand
                                  </span>
                                </div>
                              </button>
                            </div>
                          )}

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

      {/* Image Lightbox Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh]">
            <button
              type="button"
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-sm"
              onClick={() => setExpandedImage(null)}
            >
              Press ESC or click to close
            </button>
            <img
              src={expandedImage.url}
              alt={expandedImage.title}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-2 text-sm">{expandedImage.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}
