'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'

// =============================================================================
// Types & Constants (aligned with backend contract)
// =============================================================================

type CharacterStatus = 'draft' | 'active'
type ContentRating = 'sfw' | 'adult'
type FlirtingLevel = 'none' | 'playful' | 'moderate' | 'intense'

type StudioDraft = {
  // Step 1: Character Core
  name: string
  archetype: string
  avatarUrl: string | null

  // Step 2: Personality & Boundaries
  personalityPreset: string
  boundaries: {
    nsfw_allowed: boolean
    flirting_level: FlirtingLevel
    can_reject_user: boolean
  }
  contentRating: ContentRating

  // Step 3: Opening Beat
  openingSituation: string
  openingLine: string

  // Step 4: Status
  status: CharacterStatus
}

// Locked archetype set (matches backend)
const ARCHETYPES = [
  { id: 'comforting', label: 'Comforting', desc: 'Warm, supportive, safe' },
  { id: 'flirty', label: 'Flirty', desc: 'Playful romantic energy' },
  { id: 'mysterious', label: 'Mysterious', desc: 'Intriguing, slow reveal' },
  { id: 'cheerful', label: 'Cheerful', desc: 'Upbeat, energetic' },
  { id: 'brooding', label: 'Brooding', desc: 'Deep, thoughtful, intense' },
  { id: 'nurturing', label: 'Nurturing', desc: 'Caring, protective' },
  { id: 'adventurous', label: 'Adventurous', desc: 'Bold, exciting' },
  { id: 'intellectual', label: 'Intellectual', desc: 'Curious, analytical' },
]

// Personality presets (matches backend)
const PERSONALITY_PRESETS = [
  { id: 'warm_supportive', label: 'Warm & Supportive', desc: 'Patient, understanding, high agreeableness' },
  { id: 'playful_teasing', label: 'Playful & Teasing', desc: 'Witty, charming, moderately extraverted' },
  { id: 'mysterious_reserved', label: 'Mysterious & Reserved', desc: 'Guarded, intriguing, lower extraversion' },
  { id: 'cheerful_energetic', label: 'Cheerful & Energetic', desc: 'Optimistic, enthusiastic, high extraversion' },
  { id: 'calm_intellectual', label: 'Calm & Intellectual', desc: 'Analytical, curious, high openness' },
]

const FLIRTING_LEVELS: { id: FlirtingLevel; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'playful', label: 'Playful' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'intense', label: 'Intense' },
]

const steps = [
  'Character Core',
  'Personality & Boundaries',
  'Opening Beat',
  'Review & Save',
]

function buildEmptyDraft(): StudioDraft {
  return {
    name: '',
    archetype: '',
    avatarUrl: null,
    personalityPreset: 'warm_supportive',
    boundaries: {
      nsfw_allowed: false,
      flirting_level: 'playful',
      can_reject_user: true,
    },
    contentRating: 'sfw',
    openingSituation: '',
    openingLine: '',
    status: 'draft',
  }
}

function pill(selected: boolean) {
  return cn(
    'rounded-full border px-3 py-1 text-sm transition cursor-pointer',
    selected
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30'
  )
}

// =============================================================================
// Component
// =============================================================================

