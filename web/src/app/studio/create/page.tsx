'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Orientation = 'all' | 'female' | 'male'
type Rating = 'sfw' | 'adult'
type Visibility = 'private' | 'link-only'

type LoreEntry = { id: string; keyword: string; text: string }
type AssetEntry = { id: string; label: string; fileName?: string }

type StudioDraft = {
  profile: { name: string; intro: string }
  details: string
  opening: { situation: string; firstLine: string }
  tags: { orientation: Orientation; rating: Rating; categories: string[] }
  assets: {
    hero?: string
    expressions: AssetEntry[]
    scenes: AssetEntry[]
  }
  lorebook: LoreEntry[]
  visibility: Visibility
}

const categories = [
  'romance',
  'fantasy',
  'slice-of-life',
  'drama',
  'action',
  'scifi',
  'horror',
  'comedy',
  'sports',
  'other',
]

const steps = [
  'Profile',
  'Details',
  'Opening',
  'Tags & Safety',
  'Assets',
  'Lorebook (Optional)',
  'Review & Submit',
]

function buildEmptyDraft(): StudioDraft {
  return {
    profile: { name: '', intro: '' },
    details: '',
    opening: { situation: '', firstLine: '' },
    tags: { orientation: 'all', rating: 'sfw', categories: [] },
    assets: { expressions: [], scenes: [] },
    lorebook: [],
    visibility: 'private',
  }
}

function pill(selected: boolean) {
  return cn(
    'rounded-full border px-3 py-1 text-sm transition',
    selected
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-muted text-muted-foreground hover:text-foreground'
  )
}

