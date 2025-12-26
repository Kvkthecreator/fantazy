"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Play,
  ArrowLeft,
  BookOpen,
  Clock,
  MessageSquare,
  Calendar,
  TrendingUp,
} from "lucide-react";
import type {
  SeriesWithEpisodes,
  World,
  EpisodeProgressItem,
  SeriesUserContextResponse,
} from "@/types";

// Genre display labels
const GENRE_LABELS: Record<string, string> = {
  slice_of_life: "Slice of Life",
  romance: "Romance",
  drama: "Drama",
  comedy: "Comedy",
  fantasy: "Fantasy",
  mystery: "Mystery",
  thriller: "Thriller",
  sci_fi: "Sci-Fi",
  horror: "Horror",
  action: "Action",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function SeriesPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [series, setSeries] = useState<SeriesWithEpisodes | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [userContext, setUserContext] = useState<SeriesUserContextResponse | null>(null);
  const [progress, setProgress] = useState<Map<string, EpisodeProgressItem>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [startingEpisode, setStartingEpisode] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch series by slug - list and filter for now
        const allSeries = await api.series.list({ status: "active" });
        const found = allSeries.find((s) => s.slug === slug);

        if (found) {
          // Fetch series with episodes and user context in parallel
          const [seriesData, contextData] = await Promise.all([
            api.series.getWithEpisodes(found.id),
            api.series.getUserContext(found.id).catch(() => null),
          ]);

          setSeries(seriesData);
          setUserContext(contextData);

          // Fetch progress
          try {
            const progressData = await api.series.getProgress(found.id);
            const progressMap = new Map<string, EpisodeProgressItem>();
            progressData.progress.forEach((p) => {
              progressMap.set(p.episode_id, p);
            });
            setProgress(progressMap);
          } catch {
            // Progress not available
          }

          // Fetch world if set
          if (seriesData.world_id) {
            try {
              const worldData = await api.worlds.get(seriesData.world_id);
              setWorld(worldData);
            } catch {
              // World may not exist
            }
          }
        }
      } catch (err) {
        console.error("Failed to load series:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const handleStartEpisode = async (
    episodeId: string,
    characterId: string | null
  ) => {
    if (startingEpisode || !characterId) return;
    setStartingEpisode(episodeId);

    try {
      await api.relationships.create(characterId).catch(() => {});
      router.push(`/chat/${characterId}?episode=${episodeId}`);
    } catch (err) {
      console.error("Failed to start episode:", err);
      setStartingEpisode(null);
    }
  };

  const handleContinue = () => {
    if (!userContext?.current_episode || !userContext.character_id) return;
    handleStartEpisode(userContext.current_episode.episode_id, userContext.character_id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Series not found</p>
        <Button asChild variant="outline">
          <Link href="/discover">Back to Discover</Link>
        </Button>
      </div>
    );
  }

  const genreLabel = series.genre
    ? GENRE_LABELS[series.genre] || series.genre
    : null;

  // Sort episodes by number
  const sortedEpisodes = [...series.episodes].sort(
    (a, b) => a.episode_number - b.episode_number
  );

  // Find the most recently played episode (for "Continue" highlight)
  const currentEpisodeId = userContext?.current_episode?.episode_id;

  const totalEpisodes = series.episodes.length;
  // User has started if they have a current episode from userContext
  const hasStarted = !!userContext?.current_episode;

  return (
    <div className="space-y-8 pb-8">
      {/* Back navigation */}
      <Link
        href="/discover"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Discover
      </Link>

      {/* Hero section */}
      <div className="relative overflow-hidden rounded-xl">
        {series.cover_image_url ? (
          <img
            src={series.cover_image_url}
            alt={series.title}
            className="w-full h-64 sm:h-80 object-cover"
          />
        ) : (
          <div className="w-full h-64 sm:h-80 bg-gradient-to-br from-blue-600/40 via-purple-500/30 to-pink-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {genreLabel && (
              <Badge
                variant="secondary"
                className="bg-primary/80 text-primary-foreground"
              >
                {genreLabel}
              </Badge>
            )}
            {world && (
              <Badge variant="secondary" className="bg-background/80">
                {world.name}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl font-bold mb-2">{series.title}</h1>

          {series.tagline && (
            <p className="text-lg text-muted-foreground italic mb-4">
              {series.tagline}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {series.episodes.length} episode
              {series.episodes.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Your Progress Section - Only if user has started */}
      {hasStarted && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Your Progress</h2>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                {/* Continue CTA */}
                {userContext.current_episode && userContext.character_id && (
                  <div className="flex-1 p-5 bg-primary/5 border-b sm:border-b-0 sm:border-r">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-primary text-primary-foreground">
                        Continue
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1">
                      Episode {userContext.current_episode.episode_number}: {userContext.current_episode.title}
                    </h3>
                    {userContext.current_episode.situation && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {userContext.current_episode.situation}
                      </p>
                    )}
                    <Button
                      onClick={handleContinue}
                      disabled={!!startingEpisode}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Continue Episode
                    </Button>
                  </div>
                )}

                {/* Stats */}
                <div className="flex-1 p-5">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Your Stats</h4>

                  {/* Progress bar - shows current episode position */}
                  {userContext.current_episode && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Episode {userContext.current_episode.episode_number} of {totalEpisodes}</span>
                        <span className="text-muted-foreground">
                          {Math.round((userContext.current_episode.episode_number / totalEpisodes) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.round((userContext.current_episode.episode_number / totalEpisodes) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{userContext.engagement.total_messages}</div>
                        <div className="text-xs text-muted-foreground">Messages</div>
                      </div>
                    </div>
                    {userContext.engagement.last_played_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {formatRelativeTime(userContext.engagement.last_played_at)}
                          </div>
                          <div className="text-xs text-muted-foreground">Last played</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Description */}
      {series.description && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p>{series.description}</p>
        </div>
      )}

      {/* Episodes Section - Primary content */}
      {sortedEpisodes.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Episodes</h2>
          </div>

          <div className="space-y-3">
            {sortedEpisodes.map((episode) => {
              const episodeProgress = progress.get(episode.id);
              const hasStarted = !!episodeProgress; // Any interaction = started
              const isCurrent = currentEpisodeId === episode.id; // Most recent episode

              return (
                <Card
                  key={episode.id}
                  className={cn(
                    "overflow-hidden cursor-pointer transition-all duration-200",
                    "hover:shadow-lg hover:-translate-y-0.5",
                    "group",
                    isCurrent && "ring-2 ring-primary",
                    startingEpisode === episode.id &&
                      "pointer-events-none opacity-80"
                  )}
                  onClick={() =>
                    handleStartEpisode(episode.id, episode.character_id)
                  }
                >
                  <div className="flex">
                    {/* Episode image */}
                    <div className="relative w-32 sm:w-48 h-24 sm:h-32 shrink-0 overflow-hidden bg-muted">
                      {episode.background_image_url ? (
                        <img
                          src={episode.background_image_url}
                          alt={episode.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10" />
                      )}

                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="h-10 w-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                          <Play
                            className="h-4 w-4 text-primary ml-0.5"
                            fill="currentColor"
                          />
                        </div>
                      </div>

                      {/* Started indicator (clock icon) */}
                      {hasStarted && (
                        <div className="absolute top-2 right-2">
                          <div className="h-6 w-6 rounded-full bg-primary/80 flex items-center justify-center">
                            <Clock className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="flex-1 p-4 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            isCurrent && "bg-primary text-primary-foreground"
                          )}
                        >
                          Episode {episode.episode_number}
                        </Badge>
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-primary text-primary"
                          >
                            Continue
                          </Badge>
                        )}
                        {hasStarted && !isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-muted-foreground/50 text-muted-foreground"
                          >
                            Started
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold line-clamp-1 mb-1">
                        {episode.title}
                      </h3>

                      {episode.situation && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {episode.situation}
                        </p>
                      )}

                      <Button
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        className="mt-3 gap-2 w-fit"
                        disabled={!!startingEpisode}
                      >
                        <Play className="h-4 w-4" />
                        {startingEpisode === episode.id
                          ? "Starting..."
                          : hasStarted
                            ? "Continue"
                            : "Start"}
                      </Button>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
