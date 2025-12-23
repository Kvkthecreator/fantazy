'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api, APIError } from '@/lib/api/client'
import type { Character, GalleryStatusResponse, AvatarGalleryItem } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// =============================================================================
// Types & Constants
// =============================================================================

type EditTab = 'overview' | 'avatars' | 'backstory' | 'opening' | 'advanced'

const ARCHETYPES = [
  'comforting',
  'flirty',
  'mysterious',
  'cheerful',
  'brooding',
  'nurturing',
  'adventurous',
  'intellectual',
  'idol_leader',
  'neighbor',
  'handler',
  'wounded_star',
]

const GENRES = [
  'romantic_tension',
  'psychological_thriller',
  'slice_of_life',
]

// Flirting Level - the only boundary field that affects prompt generation
// NOTE: availability, vulnerability_pacing, desire_expression, physical_comfort
// were removed as they were UI-only and never used in prompt generation
const FLIRTING_LEVEL_OPTIONS = [
  { value: 'reserved', label: 'Reserved', description: 'Minimal flirtation, formal tone' },
  { value: 'playful', label: 'Playful', description: 'Light teasing, friendly energy' },
  { value: 'flirty', label: 'Flirty', description: 'Open flirtation, romantic tension' },
  { value: 'bold', label: 'Bold', description: 'Direct interest, confident advances' },
]

// Avatar generation presets
const STYLE_PRESETS = [
  { value: '', label: 'Default (Fantazy Style)' },
  { value: 'anime', label: 'Anime' },
  { value: 'semi_realistic', label: 'Semi-Realistic' },
  { value: 'painterly', label: 'Painterly' },
  { value: 'webtoon', label: 'Webtoon' },
]

const EXPRESSION_PRESETS = [
  { value: '', label: 'Auto (from archetype)' },
  { value: 'warm', label: 'Warm' },
  { value: 'intense', label: 'Intense' },
  { value: 'playful', label: 'Playful' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'confident', label: 'Confident' },
]

const POSE_PRESETS = [
  { value: '', label: 'Auto (from archetype)' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'casual', label: 'Casual' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'candid', label: 'Candid' },
]

// Helper to extract error detail from APIError
function getErrorDetail(err: unknown, fallback: string): string {
  if (err instanceof APIError && err.data) {
    const data = err.data as Record<string, unknown>
    if (typeof data.detail === 'string') return data.detail
  }
  if (err instanceof Error) return err.message
  return fallback
}

// =============================================================================
// Component
// =============================================================================

