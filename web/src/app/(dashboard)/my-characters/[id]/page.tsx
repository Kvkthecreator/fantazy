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
import { ArrowLeft, UserCircle2, Save, Trash2, Loader2, Sparkles } from "lucide-react";
import type { UserCharacter, UserArchetype, FlirtingLevel } from "@/types";

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

  // Edit form state
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<UserArchetype>("warm_supportive");
  const [flirtingLevel, setFlirtingLevel] = useState<FlirtingLevel>("playful");
  const [appearancePrompt, setAppearancePrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Avatar generation
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Load character on mount
  useEffect(() => {
    loadCharacter();
  }, [id]);

  // Track changes
  useEffect(() => {
    if (character) {
      const changed =
        name !== character.name ||
        archetype !== character.archetype ||
        flirtingLevel !== character.flirting_level ||
        appearancePrompt !== (character.appearance_prompt || "");
      setHasChanges(changed);
    }
  }, [name, archetype, flirtingLevel, appearancePrompt, character]);

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
      setAppearancePrompt(data.appearance_prompt || "");
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

  async function handleSave() {
    if (!character || !hasChanges) return;

    setIsSaving(true);
    try {
      const updated = await api.userCharacters.update(character.id, {
        name: name.trim(),
        archetype,
        flirting_level: flirtingLevel,
        appearance_prompt: appearancePrompt.trim() || undefined,
      });
      setCharacter(updated);
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

  async function handleGenerateAvatar() {
    if (!character) return;

    setIsGeneratingAvatar(true);
    setAvatarError(null);
    try {
      const result = await api.userCharacters.generateAvatar(
        character.id,
        appearancePrompt || undefined
      );
      // Update the character with the new avatar
      setCharacter({
        ...character,
        avatar_url: result.avatar_url,
      });
    } catch (err) {
      console.error("Failed to generate avatar:", err);
      if (err instanceof APIError) {
        const data = err.data as { detail?: string } | null;
        setAvatarError(data?.detail || "Failed to generate avatar");
      } else {
        setAvatarError("Failed to generate avatar");
      }
    } finally {
      setIsGeneratingAvatar(false);
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
                <img
                  src={character.avatar_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
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
              {/* Generate Avatar Button */}
              <div className="pt-2">
                <Button
                  size="sm"
                  variant={character.avatar_url ? "outline" : "default"}
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  className="gap-2"
                >
                  {isGeneratingAvatar ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {character.avatar_url ? "Regenerate Avatar" : "Generate Avatar"}
                    </>
                  )}
                </Button>
                {avatarError && (
                  <p className="text-xs text-destructive mt-1">{avatarError}</p>
                )}
              </div>
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
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {appearancePrompt.length}/500 characters
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
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
