"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCharacterProfile } from "@/hooks/useCharacters";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, MessageCircle, Heart, ThumbsDown, Sparkles, Camera, Info, X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { EpisodeSelector } from "@/components/episodes";
import type { Relationship } from "@/types";

interface CharacterProfilePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function CharacterProfilePage({ params }: CharacterProfilePageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { profile, isLoading, error } = useCharacterProfile(slug);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Load relationship if exists
  useEffect(() => {
    if (profile) {
      api.relationships.getByCharacter(profile.id)
        .then(setRelationship)
        .catch(() => setRelationship(null));
    }
  }, [profile]);

  const handleStartChat = async () => {
    if (!profile) return;
    setIsStartingChat(true);
    try {
      // Create relationship if doesn't exist
      if (!relationship) {
        await api.relationships.create(profile.id);
      }
      router.push(`/chat/${profile.id}`);
    } catch (err) {
      console.error("Failed to start chat:", err);
      setIsStartingChat(false);
    }
  };

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    const is404 = error?.message?.includes("404");
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">
          {is404 ? "Character not found" : "Unable to load character profile"}
        </p>
        {!is404 && (
          <p className="text-sm text-muted-foreground/70 mb-4">
            Please try again later
          </p>
        )}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const displayImages = profile.gallery.length > 0
    ? profile.gallery.map((g) => ({ url: g.url, label: g.label || "Portrait" }))
    : profile.avatar_url
      ? [{ url: profile.avatar_url, label: "Portrait" }]
      : [];

  const coverImage = displayImages[0]?.url || profile.avatar_url || null;
  const currentImage = displayImages[selectedImageIndex]?.url || coverImage;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative h-72 w-full">
          {coverImage ? (
            <button
              onClick={() => openLightbox(0)}
              className="h-full w-full cursor-zoom-in"
            >
              <img
                src={coverImage}
                alt={profile.name}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30 text-6xl font-bold text-white">
              {profile.name[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <button
              onClick={() => openLightbox(0)}
              className="h-16 w-16 rounded-full border-2 border-white/70 shadow-lg cursor-zoom-in overflow-hidden"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-white text-2xl font-semibold">
                  {profile.name[0]}
                </div>
              )}
            </button>
            <div className="text-white">
              <h1 className="text-2xl font-semibold">{profile.name}</h1>
              <p className="text-sm text-white/80 capitalize">{profile.archetype}</p>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            {profile.is_premium && (
              <Badge className="bg-white/90 text-yellow-800">
                <Sparkles className="mr-1 h-3 w-3" />
                Premium
              </Badge>
            )}
            {profile.content_rating && (
              <Badge variant="secondary" className="bg-white/80 text-foreground">
                {profile.content_rating.toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t bg-card/80 px-4 py-3">
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={handleStartChat}
            disabled={isStartingChat}
          >
            <MessageCircle className="h-5 w-5" />
            {relationship ? "Continue Chat" : "Chat with " + profile.name}
          </Button>
          <Button variant="outline" size="lg" className="gap-2">
            <Camera className="h-4 w-4" />
            Gallery
          </Button>
        </div>
      </div>

      {/* Episode Selection */}
      <EpisodeSelector
        characterId={profile.id}
        characterName={profile.name}
      />

      {/* Info + Gallery */}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {/* Tabs-ish layout */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                Profile
              </div>
              {profile.backstory && (
                <p className="text-base text-foreground whitespace-pre-line">
                  {profile.backstory}
                </p>
              )}
              {/* Conversation starters removed - now shown in chat via episode_template */}
            </CardContent>
          </Card>

          {(profile.likes.length > 0 || profile.dislikes.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.likes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <Heart className="h-4 w-4 text-primary" />
                      Likes
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.likes.map((like, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {like}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {profile.dislikes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <ThumbsDown className="h-4 w-4 text-muted-foreground" />
                      Dislikes
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.dislikes.map((dislike, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {dislike}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Gallery</p>
            {relationship && (
              <span className="text-xs text-muted-foreground">
                {relationship.total_episodes} episodes · {relationship.total_messages} messages
              </span>
            )}
          </div>
          {/* Main image */}
          <button
            onClick={() => openLightbox(selectedImageIndex)}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border bg-muted cursor-zoom-in"
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={profile.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-muted-foreground/60">
                {profile.name[0]}
              </div>
            )}
          </button>
          {/* Thumbnails */}
          {displayImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {displayImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border",
                    selectedImageIndex === index
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border/60 opacity-80 hover:opacity-100"
                  )}
                >
                  <img
                    src={img.url}
                    alt={img.label}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxOpen && displayImages.length > 0 && (
        <ImageLightbox
          images={displayImages}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onIndexChange={setLightboxIndex}
          characterName={profile.name}
        />
      )}
    </div>
  );
}

/* Image Lightbox Modal */
interface ImageLightboxProps {
  images: Array<{ url: string; label: string }>;
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  characterName: string;
}

function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onIndexChange,
  characterName,
}: ImageLightboxProps) {
  const currentImage = images[currentIndex];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        onIndexChange(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [currentIndex, images.length, onClose, onIndexChange]);

  const handleDownload = async () => {
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${characterName.toLowerCase().replace(/\s+/g, "-")}-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
      // Fallback: open in new tab
      window.open(currentImage.url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Controls - Top */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <div className="text-white/80 text-sm">
          {images.length > 1 && `${currentIndex + 1} / ${images.length}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
            title="Download image"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Image */}
      <div className="relative z-10 max-h-[85vh] max-w-[90vw] flex items-center justify-center">
        <img
          src={currentImage.url}
          alt={currentImage.label}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        />
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onIndexChange(currentIndex - 1)}
              className="absolute left-4 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {currentIndex < images.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onIndexChange(currentIndex + 1)}
              className="absolute right-4 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10 px-4">
          <div className="flex gap-2 overflow-x-auto p-2 bg-black/50 rounded-full max-w-full">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => onIndexChange(index)}
                className={cn(
                  "h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                  index === currentIndex
                    ? "border-white ring-2 ring-white/50"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={img.url}
                  alt={img.label}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-20" />
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <Skeleton className="aspect-square max-w-md rounded-2xl" />
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