export default function CreateCharacterWizard() {
  const router = useRouter()
  const [draft, setDraft] = useState<StudioDraft>(buildEmptyDraft)
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Conversation Ignition state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [starterPrompts, setStarterPrompts] = useState<string[]>([])
  const [showStarterPrompts, setShowStarterPrompts] = useState(false)

  // Validation helpers
  const isStep1Valid = draft.name.trim().length >= 1 && draft.archetype !== ''
  const isStep2Valid = draft.personalityPreset !== ''
  const isStep3Valid = draft.openingSituation.trim().length >= 10 && draft.openingLine.trim().length >= 1

  const canProceed = () => {
    switch (currentStep) {
      case 0: return isStep1Valid
      case 1: return isStep2Valid
      case 2: return isStep3Valid
      case 3: return true
      default: return false
    }
  }

  // Generate Opening Beat using Conversation Ignition
  const handleGenerateOpeningBeat = async () => {
    if (!draft.name || !draft.archetype) {
      setGenerationError('Please complete Step 1 (name and archetype) first')
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const result = await api.studio.generateOpeningBeat({
        name: draft.name.trim(),
        archetype: draft.archetype,
        personality_preset: draft.personalityPreset,
        boundaries: {
          nsfw_allowed: draft.boundaries.nsfw_allowed,
          flirting_level: draft.boundaries.flirting_level,
          can_reject_user: draft.boundaries.can_reject_user,
        },
        content_rating: draft.contentRating,
      })

      setDraft((prev) => ({
        ...prev,
        openingSituation: result.opening_situation,
        openingLine: result.opening_line,
      }))
      setStarterPrompts(result.starter_prompts || [])

      if (!result.is_valid && result.validation_errors.length > 0) {
        const errorMsg = result.validation_errors.map(e => e.message).join('; ')
        setGenerationError(`Generated with warnings: ${errorMsg}`)
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate opening beat')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await api.studio.createCharacter({
        name: draft.name.trim(),
        archetype: draft.archetype,
        avatar_url: draft.avatarUrl,
        personality_preset: draft.personalityPreset,
        boundaries: {
          nsfw_allowed: draft.boundaries.nsfw_allowed,
          flirting_level: draft.boundaries.flirting_level,
          relationship_max_stage: 'intimate',
          avoided_topics: [],
          can_reject_user: draft.boundaries.can_reject_user,
          has_own_boundaries: true,
        },
        content_rating: draft.contentRating,
        opening_situation: draft.openingSituation.trim(),
        opening_line: draft.openingLine.trim(),
        status: draft.status,
      })

      router.push(`/studio/characters/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const StepNav = () => (
    <div className="flex flex-wrap gap-2">
      {steps.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            // Allow going back, but only forward if valid
            if (index < currentStep || canProceed()) {
              setCurrentStep(index)
            }
          }}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition',
            index === currentStep
              ? 'bg-primary text-primary-foreground'
              : index < currentStep
              ? 'bg-primary/20 text-primary cursor-pointer'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {index + 1}. {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Studio</p>
          <h1 className="mt-2 text-3xl font-semibold">Create Character</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Define identity, personality, and opening beat. Everything else can be added later.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/studio">Back to Studio</Link>
        </Button>
      </div>

      <StepNav />

      {/* Step 1: Character Core */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Character Core</CardTitle>
            <CardDescription>Name, archetype, and visual anchor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                maxLength={50}
                placeholder="Enter character name"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{draft.name.length}/50</p>
            </div>

            {/* Archetype */}
            <div className="space-y-3">
              <Label>Archetype *</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ARCHETYPES.map((arch) => (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, archetype: arch.id }))}
                    className={cn(
                      'flex flex-col items-start rounded-lg border p-3 text-left transition',
                      draft.archetype === arch.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/30'
                    )}
                  >
                    <span className="font-medium">{arch.label}</span>
                    <span className="text-xs text-muted-foreground">{arch.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar (placeholder for now) */}
            <div className="space-y-2">
              <Label>Avatar (optional for draft)</Label>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                  {draft.name ? draft.name[0].toUpperCase() : '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Avatar upload/generation coming soon. Required for activation.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Personality & Boundaries */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Personality & Boundaries</CardTitle>
            <CardDescription>Define how the character behaves and interacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personality Preset */}
            <div className="space-y-3">
              <Label>Personality Preset *</Label>
              <div className="space-y-2">
                {PERSONALITY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, personalityPreset: preset.id }))}
                    className={cn(
                      'flex w-full items-start rounded-lg border p-3 text-left transition',
                      draft.personalityPreset === preset.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/30'
                    )}
                  >
                    <div className="flex-1">
                      <span className="font-medium">{preset.label}</span>
                      <p className="text-xs text-muted-foreground">{preset.desc}</p>
                    </div>
                    {draft.personalityPreset === preset.id && (
                      <span className="text-primary">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Boundaries */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h4 className="font-medium">Safety & Boundaries</h4>

              {/* Flirting Level */}
              <div className="space-y-2">
                <Label className="text-sm">Flirting Level</Label>
                <div className="flex flex-wrap gap-2">
                  {FLIRTING_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      className={pill(draft.boundaries.flirting_level === level.id)}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          boundaries: { ...prev.boundaries, flirting_level: level.id },
                        }))
                      }
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Rating */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Adult Content</p>
                  <p className="text-xs text-muted-foreground">Allow NSFW interactions</p>
                </div>
                <Switch
                  checked={draft.boundaries.nsfw_allowed}
                  onCheckedChange={(checked) => {
                    setDraft((prev) => ({
                      ...prev,
                      contentRating: checked ? 'adult' : 'sfw',
                      boundaries: { ...prev.boundaries, nsfw_allowed: checked },
                    }))
                  }}
                />
              </div>

              {/* Can Reject */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Character Can Decline</p>
                  <p className="text-xs text-muted-foreground">Character can refuse uncomfortable requests</p>
                </div>
                <Switch
                  checked={draft.boundaries.can_reject_user}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({
                      ...prev,
                      boundaries: { ...prev.boundaries, can_reject_user: checked },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Opening Beat */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Opening Beat</CardTitle>
            <CardDescription>
              The opening beat determines the first chat experience. This is critical for user engagement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate Button */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
              <div className="flex-1">
                <p className="font-medium">Generate Opening Beat</p>
                <p className="text-sm text-muted-foreground">
                  Let AI create a contextually appropriate opening based on {draft.name || 'your character'}&apos;s {draft.archetype || 'archetype'}.
                </p>
              </div>
              <Button
                onClick={handleGenerateOpeningBeat}
                disabled={isGenerating || !draft.name || !draft.archetype}
                className="ml-4"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            </div>

            {generationError && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                {generationError}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or write manually</span>
              </div>
            </div>

            {/* Opening Situation */}
            <div className="space-y-2">
              <Label htmlFor="situation">Opening Situation *</Label>
              <p className="text-xs text-muted-foreground">
                Set the scene. Where are you? What&apos;s happening? This context shapes the conversation.
              </p>
              <textarea
                id="situation"
                maxLength={1000}
                className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Example: You're at the counter of a cozy coffee shop. The morning rush just ended, and the barista looks up as you approach..."
                value={draft.openingSituation}
                onChange={(e) => setDraft((prev) => ({ ...prev, openingSituation: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {draft.openingSituation.length}/1000 (min 10 characters)
              </p>
            </div>

            {/* Opening Line */}
            <div className="space-y-2">
              <Label htmlFor="openingLine">Opening Line *</Label>
              <p className="text-xs text-muted-foreground">
                The character&apos;s first message. This sets the tone for the entire relationship.
              </p>
              <textarea
                id="openingLine"
                maxLength={500}
                className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder='Example: "oh hey~ wasn&apos;t sure I&apos;d see you today. the usual?"'
                value={draft.openingLine}
                onChange={(e) => setDraft((prev) => ({ ...prev, openingLine: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{draft.openingLine.length}/500</p>
            </div>

            {/* Starter Prompts (collapsible, from generation) */}
            {starterPrompts.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowStarterPrompts(!showStarterPrompts)}
                >
                  <span>{showStarterPrompts ? '▼' : '▶'}</span>
                  Starter Prompts ({starterPrompts.length})
                </button>
                {showStarterPrompts && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Alternative opening lines generated for variety. These will be saved with your character.
                    </p>
                    {starterPrompts.map((prompt, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                        <p className="text-sm">{prompt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            {draft.openingSituation && draft.openingLine && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                <p className="text-sm italic text-muted-foreground">{draft.openingSituation}</p>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                    {draft.name ? draft.name[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 rounded-lg bg-background p-3 text-sm">
                    {draft.openingLine}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Save */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Save</CardTitle>
            <CardDescription>
              Review your character and choose whether to save as draft or activate immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Character</p>
                <p className="mt-1 text-lg font-semibold">{draft.name || '(unnamed)'}</p>
                <p className="text-sm text-muted-foreground capitalize">{draft.archetype || '(no archetype)'}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Personality</p>
                <p className="mt-1 font-medium">
                  {PERSONALITY_PRESETS.find((p) => p.id === draft.personalityPreset)?.label || draft.personalityPreset}
                </p>
                <p className="text-sm text-muted-foreground">
                  Flirting: {draft.boundaries.flirting_level} | {draft.contentRating.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Opening Beat Preview */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opening Beat</p>
              <p className="text-sm italic text-muted-foreground">{draft.openingSituation}</p>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                  {draft.name ? draft.name[0].toUpperCase() : '?'}
                </div>
                <div className="flex-1 rounded-lg bg-muted p-3 text-sm">{draft.openingLine}</div>
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-3">
              <Label>Save as</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, status: 'draft' }))}
                  className={cn(
                    'flex flex-col items-start rounded-lg border p-4 text-left transition',
                    draft.status === 'draft'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30'
                  )}
                >
                  <span className="font-medium">Draft</span>
                  <span className="text-xs text-muted-foreground">
                    Save for later. Not visible to users, not chat-ready.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, status: 'active' }))}
                  disabled={!draft.avatarUrl}
                  className={cn(
                    'flex flex-col items-start rounded-lg border p-4 text-left transition',
                    draft.status === 'active'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30',
                    !draft.avatarUrl && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="font-medium">Active</span>
                  <span className="text-xs text-muted-foreground">
                    {draft.avatarUrl
                      ? 'Chat-ready and visible to users.'
                      : 'Requires avatar to activate.'}
                  </span>
                </button>
              </div>
            </div>

            {/* What's Next */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">What you can add later:</p>
              <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <li>• Backstory (short & full)</li>
                <li>• Current stressor / life context</li>
                <li>• Likes & dislikes</li>
                <li>• Additional starter prompts</li>
                <li>• Expression images</li>
                <li>• Scene images</li>
                <li>• World attachment</li>
                <li>• Advanced tone settings</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
          disabled={currentStep === 0}
        >
          Back
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={() => setCurrentStep((step) => step + 1)} disabled={!canProceed()}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
            {isSubmitting ? 'Creating...' : `Create ${draft.status === 'draft' ? 'Draft' : 'Character'}`}
          </Button>
        )}
      </div>
    </div>
  )
}
