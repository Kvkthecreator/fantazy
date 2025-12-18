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

// =============================================================================
// Types
// =============================================================================

type EditTab = 'overview' | 'avatars' | 'backstory' | 'opening' | 'conversation' | 'advanced'

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

  // Editable fields
  const [editForm, setEditForm] = useState({
    short_backstory: '',
    full_backstory: '',
    current_stressor: '',
    likes: [] as string[],
    dislikes: [] as string[],
    opening_situation: '',
    opening_line: '',
    starter_prompts: [] as string[],
  })

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
      const result = await api.studio.generateAvatar(
        characterId,
        appearanceDescription || undefined,
        newAvatarLabel || undefined
      )

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
      const summaries = await api.studio.listEpisodeTemplates(characterId, true)
      const defaultSummary = summaries.find(s => s.is_default)
      let openingSituation = ''
      let openingLine = ''
      if (defaultSummary) {
        const defaultTemplate = await api.studio.getEpisodeTemplate(defaultSummary.id)
        openingSituation = defaultTemplate.situation || ''
        openingLine = defaultTemplate.opening_line || ''
      }
      setEditForm({
        short_backstory: data.short_backstory || '',
        full_backstory: data.full_backstory || '',
        current_stressor: data.current_stressor || '',
        likes: data.likes || [],
        dislikes: data.dislikes || [],
        opening_situation: openingSituation,
        opening_line: openingLine,
        starter_prompts: data.starter_prompts || [],
      })
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
        starter_prompts: [result.opening_line, ...(result.starter_prompts || [])],
      }))

      setRegenerateFeedback('')
      setShowRegenerateOptions(false)
      setSaveMessage('Opening beat regenerated! Review and save when ready.')
      setTimeout(() => setSaveMessage(null), 3000)

      if (!result.is_valid && result.validation_errors.length > 0) {
        const errorMsg = result.validation_errors.map(e => e.message).join('; ')
        setError(`Generated with warnings: ${errorMsg}`)
      }
    } catch (err) {
      setError(getErrorDetail(err, 'Failed to regenerate opening beat'))
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
    { id: 'conversation', label: 'Conversation' },
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
            >
              {galleryStatus?.can_activate ? 'Activate' : 'Generate Avatar First'}
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
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Character Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{character.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Archetype</p>
                <p className="font-medium capitalize">{character.archetype}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Genre</p>
                <p className="font-medium capitalize">{character.genre?.replace('_', ' ') || 'romantic tension'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Slug</p>
                <p className="font-mono text-sm">{character.slug}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(character.created_at).toLocaleDateString()}</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personality</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto max-h-40 bg-muted p-2 rounded">
                {JSON.stringify(character.baseline_personality, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Boundaries</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto max-h-40 bg-muted p-2 rounded">
                {JSON.stringify(character.boundaries, null, 2)}
              </pre>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Appearance Description (optional)</Label>
                    <Input
                      placeholder="e.g., Silver hair, bright blue eyes, cozy sweater..."
                      value={appearanceDescription}
                      onChange={(e) => setAppearanceDescription(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to auto-derive from archetype and personality.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Label (optional)</Label>
                    <Input
                      placeholder="e.g., Casual, Office, Evening..."
                      value={newAvatarLabel}
                      onChange={(e) => setNewAvatarLabel(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      A short description to identify this avatar.
                    </p>
                  </div>
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
                    <p className="text-sm text-muted-foreground">
                      {galleryStatus?.can_activate
                        ? 'Your character has an avatar and can be activated.'
                        : 'Generate an avatar to enable activation.'}
                    </p>
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
              <Label>Short Backstory</Label>
              <p className="text-xs text-muted-foreground">Brief intro shown on character cards (max 500 chars)</p>
              <textarea
                maxLength={500}
                className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.short_backstory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, short_backstory: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Full Backstory</Label>
              <p className="text-xs text-muted-foreground">Detailed history, only used for context (max 5000 chars)</p>
              <textarea
                maxLength={5000}
                className="min-h-[200px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.full_backstory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_backstory: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Current Stressor</Label>
              <p className="text-xs text-muted-foreground">What&apos;s on their mind lately? Adds depth to conversations.</p>
              <Input
                maxLength={500}
                value={editForm.current_stressor}
                onChange={(e) => setEditForm((prev) => ({ ...prev, current_stressor: e.target.value }))}
                placeholder="e.g., Deadline stress, relationship trouble..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Likes</Label>
                <p className="text-xs text-muted-foreground">Comma-separated</p>
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
                <Label>Dislikes</Label>
                <p className="text-xs text-muted-foreground">Comma-separated</p>
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
                  short_backstory: editForm.short_backstory || null,
                  full_backstory: editForm.full_backstory || null,
                  current_stressor: editForm.current_stressor || null,
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
                    starter_prompts: editForm.starter_prompts,
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

      {activeTab === 'conversation' && (
        <Card>
          <CardHeader>
            <CardTitle>Conversation Config</CardTitle>
            <CardDescription>Starter prompts and example messages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Additional Starter Prompts</Label>
              <p className="text-xs text-muted-foreground">
                Alternative opening lines (one per line). The opening_line is always first.
              </p>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={editForm.starter_prompts.slice(1).join('\n')}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    starter_prompts: [
                      prev.opening_line || '',  // Opening line from episode_template
                      ...e.target.value.split('\n').filter(Boolean),
                    ],
                  }))
                }
                placeholder="One prompt per line..."
              />
            </div>

            <Button
              onClick={() => saveChanges({ starter_prompts: editForm.starter_prompts })}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Conversation Config'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Auto-generated from character config. Read-only for now.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto max-h-80 bg-muted p-3 rounded whitespace-pre-wrap">
                {character.system_prompt}
              </pre>
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
