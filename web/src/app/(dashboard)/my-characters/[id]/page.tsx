"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, APIError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowLeft, UserCircle2, Save, Trash2, Loader2, Sparkles, Download, X } from "lucide-react";
import type { UserCharacter, UserArchetype, FlirtingLevel, StylePreset } from "@/types";

// =============================================================================
// Appearance Builder Options (same as UserCharacterForm)
// =============================================================================

const GENDER_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non-binary", label: "Non-binary" },
] as const;

const ETHNICITY_OPTIONS = [
  { value: "east-asian", label: "East Asian" },
  { value: "southeast-asian", label: "Southeast Asian" },
  { value: "south-asian", label: "South Asian" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "black", label: "Black" },
  { value: "white", label: "White" },
  { value: "latino", label: "Latino/Hispanic" },
  { value: "mixed", label: "Mixed" },
] as const;

const HAIR_COLOR_OPTIONS = [
  { value: "black", label: "Black" },
  { value: "dark-brown", label: "Dark Brown" },
  { value: "light-brown", label: "Light Brown" },
  { value: "blonde", label: "Blonde" },
  { value: "red", label: "Red" },
  { value: "silver", label: "Silver/Gray" },
  { value: "blue", label: "Blue" },
  { value: "pink", label: "Pink" },
  { value: "purple", label: "Purple" },
] as const;

const HAIR_STYLE_OPTIONS = [
  { value: "long-straight", label: "Long & Straight" },
  { value: "long-wavy", label: "Long & Wavy" },
  { value: "shoulder-length", label: "Shoulder Length" },
  { value: "short", label: "Short" },
  { value: "pixie", label: "Pixie Cut" },
  { value: "curly", label: "Curly" },
  { value: "ponytail", label: "Ponytail" },
  { value: "bun", label: "Bun" },
] as const;

const EYE_COLOR_OPTIONS = [
  { value: "brown", label: "Brown" },
  { value: "dark-brown", label: "Dark Brown" },
  { value: "hazel", label: "Hazel" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "gray", label: "Gray" },
  { value: "golden", label: "Golden" },
] as const;

const BUILD_OPTIONS = [
  { value: "slim", label: "Slim" },
  { value: "athletic", label: "Athletic" },
  { value: "average", label: "Average" },
  { value: "curvy", label: "Curvy" },
  { value: "muscular", label: "Muscular" },
] as const;

const STYLE_PRESETS: { value: StylePreset; label: string; description: string }[] = [
  {
    value: "manhwa",
    label: "Webtoon",
    description: "Soft Korean manhwa style with dreamy pastels",
  },
  {
    value: "anime",
    label: "Anime",
    description: "Vibrant Japanese anime with expressive details",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    description: "Semi-realistic with romantic drama lighting",
  },
];

// =============================================================================
// Chip Selector Component
// =============================================================================

interface ChipSelectorProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: number;
}

function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  disabled,
  columns = 4,
}: ChipSelectorProps<T>) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        columns === 2 && "grid-cols-2"
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-2 text-sm rounded-lg border transition-all",
            "hover:border-primary/50 hover:bg-accent",
            value === option.value
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface CharacterDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const ARCHETYPES: { value: UserArchetype; label: string; description: string }[] = [
  {
    value: "warm_supportive",
    label: "Warm & Supportive",
    description: "Nurturing, empathetic, and emotionally available",
  },
  {
    value: "playful_teasing",
    label: "Playful & Teasing",
    description: "Witty, fun-loving, and charmingly mischievous",
  },
  {
    value: "mysterious_reserved",
    label: "Mysterious & Reserved",
    description: "Intriguing, thoughtful, and selectively open",
  },
  {
    value: "intense_passionate",
    label: "Intense & Passionate",
    description: "Deep, focused, and emotionally expressive",
  },
  {
    value: "confident_assertive",
    label: "Confident & Assertive",
    description: "Self-assured, direct, and naturally commanding",
  },
];

const FLIRTING_LEVELS: { value: FlirtingLevel; label: string; description: string }[] = [
  {
    value: "subtle",
    label: "Subtle",
    description: "Gentle hints and understated charm",
  },
  {
    value: "playful",
    label: "Playful",
    description: "Light teasing and friendly banter",
  },
  {
    value: "bold",
    label: "Bold",
    description: "Confident and direct expressions",
  },
  {
    value: "intense",
    label: "Intense",
    description: "Passionate and unmistakable attraction",
  },
];

