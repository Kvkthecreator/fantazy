"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCharacterProfile } from "@/hooks/useCharacters";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, MessageCircle, Heart, ThumbsDown, Sparkles, Camera, Info } from "lucide-react";
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

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Character not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const displayImages = profile.gallery.length > 0
    ? profile.gallery.map((g) => ({ url: g.image_url, label: g.expression || g.asset_type }))
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
            <img
              src={coverImage}
              alt={profile.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30 text-6xl font-bold text-white">
              {profile.name[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <div className="h-16 w-16 rounded-full border-2 border-white/70 shadow-lg">
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
            </div>
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
              {profile.short_backstory && (
                <p className="text-base text-foreground">{profile.short_backstory}</p>
              )}
              {profile.full_backstory && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {profile.full_backstory}
                </p>
              )}
              {profile.starter_prompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Conversation starters</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {profile.starter_prompts.slice(0, 4).map((prompt, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                      >
                        “{prompt}”
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted">
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
          </div>
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
