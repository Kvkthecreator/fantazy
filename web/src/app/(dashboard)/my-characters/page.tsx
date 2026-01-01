"use client";

import { useEffect, useState } from "react";
import { api, APIError } from "@/lib/api/client";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCharacterCard } from "@/components/characters/UserCharacterCard";
import { UserCharacterForm } from "@/components/characters/UserCharacterForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, UserCircle2, AlertTriangle } from "lucide-react";
import type { UserCharacter, UserCharacterCreate } from "@/types";
import Link from "next/link";

const MAX_FREE_CHARACTERS = 1;

export default function MyCharactersPage() {
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCharacter, setDeletingCharacter] = useState<UserCharacter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load characters on mount
  useEffect(() => {
    loadCharacters();
  }, []);

  async function loadCharacters() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.userCharacters.list();
      setCharacters(data);
    } catch (err) {
      console.error("Failed to load characters:", err);
      if (err instanceof APIError) {
        const data = err.data as { detail?: string } | null;
        setError(data?.detail || "Failed to load characters");
      } else {
        setError("Failed to load characters");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(data: UserCharacterCreate) {
    setIsSubmitting(true);
    try {
      const newCharacter = await api.userCharacters.create(data);
      setCharacters((prev) => [...prev, newCharacter]);
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleDelete() {
    if (!deletingCharacter) return;
    setIsDeleting(true);
    try {
      await api.userCharacters.delete(deletingCharacter.id);
      setCharacters((prev) => prev.filter((c) => c.id !== deletingCharacter.id));
      setDeleteConfirmOpen(false);
      setDeletingCharacter(null);
    } catch (err) {
      console.error("Failed to delete character:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  function openCreateForm() {
    setCreateFormOpen(true);
  }

  function openDeleteConfirm(character: UserCharacter) {
    setDeletingCharacter(character);
    setDeleteConfirmOpen(true);
  }

  const canCreateMore = characters.length < MAX_FREE_CHARACTERS;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="My Characters"
          description="Create and manage your custom characters"
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load characters</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadCharacters}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader
          title="My Characters"
          description="Create and manage your custom characters"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {characters.length}/{MAX_FREE_CHARACTERS} free slots
          </span>
          <Button
            onClick={openCreateForm}
            disabled={!canCreateMore}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Character
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <UserCircle2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No characters yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create your first character to play in episodes. Your character will
            inherit the story's situation while bringing their own unique personality.
          </p>
          <Button onClick={openCreateForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Character
          </Button>
        </div>
      ) : (
        /* Character grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {characters.map((character) => (
            <UserCharacterCard
              key={character.id}
              character={character}
              onDelete={openDeleteConfirm}
            />
          ))}

          {/* "Add" placeholder card if can create more */}
          {canCreateMore && characters.length > 0 && (
            <button
              onClick={openCreateForm}
              className="aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Add Character</span>
            </button>
          )}
        </div>
      )}


      {/* Create Form Modal */}
      <UserCharacterForm
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        onSubmit={async (data) => {
          await handleCreate(data as UserCharacterCreate);
        }}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Delete Character</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingCharacter?.name}
              </span>
              ? This action cannot be undone.
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
