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
import { ArrowLeft, MessageCircle, Heart, ThumbsDown, Sparkles } from "lucide-react";
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

  const archetypeColors: Record<string, string> = {
    barista: "from-amber-400 to-orange-500",
    neighbor: "from-blue-400 to-indigo-500",
    coworker: "from-emerald-400 to-teal-500",
    default: "from-pink-400 to-purple-500",
  };

  const gradientClass = archetypeColors[profile.archetype] || archetypeColors.default;

  // Get display images: gallery if available, else fallback to avatar_url
  const displayImages = profile.gallery.length > 0
    ? profile.gallery.map((g) => ({ url: g.image_url, label: g.expression || g.asset_type }))
    : profile.avatar_url
      ? [{ url: profile.avatar_url, label: "Portrait" }]
      : [];

  const currentImage = displayImages[selectedImageIndex]?.url || null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left: Avatar Gallery */}
        <div className="space-y-4">
          {/* Main image */}
          <div
            className={cn(
              "relative aspect-square max-w-md mx-auto lg:mx-0 rounded-2xl overflow-hidden",
              !currentImage && `bg-gradient-to-br ${gradientClass}`
            )}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-8xl font-bold">
                {profile.name[0]}
              </div>
            )}

            {profile.is_premium && (
              <Badge className="absolute top-4 right-4 bg-yellow-500 text-yellow-950">
                <Sparkles className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>

          {/* Thumbnail gallery */}
          {displayImages.length > 1 && (
            <div className="flex gap-2 justify-center lg:justify-start overflow-x-auto pb-2">
              {displayImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={cn(
                    "relative w-16 h-16 rounded-lg overflow-hidden shrink-0 transition-all",
                    selectedImageIndex === index
                      ? "ring-2 ring-primary ring-offset-2"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Character Info */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              {relationship && (
                <Badge variant="secondary">
                  {relationship.stage === "acquaintance" ? "Just Met" :
                   relationship.stage === "friendly" ? "Friendly" :
                   relationship.stage === "close" ? "Close" : "Special"}
                </Badge>
              )}
            </div>
            <p className="text-lg text-muted-foreground capitalize">{profile.archetype}</p>
          </div>

          {/* Short backstory */}
          {profile.short_backstory && (
            <p className="text-muted-foreground">{profile.short_backstory}</p>
          )}

          {/* Full backstory */}
          {profile.full_backstory && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {profile.full_backstory}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Likes & Dislikes */}
          {(profile.likes.length > 0 || profile.dislikes.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.likes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-500" />
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
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-slate-500" />
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

          {/* Starter prompts */}
          {profile.starter_prompts.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Conversation starters</h3>
                <div className="space-y-2">
                  {profile.starter_prompts.slice(0, 3).map((prompt, i) => (
                    <div
                      key={i}
                      className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg"
                    >
                      &ldquo;{prompt}&rdquo;
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={handleStartChat}
              disabled={isStartingChat}
            >
              <MessageCircle className="h-5 w-5" />
              {relationship ? "Continue Chat" : "Start Chatting"}
            </Button>
          </div>

          {/* Relationship stats */}
          {relationship && (
            <div className="text-sm text-muted-foreground text-center">
              {relationship.total_episodes} episodes &bull; {relationship.total_messages} messages
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