export default function CreateCharacterWizard() {
  const [draft, setDraft] = useState<StudioDraft>(buildEmptyDraft)
  const [currentStep, setCurrentStep] = useState(0)
  const [status, setStatus] = useState<string | null>(null)

  const expressionTargetText = useMemo(() => {
    const count = draft.assets.expressions.length
    if (count >= 7) return `${count}/7 (target 5–7 expressions)`
    return `${count}/7 (aim for 5–7 expressions)`
  }, [draft.assets.expressions.length])

  const sceneTargetText = useMemo(() => {
    const count = draft.assets.scenes.length
    if (count >= 2) return `${count}/2 (target 2 scenes)`
    return `${count}/2 (aim for 2 scenes)`
  }, [draft.assets.scenes.length])

  const addExpression = () => {
    const label = window.prompt('Label for this expression (e.g., shy, smile)')?.trim()
    if (!label) return
    setDraft((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        expressions: [...prev.assets.expressions, { id: crypto.randomUUID(), label }],
      },
    }))
  }

  const addScene = () => {
    const label = window.prompt('Scene label (e.g., cafe afternoon, home night)')?.trim()
    if (!label) return
    setDraft((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        scenes: [...prev.assets.scenes, { id: crypto.randomUUID(), label }],
      },
    }))
  }

  const removeExpression = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        expressions: prev.assets.expressions.filter((item) => item.id !== id),
      },
    }))
  }

  const removeScene = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        scenes: prev.assets.scenes.filter((item) => item.id !== id),
      },
    }))
  }

  const addLoreEntry = () => {
    const keyword = window.prompt('Keyword trigger? (e.g., coffee, rooftop)')?.trim()
    if (!keyword) return
    const text = window.prompt('Lore text to inject when keyword appears?')?.trim()
    if (!text) return
    setDraft((prev) => ({
      ...prev,
      lorebook: [...prev.lorebook, { id: crypto.randomUUID(), keyword, text }],
    }))
  }

  const removeLore = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      lorebook: prev.lorebook.filter((entry) => entry.id !== id),
    }))
  }

  const toggleCategory = (category: string) => {
    setDraft((prev) => {
      const exists = prev.tags.categories.includes(category)
      return {
        ...prev,
        tags: {
          ...prev.tags,
          categories: exists
            ? prev.tags.categories.filter((c) => c !== category)
            : [...prev.tags.categories, category],
        },
      }
    })
  }

  const handleSubmit = () => {
    setStatus('Submitted (stub) — see console for payload.')
    // eslint-disable-next-line no-console
    console.log('Studio draft submission', draft)
  }

  const StepNav = () => (
    <div className="flex flex-wrap gap-2">
      {steps.map((label, index) => (
        <div
          key={label}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            index === currentStep
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {label}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Studio</p>
          <h1 className="mt-2 text-3xl font-semibold">Create Character Wizard (v0)</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Minimal, internal-only scaffolding for character creation. Required fields are capped and
            we stub asset handling and submission for now.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/studio">Back to Studio</Link>
        </Button>
      </div>

      <StepNav />

      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Keep it short; helpers can be added later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                maxLength={20}
                placeholder="Enter character name"
                value={draft.profile.name}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, profile: { ...prev.profile, name: e.target.value } }))
                }
              />
              <p className="text-xs text-muted-foreground">{draft.profile.name.length}/20</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intro">Short Introduction</Label>
              <textarea
                id="intro"
                maxLength={500}
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="One or two sentences to set the vibe"
                value={draft.profile.intro}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, profile: { ...prev.profile, intro: e.target.value } }))
                }
              />
              <p className="text-xs text-muted-foreground">{draft.profile.intro.length}/500</p>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Character Core / Detailed Settings</CardTitle>
            <CardDescription>
              Appearance, backstory, boundaries, occupation—everything that defines this character.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              maxLength={5000}
              className="min-h-[260px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Appearance, backstory, current stressor, likes/dislikes, boundaries, goals..."
              value={draft.details}
              onChange={(e) => setDraft((prev) => ({ ...prev, details: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{draft.details.length}/5000</p>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Opening</CardTitle>
            <CardDescription>Require an initial situation + first line so the character starts strong.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="situation">Situation</Label>
              <textarea
                id="situation"
                maxLength={1000}
                className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Door opens, you meet at the counter..."
                value={draft.opening.situation}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    opening: { ...prev.opening, situation: e.target.value },
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">{draft.opening.situation.length}/1000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstLine">First Line</Label>
              <textarea
                id="firstLine"
                maxLength={500}
                className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="“Insert the card at the front... oh, the other way around.”"
                value={draft.opening.firstLine}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    opening: { ...prev.opening, firstLine: e.target.value },
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">{draft.opening.firstLine.length}/500</p>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Tags & Safety</CardTitle>
            <CardDescription>Collect discovery + safety metadata during creation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Orientation</Label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'female', 'male'] as Orientation[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={pill(draft.tags.orientation === value)}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        tags: { ...prev.tags, orientation: value },
                      }))
                    }
                  >
                    {value === 'all' ? 'All' : value === 'female' ? 'Female-oriented' : 'Male-oriented'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium">Content rating</p>
                <p className="text-xs text-muted-foreground">Toggle adult if content is not SFW.</p>
              </div>
              <Switch
                checked={draft.tags.rating === 'adult'}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    tags: { ...prev.tags, rating: checked ? 'adult' : 'sfw' },
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">
                {draft.tags.rating === 'adult' ? 'Adult' : 'SFW'}
              </span>
            </div>

            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={pill(draft.tags.categories.includes(category))}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose at least one. Romance / slice-of-life / fantasy are common here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>
              Stubbed for now. Target: hero avatar + 5–7 expressions + 2 scenes. Track progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Hero Avatar</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setDraft((prev) => ({
                      ...prev,
                      assets: { ...prev.assets, hero: file.name },
                    }))
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {draft.assets.hero ? `Selected: ${draft.assets.hero}` : 'No file selected'}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Expressions</p>
                  <p className="text-xs text-muted-foreground">{expressionTargetText}</p>
                </div>
                <Button variant="outline" onClick={addExpression}>Add expression</Button>
              </div>
              {draft.assets.expressions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expressions added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draft.assets.expressions.map((expr) => (
                    <span
                      key={expr.id}
                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                    >
                      {expr.label}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => removeExpression(expr.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Scenes</p>
                  <p className="text-xs text-muted-foreground">{sceneTargetText}</p>
                </div>
                <Button variant="outline" onClick={addScene}>Add scene</Button>
              </div>
              {draft.assets.scenes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scenes added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draft.assets.scenes.map((scene) => (
                    <span
                      key={scene.id}
                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                    >
                      {scene.label}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => removeScene(scene.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Lorebook (optional)</CardTitle>
            <CardDescription>Keyword-triggered inserts for world info or callbacks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={addLoreEntry}>Add lore entry</Button>
            {draft.lorebook.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lore entries added.</p>
            ) : (
              <div className="space-y-2">
                {draft.lorebook.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between rounded-md border border-border bg-card/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">Keyword: {entry.keyword}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{entry.text}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeLore(entry.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Internal-only. We log the JSON payload and will wire storage later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm font-medium">Visibility</Label>
              {(['private', 'link-only'] as Visibility[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={pill(draft.visibility === value)}
                  onClick={() => setDraft((prev) => ({ ...prev, visibility: value }))}
                >
                  {value === 'private' ? 'Private' : 'Link-only'}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
              <pre className="max-h-[420px] overflow-auto p-4 text-xs">
{JSON.stringify(draft, null, 2)}
              </pre>
            </div>

            {status && <p className="text-sm text-primary">{status}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
          disabled={currentStep === 0}
        >
          Back
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={() => setCurrentStep((step) => Math.min(steps.length - 1, step + 1))}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Submit (stub)</Button>
        )}
      </div>
    </div>
  )
}