export default function CharacterDetailPage({ params }: CharacterDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  // Character data
  const [character, setCharacter] = useState<UserCharacter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state - basic info
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<UserArchetype>("warm_supportive");
  const [flirtingLevel, setFlirtingLevel] = useState<FlirtingLevel>("playful");

  // Edit form state - appearance builder
  const [gender, setGender] = useState<string | null>(null);
  const [ethnicity, setEthnicity] = useState<string | null>(null);
  const [hairColor, setHairColor] = useState<string | null>(null);
  const [hairStyle, setHairStyle] = useState<string | null>(null);
  const [eyeColor, setEyeColor] = useState<string | null>(null);
  const [build, setBuild] = useState<string | null>(null);
  const [extraDetails, setExtraDetails] = useState("");

  // Edit form state - style
  const [stylePreset, setStylePreset] = useState<StylePreset>("manhwa");

  // Legacy appearance prompt (for display/fallback)
  const [originalAppearancePrompt, setOriginalAppearancePrompt] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Avatar generation (triggered automatically when saving appearance/style changes)
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Image lightbox
  const [expandedImage, setExpandedImage] = useState<{ url: string; title: string } | null>(null);

  // Build appearance prompt from selections
  const buildAppearancePrompt = (): string => {
    const parts: string[] = [];

    if (gender && ethnicity) {
      const genderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label.toLowerCase();
      const ethnicityLabel = ETHNICITY_OPTIONS.find(e => e.value === ethnicity)?.label;
      parts.push(`${ethnicityLabel} ${genderLabel}`);
    } else if (gender) {
      const genderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label.toLowerCase();
      parts.push(`young ${genderLabel}`);
    }

    if (hairColor && hairStyle) {
      const colorLabel = HAIR_COLOR_OPTIONS.find(c => c.value === hairColor)?.label.toLowerCase();
      const styleLabel = HAIR_STYLE_OPTIONS.find(s => s.value === hairStyle)?.label.toLowerCase();
      parts.push(`${styleLabel} ${colorLabel} hair`);
    } else if (hairColor) {
      const colorLabel = HAIR_COLOR_OPTIONS.find(c => c.value === hairColor)?.label.toLowerCase();
      parts.push(`${colorLabel} hair`);
    }

    if (eyeColor) {
      const colorLabel = EYE_COLOR_OPTIONS.find(c => c.value === eyeColor)?.label.toLowerCase();
      parts.push(`${colorLabel} eyes`);
    }

    if (build) {
      const buildLabel = BUILD_OPTIONS.find(b => b.value === build)?.label.toLowerCase();
      parts.push(`${buildLabel} build`);
    }

    if (extraDetails.trim()) {
      parts.push(extraDetails.trim());
    }

    return parts.join(", ");
  };

  // Check if appearance builder has selections
  const hasAppearanceSelections = gender !== null || hairColor !== null || ethnicity !== null;

  // Get final appearance prompt (builder takes priority if user made selections)
  const getFinalAppearancePrompt = (): string => {
    if (hasAppearanceSelections) {
      return buildAppearancePrompt();
    }
    // Fall back to extra details or original
    return extraDetails.trim() || originalAppearancePrompt;
  };

  // Load character on mount
  useEffect(() => {
    loadCharacter();
  }, [id]);

  // Track changes
  useEffect(() => {
    if (character) {
      const currentAppearance = getFinalAppearancePrompt();
      const changed =
        name !== character.name ||
        archetype !== character.archetype ||
        flirtingLevel !== character.flirting_level ||
        stylePreset !== (character.style_preset || "manhwa") ||
        currentAppearance !== (character.appearance_prompt || "");
      setHasChanges(changed);
    }
  }, [name, archetype, flirtingLevel, stylePreset, gender, ethnicity, hairColor, hairStyle, eyeColor, build, extraDetails, character]);

  // ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedImage) {
        setExpandedImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedImage]);

  async function loadCharacter() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.userCharacters.get(id);
      setCharacter(data);
      // Initialize form with character data
      setName(data.name);
      setArchetype(data.archetype);
      setFlirtingLevel(data.flirting_level);
      setStylePreset((data.style_preset as StylePreset) || "manhwa");
      // Store original appearance prompt for display (user can rebuild with chips)
      setOriginalAppearancePrompt(data.appearance_prompt || "");
      // Reset builder state - user starts fresh when editing
      setGender(null);
      setEthnicity(null);
      setHairColor(null);
      setHairStyle(null);
      setEyeColor(null);
      setBuild(null);
      setExtraDetails("");
    } catch (err) {
      console.error("Failed to load character:", err);
      if (err instanceof APIError && err.status === 404) {
        setError("Character not found");
      } else {
        setError("Failed to load character");
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Check if appearance or style changed (triggers avatar regeneration)
  const hasAppearanceOrStyleChanges = (): boolean => {
    if (!character) return false;
    const currentAppearance = getFinalAppearancePrompt();
    return (
      currentAppearance !== (character.appearance_prompt || "") ||
      stylePreset !== (character.style_preset || "manhwa")
    );
  };

  async function handleSave() {
    if (!character || !hasChanges) return;

    const finalAppearance = getFinalAppearancePrompt();
    const needsAvatarRegeneration = hasAppearanceOrStyleChanges();

    setIsSaving(true);
    setAvatarError(null);

    try {
      // 1. Save character data
      const updated = await api.userCharacters.update(character.id, {
        name: name.trim(),
        archetype,
        flirting_level: flirtingLevel,
        appearance_prompt: finalAppearance || undefined,
        style_preset: stylePreset,
      });

      // 2. If appearance/style changed, regenerate avatar
      if (needsAvatarRegeneration) {
        setIsGeneratingAvatar(true);
        try {
          const result = await api.userCharacters.generateAvatar(
            character.id,
            finalAppearance || undefined,
            stylePreset
          );
          // Update with new avatar
          setCharacter({
            ...updated,
            avatar_url: result.avatar_url,
          });
        } catch (avatarErr) {
          console.error("Failed to generate avatar:", avatarErr);
          // Still update character data, just show avatar error
          setCharacter(updated);
          if (avatarErr instanceof APIError) {
            if (avatarErr.status === 402) {
              const data = avatarErr.data as { message?: string } | null;
              setAvatarError(data?.message || "Insufficient sparks for avatar regeneration");
            } else {
              const data = avatarErr.data as { detail?: string } | null;
              setAvatarError(data?.detail || "Failed to regenerate avatar");
            }
          } else {
            setAvatarError("Failed to regenerate avatar");
          }
        } finally {
          setIsGeneratingAvatar(false);
        }
      } else {
        setCharacter(updated);
      }

      // Update original appearance after save
      setOriginalAppearancePrompt(finalAppearance);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!character) return;

    setIsDeleting(true);
    try {
      await api.userCharacters.delete(character.id);
      router.push("/my-characters");
    } catch (err) {
      console.error("Failed to delete:", err);
      setIsDeleting(false);
    }
  }

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error state
  if (error || !character) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">{error || "Character not found"}</p>
        <Button variant="outline" onClick={() => router.push("/my-characters")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Characters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/my-characters")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{character.name}</h1>
          <p className="text-sm text-muted-foreground">Edit your character</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Avatar Preview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Avatar */}
            <div className="w-32 h-40 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
              {isGeneratingAvatar ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Generating...</span>
                </div>
              ) : character.avatar_url ? (
                <button
                  type="button"
                  className="w-full h-full cursor-pointer"
                  onClick={() => setExpandedImage({ url: character.avatar_url!, title: character.name })}
                >
                  <img
                    src={character.avatar_url}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <UserCircle2 className="w-12 h-12 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground/60">No avatar</span>
                </div>
              )}
            </div>

            {/* Quick info */}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Archetype</p>
                <p className="font-medium">
                  {ARCHETYPES.find((a) => a.value === character.archetype)?.label ||
                    character.archetype}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Flirting Style</p>
                <Badge variant="secondary">
                  {FLIRTING_LEVELS.find((f) => f.value === character.flirting_level)?.label ||
                    character.flirting_level}
                </Badge>
              </div>
              {avatarError && (
                <p className="text-xs text-destructive mt-1">{avatarError}</p>
              )}
              {!character.avatar_url && (
                <p className="text-xs text-muted-foreground">
                  Avatar will be generated when you save appearance changes
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Archetype */}
          <div className="space-y-2">
            <Label htmlFor="archetype">Personality Archetype</Label>
            <Select
              value={archetype}
              onValueChange={(value) => setArchetype(value as UserArchetype)}
            >
              <SelectTrigger id="archetype">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ARCHETYPES.find((a) => a.value === archetype)?.description}
            </p>
          </div>

          {/* Flirting Level */}
          <div className="space-y-2">
            <Label htmlFor="flirting">Flirting Style</Label>
            <Select
              value={flirtingLevel}
              onValueChange={(value) => setFlirtingLevel(value as FlirtingLevel)}
            >
              <SelectTrigger id="flirting">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLIRTING_LEVELS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {FLIRTING_LEVELS.find((f) => f.value === flirtingLevel)?.description}
            </p>
          </div>

          {/* Appearance Builder Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-base">Appearance</Label>
              <span className="text-xs text-muted-foreground">(rebuild with chips or add details)</span>
            </div>

            {/* Show current appearance if no chips selected yet */}
            {!hasAppearanceSelections && originalAppearancePrompt && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Current appearance:</p>
                <p className="text-sm">{originalAppearancePrompt}</p>
              </div>
            )}

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Gender</Label>
              <ChipSelector
                options={GENDER_OPTIONS}
                value={gender}
                onChange={setGender}
                disabled={isSaving}
                columns={3}
              />
            </div>

            {/* Ethnicity/Features */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Features</Label>
              <ChipSelector
                options={ETHNICITY_OPTIONS}
                value={ethnicity}
                onChange={setEthnicity}
                disabled={isSaving}
                columns={4}
              />
            </div>

            {/* Hair Color */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Hair Color</Label>
              <ChipSelector
                options={HAIR_COLOR_OPTIONS}
                value={hairColor}
                onChange={setHairColor}
                disabled={isSaving}
                columns={3}
              />
            </div>

            {/* Hair Style */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Hair Style</Label>
              <ChipSelector
                options={HAIR_STYLE_OPTIONS}
                value={hairStyle}
                onChange={setHairStyle}
                disabled={isSaving}
                columns={4}
              />
            </div>

            {/* Eye Color */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Eye Color</Label>
              <ChipSelector
                options={EYE_COLOR_OPTIONS}
                value={eyeColor}
                onChange={setEyeColor}
                disabled={isSaving}
                columns={4}
              />
            </div>

            {/* Build */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Build</Label>
              <ChipSelector
                options={BUILD_OPTIONS}
                value={build}
                onChange={setBuild}
                disabled={isSaving}
                columns={3}
              />
            </div>

            {/* Extra Details */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Additional Details <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g. freckles, glasses, small scar on cheek, tattoo on wrist..."
                value={extraDetails}
                onChange={(e) => setExtraDetails(e.target.value)}
                disabled={isSaving}
                rows={2}
                maxLength={200}
              />
            </div>

            {/* Generated Preview (when chips selected) */}
            {hasAppearanceSelections && buildAppearancePrompt() && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">New appearance preview:</p>
                <p className="text-sm">{buildAppearancePrompt()}</p>
              </div>
            )}
          </div>

          {/* Art Style */}
          <div className="space-y-3">
            <Label className="text-base">Art Style</Label>
            <div className="grid grid-cols-3 gap-3">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  disabled={isSaving}
                  onClick={() => setStylePreset(style.value)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    "hover:border-primary/50 hover:bg-accent",
                    stylePreset === style.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="font-medium text-sm">{style.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {style.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex flex-col items-end gap-2">
            {hasChanges && hasAppearanceOrStyleChanges() && (
              <p className="text-xs text-muted-foreground">
                <Sparkles className="inline h-3 w-3 mr-1" />
                Avatar will be regenerated with new appearance
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isGeneratingAvatar}
              className="gap-2"
            >
              {isSaving || isGeneratingAvatar ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isGeneratingAvatar ? "Generating Avatar..." : "Saving..."}
                </>
              ) : (
                <>
                  {hasAppearanceOrStyleChanges() ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {hasAppearanceOrStyleChanges() ? "Save & Update Avatar" : "Save Changes"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Delete Character</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{character.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setExpandedImage(null)}
        >
          {/* Top controls */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
            <p className="text-white/80 text-sm">{expandedImage.title}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                title="Download image"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(expandedImage.url);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${expandedImage.title.toLowerCase().replace(/\s+/g, "-")}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch {
                    window.open(expandedImage.url, "_blank");
                  }
                }}
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                title="Close"
                onClick={() => setExpandedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main image */}
          <div className="relative max-w-3xl w-full max-h-[85vh] px-4">
            <img
              src={expandedImage.url}
              alt={expandedImage.title}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom hint */}
          <p className="absolute bottom-4 text-white/60 text-sm">
            Press ESC or click backdrop to close
          </p>
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
