"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollRow } from "@/components/ui/scroll-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageOff, MessageCircle, Sparkles, MoreVertical, Download, Trash2, ChevronDown, BookOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneGalleryItem, RelationshipWithCharacter } from "@/types";

type GroupBy = "series" | "character" | "none";

interface GroupedScenes {
  key: string;
  label: string;
  sublabel?: string;
  scenes: SceneGalleryItem[];
}

export default function GalleryPage() {
  const [scenes, setScenes] = useState<SceneGalleryItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("series");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SceneGalleryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load relationships for filter
  useEffect(() => {
    api.relationships.list()
      .then(setRelationships)
      .catch(console.error);
  }, []);

  // Load scenes
  useEffect(() => {
    async function loadScenes() {
      setIsLoading(true);
      try {
        const params: { character_id?: string; limit?: number } = { limit: 100 };
        if (selectedCharacter !== "all") {
          params.character_id = selectedCharacter;
        }
        const data = await api.scenes.listGallery(params);
        setScenes(data);
      } catch (err) {
        console.error("Failed to load scenes:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadScenes();
  }, [selectedCharacter]);

  // Group scenes based on groupBy setting
  const groupedScenes = useMemo((): GroupedScenes[] => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All Images", scenes }];
    }

    const groups = new Map<string, GroupedScenes>();

    for (const scene of scenes) {
      let key: string;
      let label: string;
      let sublabel: string | undefined;

      if (groupBy === "series") {
        if (scene.series_title) {
          key = scene.series_title;
          label = scene.series_title;
          sublabel = scene.character_name;
        } else {
          key = `free-chat-${scene.character_id}`;
          label = "Free Chat";
          sublabel = scene.character_name;
        }
      } else {
        // group by character
        key = scene.character_id;
        label = scene.character_name;
      }

      if (!groups.has(key)) {
        groups.set(key, { key, label, sublabel, scenes: [] });
      }
      groups.get(key)!.scenes.push(scene);
    }

    // Sort groups: series with content first, then free chat
    return Array.from(groups.values()).sort((a, b) => {
      if (a.label === "Free Chat") return 1;
      if (b.label === "Free Chat") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [scenes, groupBy]);

  const handleDownload = async (scene: SceneGalleryItem) => {
    try {
      const response = await fetch(scene.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scene-${scene.image_id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.scenes.delete(deleteTarget.image_id);
      setScenes((prev) => prev.filter((s) => s.image_id !== deleteTarget.image_id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete scene:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
          <p className="text-muted-foreground">
            {scenes.length} {scenes.length === 1 ? "moment" : "moments"} captured
          </p>
        </div>

        {/* Group by selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Group by: {groupBy === "series" ? "Series" : groupBy === "character" ? "Character" : "None"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setGroupBy("series")}>
              Series
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("character")}>
              Character
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("none")}>
              None (flat list)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Character filter tabs */}
      {relationships.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCharacter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCharacter("all")}
            className="rounded-full"
          >
            All
          </Button>
          {relationships.map((rel) => (
            <Button
              key={rel.character_id}
              variant={selectedCharacter === rel.character_id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCharacter(rel.character_id)}
              className="rounded-full"
            >
              {rel.character_name}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <ScenesGridSkeleton />
      ) : scenes.length === 0 ? (
        <EmptyState hasRelationships={relationships.length > 0} />
      ) : (
        <div className="space-y-8">
          {groupedScenes.map((group) => {
            const icon = groupBy === "series"
              ? <BookOpen className="h-5 w-5 text-primary" />
              : groupBy === "character"
              ? <Users className="h-5 w-5 text-primary" />
              : null;

            // For "none" mode, show flat grid
            if (groupBy === "none") {
              return (
                <div key={group.key} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.scenes.map((scene) => (
                    <SceneCard
                      key={scene.image_id}
                      scene={scene}
                      onDownload={() => handleDownload(scene)}
                      onDelete={() => setDeleteTarget(scene)}
                      showEpisode={false}
                    />
                  ))}
                </div>
              );
            }

            // For grouped modes, use ScrollRow
            return (
              <ScrollRow
                key={group.key}
                title={group.label}
                icon={icon}
              >
                {group.scenes.map((scene) => (
                  <div
                    key={scene.image_id}
                    className="flex-shrink-0 snap-start w-[200px] sm:w-[240px]"
                  >
                    <SceneCard
                      scene={scene}
                      onDownload={() => handleDownload(scene)}
                      onDelete={() => setDeleteTarget(scene)}
                      showEpisode={groupBy === "series"}
                    />
                  </div>
                ))}
              </ScrollRow>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The image will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SceneCard({
  scene,
  onDownload,
  onDelete,
  showEpisode,
}: {
  scene: SceneGalleryItem;
  onDownload: () => void;
  onDelete: () => void;
  showEpisode: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative aspect-square bg-muted">
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff className="h-12 w-12 text-muted-foreground/50" />
          </div>
        ) : (
          <>
            {!imageLoaded && (
              <Skeleton className="absolute inset-0" />
            )}
            <img
              src={scene.image_url}
              alt={scene.episode_title || "A scene"}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Minimal caption */}
      {showEpisode && scene.episode_title && (
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground truncate">
            {scene.episode_title}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function EmptyState({ hasRelationships }: { hasRelationships: boolean }) {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-3xl mb-6">
          <Sparkles className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No images yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          {hasRelationships
            ? "During your conversations, tap the ✨ button to capture moments as images."
            : "Start chatting with a character and create visual moments from your story."}
        </p>
        {hasRelationships ? (
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Continue a conversation
            </Button>
          </Link>
        ) : (
          <Link href="/discover">
            <Button className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Discover characters
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function ScenesGridSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="flex-shrink-0 w-[200px] sm:w-[240px] aspect-square rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="flex-shrink-0 w-[200px] sm:w-[240px] aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
