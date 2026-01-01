"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import type {
  UserCharacter,
  UserCharacterCreate,
  UserCharacterUpdate,
  UserArchetype,
  FlirtingLevel,
} from "@/types";

interface UserCharacterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character?: UserCharacter | null;
  onSubmit: (data: UserCharacterCreate | UserCharacterUpdate) => Promise<void>;
  isLoading?: boolean;
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

export function UserCharacterForm({
  open,
  onOpenChange,
  character,
  onSubmit,
  isLoading = false,
}: UserCharacterFormProps) {
  const isEditing = !!character;

  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<UserArchetype>("warm_supportive");
  const [flirtingLevel, setFlirtingLevel] = useState<FlirtingLevel>("playful");
  const [appearancePrompt, setAppearancePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens or character changes
  useEffect(() => {
    if (open) {
      if (character) {
        setName(character.name);
        setArchetype(character.archetype);
        setFlirtingLevel(character.flirting_level);
        setAppearancePrompt(character.appearance_prompt || "");
      } else {
        setName("");
        setArchetype("warm_supportive");
        setFlirtingLevel("playful");
        setAppearancePrompt("");
      }
      setError(null);
    }
  }, [open, character]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (name.length < 2 || name.length > 50) {
      setError("Name must be between 2 and 50 characters");
      return;
    }

    try {
      const data: UserCharacterCreate | UserCharacterUpdate = {
        name: name.trim(),
        archetype,
        flirting_level: flirtingLevel,
        appearance_prompt: appearancePrompt.trim() || undefined,
      };

      await onSubmit(data);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save character");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Character" : "Create Character"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your character's details."
              : "Create a new character to play in episodes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter character name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              maxLength={50}
            />
          </div>

          {/* Archetype */}
          <div className="space-y-2">
            <Label htmlFor="archetype">Personality Archetype</Label>
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
                    <div className="flex flex-col">
                      <span>{a.label}</span>
                    </div>
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
            <Label htmlFor="flirting-level">Flirting Style</Label>
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
                    <div className="flex flex-col">
                      <span>{f.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {FLIRTING_LEVELS.find((f) => f.value === flirtingLevel)?.description}
            </p>
          </div>

          {/* Appearance Prompt */}
          <div className="space-y-2">
            <Label htmlFor="appearance">
              Appearance Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="appearance"
              placeholder="Describe your character's appearance for avatar generation..."
              value={appearancePrompt}
              onChange={(e) => setAppearancePrompt(e.target.value)}
              disabled={isLoading}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {appearancePrompt.length}/500 characters
            </p>
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
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Character"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