export default function CharacterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const characterId = params.id as string

  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<EditTab>('overview')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Conversation Ignition state
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateFeedback, setRegenerateFeedback] = useState('')
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false)

  // Avatar state
  const [galleryStatus, setGalleryStatus] = useState<GalleryStatusResponse | null>(null)
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false)
  const [appearanceDescription, setAppearanceDescription] = useState('')
  const [newAvatarLabel, setNewAvatarLabel] = useState('')
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  // Avatar generation presets
  const [stylePreset, setStylePreset] = useState('')
  const [expressionPreset, setExpressionPreset] = useState('')
  const [posePreset, setPosePreset] = useState('')
  const [styleNotes, setStyleNotes] = useState('')

  // Editable fields
  // NOTE: short_backstory/full_backstory merged into backstory
  // NOTE: current_stressor removed - episode situation conveys emotional state
  const [editForm, setEditForm] = useState({
    backstory: '',
    likes: [] as string[],
    dislikes: [] as string[],
    opening_situation: '',
    opening_line: '',
  })

  // Overview tab editable fields
  const [overviewForm, setOverviewForm] = useState({
    name: '',
    archetype: '',
    genre: '',
    baseline_personality: '',
    boundaries: '',
  })
  const [overviewDirty, setOverviewDirty] = useState(false)

  // Flirting level - the only boundary field that affects prompt generation
  const [flirtingLevel, setFlirtingLevel] = useState('playful')
  const [flirtingLevelDirty, setFlirtingLevelDirty] = useState(false)

  useEffect(() => {
    fetchCharacter()
    fetchGalleryStatus()
  }, [characterId])

  const fetchGalleryStatus = async () => {
    try {
      const status = await api.studio.getGalleryStatus(characterId)
      setGalleryStatus(status)
    } catch {
      // Avatars might not exist yet, that's okay
      setGalleryStatus(null)
    }
  }

  const handleGenerateAvatar = async () => {
    setIsGeneratingAvatar(true)
    setAvatarError(null)

    try {
      // Filter out placeholder values (starting with _)
      const cleanPreset = (v: string) => (v && !v.startsWith('_') ? v : undefined)

      const result = await api.studio.generateAvatar(characterId, {
        appearanceDescription: appearanceDescription || undefined,
        label: newAvatarLabel || undefined,
        stylePreset: cleanPreset(stylePreset),
        expressionPreset: cleanPreset(expressionPreset),
        posePreset: cleanPreset(posePreset),
        styleNotes: styleNotes || undefined,
      })

      if (!result.success) {
        setAvatarError(result.error || 'Failed to generate avatar')
        return
      }

      // Refresh character and avatar status
      await fetchCharacter()
      await fetchGalleryStatus()
      setNewAvatarLabel('')
      setSaveMessage('Avatar generated successfully!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setAvatarError(getErrorDetail(err, 'Failed to generate avatar'))
    } finally {
      setIsGeneratingAvatar(false)
    }
  }

  const handleSetPrimary = async (assetId: string) => {
    setSettingPrimary(assetId)
    setAvatarError(null)

    try {
      await api.studio.setGalleryPrimary(characterId, assetId)
      await fetchCharacter()
      await fetchGalleryStatus()
      setSaveMessage('Primary avatar updated!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setAvatarError(getErrorDetail(err, 'Failed to set primary avatar'))
    } finally {
      setSettingPrimary(null)
    }
  }

  const handleDeleteGalleryItem = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this avatar?')) return

    setDeletingItem(assetId)
    setAvatarError(null)

    try {
      await api.studio.deleteGalleryItem(characterId, assetId)
      await fetchCharacter()
      await fetchGalleryStatus()
      setSaveMessage('Avatar deleted!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setAvatarError(getErrorDetail(err, 'Failed to delete avatar'))
    } finally {
      setDeletingItem(null)
    }
  }

  const fetchCharacter = async () => {
    try {
      const data = await api.studio.getCharacter(characterId)
      setCharacter(data)

      // Fetch default episode template for opening beat (EP-01 Episode-First Pivot)
      let openingSituation = ''
      let openingLine = ''
      try {
        const summaries = await api.studio.listEpisodeTemplates(characterId, true)
        const defaultSummary = summaries.find(s => s.is_default)
        if (defaultSummary) {
          const defaultTemplate = await api.studio.getEpisodeTemplate(defaultSummary.id)
          openingSituation = defaultTemplate.situation || ''
          openingLine = defaultTemplate.opening_line || ''
        }
      } catch (templateErr) {
        // Episode templates might not exist yet - that's okay, user can generate
        console.log('No episode templates found:', templateErr)
      }

      setEditForm({
        backstory: data.backstory || '',
        likes: data.likes || [],
        dislikes: data.dislikes || [],
        opening_situation: openingSituation,
        opening_line: openingLine,
      })
      // Populate overview form
      setOverviewForm({
        name: data.name || '',
        archetype: data.archetype || '',
        genre: data.genre || 'romantic_tension',
        baseline_personality: JSON.stringify(data.baseline_personality || {}, null, 2),
        boundaries: JSON.stringify(data.boundaries || {}, null, 2),
      })
      setOverviewDirty(false)

      // Populate flirting level from boundaries
      const boundaries = data.boundaries || {}
      setFlirtingLevel(boundaries.flirting_level || 'playful')
      setFlirtingLevelDirty(false)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to load character'))
    } finally {
      setLoading(false)
    }
  }

  const saveChanges = async (fields: Record<string, unknown>) => {
    setSaving(true)
    setSaveMessage(null)

    try {
      const updated = await api.studio.updateCharacter(characterId, fields)
      setCharacter(updated)
      setSaveMessage('Saved successfully')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const saveOverviewChanges = async () => {
    setSaving(true)
    setSaveMessage(null)
    setError(null)

    try {
      // Parse JSON fields
      let personality = {}
      let boundaries = {}

      try {
        personality = JSON.parse(overviewForm.baseline_personality)
      } catch {
        setError('Invalid JSON in Personality field')
        setSaving(false)
        return
      }

      try {
        boundaries = JSON.parse(overviewForm.boundaries)
      } catch {
        setError('Invalid JSON in Boundaries field')
        setSaving(false)
        return
      }

      const updated = await api.studio.updateCharacter(characterId, {
        name: overviewForm.name,
        archetype: overviewForm.archetype,
        genre: overviewForm.genre,
        baseline_personality: personality,
        boundaries: boundaries,
      })
      setCharacter(updated)
      setOverviewDirty(false)
      setSaveMessage('Character updated successfully')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const handleOverviewChange = (field: string, value: string) => {
    setOverviewForm((prev) => ({ ...prev, [field]: value }))
    setOverviewDirty(true)
  }

  const handleFlirtingLevelChange = (value: string) => {
    setFlirtingLevel(value)
    setFlirtingLevelDirty(true)
  }

  const saveFlirtingLevel = async () => {
    setSaving(true)
    setSaveMessage(null)
    setError(null)

    try {
      // Update flirting_level in boundaries
      const currentBoundaries = character?.boundaries || {}
      const newBoundaries = {
        ...currentBoundaries,
        flirting_level: flirtingLevel,
      }

      const updated = await api.studio.updateCharacter(characterId, {
        boundaries: newBoundaries,
      })
      setCharacter(updated)
      setFlirtingLevelDirty(false)
      // Also update the raw JSON display
      setOverviewForm(prev => ({
        ...prev,
        boundaries: JSON.stringify(newBoundaries, null, 2),
      }))
      setSaveMessage('Energy level saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to save energy level'))
    } finally {
      setSaving(false)
    }
  }

  const activateCharacter = async () => {
    try {
      const updated = await api.studio.activateCharacter(characterId)
      setCharacter(updated)
      setSaveMessage('Character activated!')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to activate'))
    }
  }

  const deactivateCharacter = async () => {
    try {
      const updated = await api.studio.deactivateCharacter(characterId)
      setCharacter(updated)
      setSaveMessage('Character moved to draft')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to deactivate'))
    }
  }

  // Regenerate Opening Beat
  const handleRegenerateOpeningBeat = async () => {
    if (!character) return

    setIsRegenerating(true)
    setError(null)

    try {
      const result = await api.studio.regenerateOpeningBeat(characterId, {
        // Opening beat comes from editForm or default episode template (not character)
        previous_situation: editForm.opening_situation || '',
        previous_line: editForm.opening_line || '',
        feedback: regenerateFeedback || undefined,
      })

      setEditForm((prev) => ({
        ...prev,
        opening_situation: result.opening_situation,
        opening_line: result.opening_line,
      }))

      setRegenerateFeedback('')
      setShowRegenerateOptions(false)

      if (!result.is_valid && result.validation_errors.length > 0) {
        // Show warning but don't break the page - still use the generated content
        const errorMsg = result.validation_errors.map(e => e.message).join('; ')
        setSaveMessage(`Warning: ${errorMsg}. Review the generated content.`)
        setTimeout(() => setSaveMessage(null), 5000)
      } else {
        setSaveMessage('Opening beat regenerated! Review and save when ready.')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (err) {
      // Only use setError for actual failures that should show the error page
      setSaveMessage(`Error: ${getErrorDetail(err, 'Failed to regenerate opening beat')}`)
    } finally {
      setIsRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading character...</p>
      </div>
    )
  }

  if (error || !character) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error || 'Character not found'}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/studio">Back to Studio</Link>
        </Button>
      </div>
    )
  }

  const tabs: { id: EditTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'avatars', label: 'Avatars' },
    { id: 'backstory', label: 'Backstory' },
    { id: 'opening', label: 'Opening Beat' },
    { id: 'advanced', label: 'Advanced' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
            {character.avatar_url ? (
              <img src={character.avatar_url} alt={character.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              character.name[0].toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{character.name}</h1>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  character.status === 'active'
                    ? 'bg-green-500/20 text-green-600'
                    : 'bg-yellow-500/20 text-yellow-600'
                )}
              >
                {character.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {character.archetype} &middot; {character.genre?.replace('_', ' ') || 'romantic tension'} &middot; {character.content_rating.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {character.status === 'draft' ? (
            <Button
              onClick={activateCharacter}
              disabled={!galleryStatus?.can_activate}
              title={!galleryStatus?.can_activate ? galleryStatus?.missing_requirements?.join(', ') : undefined}
            >
              {galleryStatus?.can_activate ? 'Activate' : `Not Ready (${galleryStatus?.missing_requirements?.length || 0} issues)`}
            </Button>
          ) : (
            <Button variant="outline" onClick={deactivateCharacter}>
              Move to Draft
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/studio">Back</Link>
          </Button>
        </div>
      </div>

      {/* Save feedback */}
      {saveMessage && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600">
          {saveMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Character Info</CardTitle>
                <CardDescription>Core identity fields</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={overviewForm.name}
                    onChange={(e) => handleOverviewChange('name', e.target.value)}
                    placeholder="Character name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Archetype</Label>
                  <Select
                    value={overviewForm.archetype}
                    onValueChange={(v) => handleOverviewChange('archetype', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select archetype" />
                    </SelectTrigger>
                    <SelectContent>
                      {ARCHETYPES.map((arch) => (
                        <SelectItem key={arch} value={arch}>
                          {arch.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Genre</Label>
                  <Select
                    value={overviewForm.genre}
                    onValueChange={(v) => handleOverviewChange('genre', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Slug</p>
                  <p className="font-mono text-sm text-muted-foreground">{character.slug}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm text-muted-foreground">{new Date(character.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opening Beat</CardTitle>
                <CardDescription>How the first conversation starts (from Episode 0)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {editForm.opening_situation ? (
                  <>
                    <p className="text-sm italic text-muted-foreground">{editForm.opening_situation}</p>
                    <div className="flex gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                        {character.name[0]}
                      </div>
                      <p className="text-sm">{editForm.opening_line}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No opening beat configured</p>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Edit opening beat in the &quot;Opening Beat&quot; tab
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality</CardTitle>
                <CardDescription>Character traits and behavior (JSON)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={overviewForm.baseline_personality}
                  onChange={(e) => handleOverviewChange('baseline_personality', e.target.value)}
                  className="font-mono text-xs min-h-[160px]"
                  placeholder='{"traits": ["warm", "playful"], ...}'
                />
              </CardContent>
            </Card>
          </div>

          {/* Save Button for Overview */}
          <div className="flex justify-end">
            <Button
              onClick={saveOverviewChanges}
              disabled={saving || !overviewDirty}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* Energy Level Card - the only boundary that affects prompt generation */}
          <Card>
            <CardHeader>
              <CardTitle>Energy Level</CardTitle>
              <CardDescription>
                Controls flirtation intensity in the character&apos;s responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Flirting Level</Label>
                <Select
                  value={flirtingLevel}
                  onValueChange={handleFlirtingLevelChange}
                >
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLIRTING_LEVEL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {FLIRTING_LEVEL_OPTIONS.find(o => o.value === flirtingLevel)?.description}
                </p>
              </div>

              {flirtingLevelDirty && (
                <Button onClick={saveFlirtingLevel} disabled={saving} size="sm">
                  {saving ? 'Saving...' : 'Save Energy Level'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'avatars' && (
        <div className="space-y-6">
          {/* Avatar Error Display */}
          {avatarError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {avatarError}
            </div>
          )}

          {/* Avatars */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Avatars
                  {galleryStatus?.has_gallery && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  )}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {galleryStatus?.gallery.length || 0} images
                </span>
              </CardTitle>
              <CardDescription>
                Your character&apos;s visual identity. Click any image to set as primary.
                {!galleryStatus?.has_gallery && ' Generate at least one avatar to activate.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Grid */}
              {galleryStatus?.gallery && galleryStatus.gallery.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryStatus.gallery.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'group relative rounded-lg border-2 overflow-hidden transition-all',
                        item.is_primary
                          ? 'border-green-500 ring-2 ring-green-500/20'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <img
                        src={item.url}
                        alt={item.label || `${character.name} avatar`}
                        className="aspect-square w-full object-cover"
                      />
                      {/* Primary badge */}
                      {item.is_primary && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          Primary
                        </div>
                      )}
                      {/* Label */}
                      {item.label && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-xs text-white truncate">{item.label}</p>
                        </div>
                      )}
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!item.is_primary && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSetPrimary(item.id)}
                            disabled={settingPrimary === item.id}
                          >
                            {settingPrimary === item.id ? '...' : 'Set Primary'}
                          </Button>
                        )}
                        {galleryStatus.gallery.length > 1 && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteGalleryItem(item.id)}
                            disabled={deletingItem === item.id || item.is_primary}
                          >
                            {deletingItem === item.id ? '...' : 'Delete'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-6">
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center text-4xl text-muted-foreground">
                    {character.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">No Avatars Yet</p>
                    <p className="text-sm text-muted-foreground">
                      Generate your first avatar to complete your character&apos;s visual identity.
                      This is required before you can activate the character.
                    </p>
                  </div>
                </div>
              )}

              {/* Generate New Avatar */}
              <div className="rounded-lg border border-dashed border-border p-4 space-y-4">
                <p className="font-medium text-sm">Generate New Avatar</p>

                {/* Row 1: Appearance + Label */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Appearance (optional)</Label>
                    <Input
                      placeholder="e.g., Silver hair, blue eyes..."
                      value={appearanceDescription}
                      onChange={(e) => setAppearanceDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Label (optional)</Label>
                    <Input
                      placeholder="e.g., Casual, Office..."
                      value={newAvatarLabel}
                      onChange={(e) => setNewAvatarLabel(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 2: Style Presets (compact) */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Style</Label>
                    <Select value={stylePreset} onValueChange={setStylePreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Default" />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value || '_default'}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Expression</Label>
                    <Select value={expressionPreset} onValueChange={setExpressionPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPRESSION_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value || '_auto'}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Pose</Label>
                    <Select value={posePreset} onValueChange={setPosePreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSE_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value || '_auto'}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Style Notes (free text) */}
                <div className="space-y-2">
                  <Label className="text-sm">Style Notes (optional)</Label>
                  <Input
                    placeholder="e.g., sunset lighting, wearing glasses, rainy atmosphere..."
                    value={styleNotes}
                    onChange={(e) => setStyleNotes(e.target.value)}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add custom details that will be appended to the generation prompt
                  </p>
                </div>

                <Button
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingAvatar ? 'Generating Avatar...' : 'Generate Avatar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activation Ready Status */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-3 w-3 rounded-full',
                    galleryStatus?.can_activate ? 'bg-green-500' : 'bg-yellow-500'
                  )} />
                  <div>
                    <p className="font-medium">
                      {galleryStatus?.can_activate ? 'Ready for Activation' : 'Not Ready for Activation'}
                    </p>
                    {galleryStatus?.can_activate ? (
                      <p className="text-sm text-muted-foreground">
                        Your character is ready and can be activated.
                      </p>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>Missing requirements:</p>
                        <ul className="list-disc list-inside mt-1">
                          {galleryStatus?.missing_requirements?.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                {galleryStatus?.can_activate && character.status === 'draft' && (
                  <Button onClick={activateCharacter}>
                    Activate Character
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'backstory' && (
        <Card>
          <CardHeader>
            <CardTitle>Backstory & Life Context</CardTitle>
            <CardDescription>Optional enrichment that deepens the character</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Backstory</Label>
              <p className="text-xs text-muted-foreground">
                Character history and context. Used in system prompt to inform chat responses.
                First paragraph may be shown on character cards. (max 5000 chars)
              </p>
              <textarea
                maxLength={5000}
                className="min-h-[200px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.backstory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, backstory: e.target.value }))}
                placeholder="Who are they? What's their story? What makes them interesting?"
              />
            </div>

            {/* NOTE: Current Stressor removed - episode situation should convey emotional state */}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Likes</Label>
                  <span className={`text-xs ${editForm.likes.length > 5 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {editForm.likes.length}/5 used in prompt
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Comma-separated. First 5 are included in system prompt.</p>
                <Input
                  value={editForm.likes.join(', ')}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      likes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="coffee, rainy days, music..."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dislikes</Label>
                  <span className={`text-xs ${editForm.dislikes.length > 5 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {editForm.dislikes.length}/5 used in prompt
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Comma-separated. First 5 are included in system prompt.</p>
                <Input
                  value={editForm.dislikes.join(', ')}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      dislikes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="rudeness, early mornings..."
                />
              </div>
            </div>

            <Button
              onClick={() =>
                saveChanges({
                  backstory: editForm.backstory || null,
                  likes: editForm.likes,
                  dislikes: editForm.dislikes,
                })
              }
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Backstory'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'opening' && (
        <Card>
          <CardHeader>
            <CardTitle>Opening Beat</CardTitle>
            <CardDescription>The first impression that defines the chat experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Regenerate Section */}
            <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">Conversation Ignition</p>
                  <p className="text-sm text-muted-foreground">
                    Regenerate the opening beat using AI based on {character.name}&apos;s {character.archetype} archetype.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowRegenerateOptions(!showRegenerateOptions)}
                  disabled={isRegenerating}
                >
                  {showRegenerateOptions ? 'Cancel' : 'Regenerate'}
                </Button>
              </div>

              {showRegenerateOptions && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-sm">Feedback (optional)</Label>
                    <Input
                      placeholder="e.g., Make it more casual, add a bit of humor..."
                      value={regenerateFeedback}
                      onChange={(e) => setRegenerateFeedback(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide specific feedback to guide the regeneration.
                    </p>
                  </div>
                  <Button
                    onClick={handleRegenerateOpeningBeat}
                    disabled={isRegenerating}
                    className="w-full"
                  >
                    {isRegenerating ? 'Regenerating...' : 'Generate New Opening Beat'}
                  </Button>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or edit manually</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Opening Situation</Label>
              <p className="text-xs text-muted-foreground">Set the scene for the first message</p>
              <textarea
                maxLength={1000}
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.opening_situation}
                onChange={(e) => setEditForm((prev) => ({ ...prev, opening_situation: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Opening Line</Label>
              <p className="text-xs text-muted-foreground">Character&apos;s first message</p>
              <textarea
                maxLength={500}
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.opening_line}
                onChange={(e) => setEditForm((prev) => ({ ...prev, opening_line: e.target.value }))}
              />
            </div>

            {/* Preview */}
            {editForm.opening_situation && editForm.opening_line && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                <p className="text-sm italic text-muted-foreground">{editForm.opening_situation}</p>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                    {character.name[0]}
                  </div>
                  <div className="flex-1 rounded-lg bg-background p-3 text-sm">{editForm.opening_line}</div>
                </div>
              </div>
            )}

            <Button
              onClick={async () => {
                // Use applyOpeningBeat to save to episode_templates (EP-01 Episode-First Pivot)
                setSaving(true)
                try {
                  await api.studio.applyOpeningBeat(characterId, {
                    opening_situation: editForm.opening_situation || '',
                    opening_line: editForm.opening_line || '',
                  })
                  setSaveMessage('Opening beat saved to Episode 0')
                  setTimeout(() => setSaveMessage(null), 2000)
                } catch (err) {
                  setError(getErrorDetail(err, 'Failed to save opening beat'))
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving || !editForm.opening_situation || !editForm.opening_line}
            >
              {saving ? 'Saving...' : 'Save Opening Beat'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                The AI instructions generated from your character config. Updates automatically when you save changes
                to Overview, Backstory, or Opening Beat. You can also manually regenerate it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="text-xs overflow-auto max-h-80 bg-muted p-3 rounded whitespace-pre-wrap">
                {character.system_prompt || '(No system prompt generated yet)'}
              </pre>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const updated = await api.studio.regenerateSystemPrompt(characterId)
                      setCharacter(updated)
                      setSaveMessage('System prompt regenerated!')
                      setTimeout(() => setSaveMessage(null), 3000)
                    } catch (err) {
                      setError(getErrorDetail(err, 'Failed to regenerate system prompt'))
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? 'Regenerating...' : 'Regenerate System Prompt'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Last updated: {character.updated_at ? new Date(character.updated_at).toLocaleString() : 'Never'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>World Attachment</CardTitle>
              <CardDescription>Optional: attach this character to a world</CardDescription>
            </CardHeader>
            <CardContent>
              {character.world_id ? (
                <p className="text-sm">Attached to world: {character.world_id}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No world attached. World management coming soon.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm('Are you sure you want to delete this character? This cannot be undone.')) return
                  try {
                    await api.studio.deleteCharacter(characterId)
                    router.push('/studio')
                  } catch {
                    setError('Failed to delete character')
                  }
                }}
              >
                Delete Character
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
