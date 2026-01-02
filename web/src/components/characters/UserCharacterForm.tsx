"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  UserCharacter,
  UserCharacterCreate,
  UserCharacterUpdate,
  UserArchetype,
  FlirtingLevel,
  StylePreset,
} from "@/types";

interface UserCharacterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character?: UserCharacter | null;
  onSubmit: (data: UserCharacterCreate | UserCharacterUpdate) => Promise<void>;
  isLoading?: boolean;
}

// =============================================================================
// Appearance Builder Options
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

// =============================================================================
// Style Presets
// =============================================================================

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
// Personality Options
// =============================================================================

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

// =============================================================================
// Main Form Component
// =============================================================================

export function UserCharacterForm({
  open,
  onOpenChange,
  character,
  onSubmit,
  isLoading = false,
}: UserCharacterFormProps) {
  const isEditing = !!character;

  // Basic info
  const [name, setName] = useState("");

  // Appearance builder selections
  const [gender, setGender] = useState<string | null>(null);
  const [ethnicity, setEthnicity] = useState<string | null>(null);
  const [hairColor, setHairColor] = useState<string | null>(null);
  const [hairStyle, setHairStyle] = useState<string | null>(null);
  const [eyeColor, setEyeColor] = useState<string | null>(null);
  const [build, setBuild] = useState<string | null>(null);
  const [extraDetails, setExtraDetails] = useState("");

  // Style
  const [stylePreset, setStylePreset] = useState<StylePreset>("manhwa");

  // Personality
  const [archetype, setArchetype] = useState<UserArchetype>("warm_supportive");
  const [flirtingLevel, setFlirtingLevel] = useState<FlirtingLevel>("playful");

  // UI state
  const [error, setError] = useState<string | null>(null);

  // Build appearance prompt from selections
  const appearancePrompt = useMemo(() => {
    const parts: string[] = [];

    // Gender + ethnicity
    if (gender && ethnicity) {
      const genderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label.toLowerCase();
      const ethnicityLabel = ETHNICITY_OPTIONS.find(e => e.value === ethnicity)?.label;
      parts.push(`${ethnicityLabel} ${genderLabel}`);
    } else if (gender) {
      const genderLabel = GENDER_OPTIONS.find(g => g.value === gender)?.label.toLowerCase();
      parts.push(`young ${genderLabel}`);
    }

    // Hair
    if (hairColor && hairStyle) {
      const colorLabel = HAIR_COLOR_OPTIONS.find(c => c.value === hairColor)?.label.toLowerCase();
      const styleLabel = HAIR_STYLE_OPTIONS.find(s => s.value === hairStyle)?.label.toLowerCase();
      parts.push(`${styleLabel} ${colorLabel} hair`);
    } else if (hairColor) {
      const colorLabel = HAIR_COLOR_OPTIONS.find(c => c.value === hairColor)?.label.toLowerCase();
      parts.push(`${colorLabel} hair`);
    }

    // Eyes
    if (eyeColor) {
      const colorLabel = EYE_COLOR_OPTIONS.find(c => c.value === eyeColor)?.label.toLowerCase();
      parts.push(`${colorLabel} eyes`);
    }

    // Build
    if (build) {
      const buildLabel = BUILD_OPTIONS.find(b => b.value === build)?.label.toLowerCase();
      parts.push(`${buildLabel} build`);
    }

    // Extra details
    if (extraDetails.trim()) {
      parts.push(extraDetails.trim());
    }

    return parts.join(", ");
  }, [gender, ethnicity, hairColor, hairStyle, eyeColor, build, extraDetails]);

  // Check if we have minimum appearance info
  const hasMinimumAppearance = gender !== null && (hairColor !== null || ethnicity !== null);

  // Reset form when dialog opens or character changes
  useEffect(() => {
    if (open) {
      if (character) {
        setName(character.name);
        setArchetype(character.archetype);
        setFlirtingLevel(character.flirting_level);
        setStylePreset(character.style_preset || "manhwa");
        // For editing, put existing prompt in extra details
        // (we can't reverse-parse the structured selections)
        setExtraDetails(character.appearance_prompt || "");
        // Clear structured selections for edit mode
        setGender(null);
        setEthnicity(null);
        setHairColor(null);
        setHairStyle(null);
        setEyeColor(null);
        setBuild(null);
      } else {
        // Reset for new character
        setName("");
        setGender(null);
        setEthnicity(null);
        setHairColor(null);
        setHairStyle(null);
        setEyeColor(null);
        setBuild(null);
        setExtraDetails("");
        setStylePreset("manhwa");
        setArchetype("warm_supportive");
        setFlirtingLevel("playful");
      }
      setError(null);
    }
  }, [open, character]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (name.length < 2 || name.length > 30) {
      setError("Name must be between 2 and 30 characters");
      return;
    }

    // For new characters, validate appearance
    if (!isEditing) {
      if (!hasMinimumAppearance && !extraDetails.trim()) {
        setError("Please select appearance options or describe your character");
        return;
      }

      const finalAppearance = appearancePrompt || extraDetails.trim();
      if (finalAppearance.length < 10) {
        setError("Appearance description must be at least 10 characters");
        return;
      }
    }

    try {
      const finalAppearance = appearancePrompt || extraDetails.trim();

      if (isEditing) {
        // For updates, only send changed fields
        const updateData: UserCharacterUpdate = {
          name: name.trim(),
          archetype,
          flirting_level: flirtingLevel,
        };
        // Only include appearance if extra details were modified
        if (extraDetails.trim() && extraDetails !== character?.appearance_prompt) {
          updateData.appearance_prompt = extraDetails.trim();
        }
        await onSubmit(updateData);
      } else {
        // For creation, send full data
        const createData: UserCharacterCreate = {
          name: name.trim(),
          appearance_prompt: finalAppearance,
          archetype,
          flirting_level: flirtingLevel,
          style_preset: stylePreset,
        };
        await onSubmit(createData);
      }

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save character");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Character" : "Create Your Character"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your character's details."
              : "Design a character to play in episodes. They'll bring your personality into the story."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Section 1: Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter character name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              maxLength={30}
            />
          </div>

          {/* Section 2: Appearance Builder (only for new characters) */}
          {!isEditing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-base">Appearance</Label>
                <span className="text-xs text-muted-foreground">(select options to build)</span>
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Gender</Label>
                <ChipSelector
                  options={GENDER_OPTIONS}
                  value={gender}
                  onChange={setGender}
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                  rows={2}
                  maxLength={200}
                />
              </div>

              {/* Generated Preview */}
              {appearancePrompt && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm">{appearancePrompt}</p>
                </div>
              )}
            </div>
          )}

          {/* For editing, show simple textarea */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="appearance">Appearance Description</Label>
              <Textarea
                id="appearance"
                placeholder="Describe your character's appearance..."
                value={extraDetails}
                onChange={(e) => setExtraDetails(e.target.value)}
                disabled={isLoading}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {extraDetails.length}/500 characters
              </p>
            </div>
          )}

          {/* Section 3: Art Style (only for new characters) */}
          {!isEditing && (
            <div className="space-y-3">
              <Label className="text-base">Art Style</Label>
              <div className="grid grid-cols-3 gap-3">
                {STYLE_PRESETS.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setStylePreset(style.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      "hover:border-primary/50 hover:bg-accent",
                      stylePreset === style.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border",
                      isLoading && "opacity-50 cursor-not-allowed"
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
          )}

          {/* Section 4: Personality */}
          <div className="space-y-4">
            <Label className="text-base">Personality</Label>

            {/* Archetype */}
            <div className="space-y-2">
              <Label htmlFor="archetype" className="text-sm text-muted-foreground">
                Archetype
              </Label>
              <Select
                value={archetype}
                onValueChange={(value) => setArchetype(value as UserArchetype)}
                disabled={isLoading}
              >
                <SelectTrigger id="archetype">
                  <SelectValue placeholder="Select archetype" />
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
              <Label htmlFor="flirting-level" className="text-sm text-muted-foreground">
                Flirting Style
              </Label>
              <Select
                value={flirtingLevel}
                onValueChange={(value) => setFlirtingLevel(value as FlirtingLevel)}
                disabled={isLoading}
              >
                <SelectTrigger id="flirting-level">
                  <SelectValue placeholder="Select flirting style" />
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
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1 gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create Character
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
