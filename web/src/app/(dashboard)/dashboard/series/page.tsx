"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollRow } from "@/components/ui/scroll-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Clock, Play, MoreVertical, RotateCcw, Sparkles, Heart, Search, Skull } from "lucide-react";
import { ResetSeriesModal } from "@/components/series/ResetSeriesModal";
import type { ContinueWatchingItem } from "@/types";

// Genre display config (matching discover/dashboard)
const GENRE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  romance: { label: "Romance", icon: <Heart className="h-5 w-5 text-pink-500" /> },
  dark_romance: { label: "Dark Romance", icon: <Heart className="h-5 w-5 text-rose-700" /> },
  romantic_tension: { label: "Romantic Tension", icon: <Heart className="h-5 w-5 text-red-400" /> },
  enemies_to_lovers: { label: "Enemies to Lovers", icon: <Heart className="h-5 w-5 text-orange-500" /> },
  mystery: { label: "Mystery", icon: <Search className="h-5 w-5 text-indigo-500" /> },
  survival_thriller: { label: "Survival Thriller", icon: <Skull className="h-5 w-5 text-slate-500" /> },
  otome_isekai: { label: "Otome Isekai", icon: <Sparkles className="h-5 w-5 text-violet-500" /> },
  shoujo: { label: "Shoujo", icon: <Heart className="h-5 w-5 text-pink-400" /> },
};

export default function MySeriesPage() {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    seriesId: string;
    seriesTitle: string;
  }>({ open: false, seriesId: "", seriesTitle: "" });

  const loadData = async () => {
    try {
      const data = await api.series.getContinueWatching(50);
      setItems(data.items);
    } catch (err) {
      console.error("Failed to load series:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group by genre
  const itemsByGenre = useMemo(() => {
    const grouped: Record<string, ContinueWatchingItem[]> = {};
    items.forEach((item) => {
      const genre = item.series_genre || "other";
      if (!grouped[genre]) grouped[genre] = [];
      grouped[genre].push(item);
    });
    return grouped;
  }, [items]);

  // Sort genres by item count
  const sortedGenres = useMemo(() => {
    return Object.entries(itemsByGenre)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([genre]) => genre);
  }, [itemsByGenre]);

  const handleResetComplete = () => {
    setItems((prev) => prev.filter((item) => item.series_id !== resetModal.seriesId));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[300px] h-28 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[300px] h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Series</h1>
        <p className="text-muted-foreground">
          {items.length} {items.length === 1 ? "series" : "series"} in progress
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">No series started yet</p>
          <Button asChild>
            <Link href="/discover">Discover Series</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGenres.map((genre) => {
            const genreItems = itemsByGenre[genre];
            const config = GENRE_CONFIG[genre] || { label: genre, icon: <BookOpen className="h-5 w-5" /> };

            return (
              <ScrollRow
                key={genre}
                title={config.label}
                icon={config.icon}
              >
                {genreItems.map((item) => (
                  <div
                    key={`${item.series_id}-${item.character_id}`}
                    className="flex-shrink-0 snap-start w-[300px] sm:w-[340px]"
                  >
                    <SeriesCard
                      item={item}
                      onReset={() =>
                        setResetModal({
                          open: true,
                          seriesId: item.series_id,
                          seriesTitle: item.series_title,
                        })
                      }
                    />
                  </div>
                ))}
              </ScrollRow>
            );
          })}
        </div>
      )}

      <ResetSeriesModal
        open={resetModal.open}
        onClose={() => setResetModal({ open: false, seriesId: "", seriesTitle: "" })}
        seriesId={resetModal.seriesId}
        seriesTitle={resetModal.seriesTitle}
        onResetComplete={handleResetComplete}
      />
    </div>
  );
}

function SeriesCard({
  item,
  onReset,
}: {
  item: ContinueWatchingItem;
  onReset: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all group h-full">
      <CardContent className="p-0">
        <div className="flex h-full">
          {/* Series cover image */}
          <Link
            href={`/series/${item.series_slug}`}
            className="relative h-28 w-24 sm:w-28 shrink-0 overflow-hidden"
          >
            {item.series_cover_image_url ? (
              <img
                src={item.series_cover_image_url}
                alt={item.series_title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-600/40 via-purple-500/30 to-pink-500/20" />
            )}
            {/* Progress bar overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
              <div
                className="h-full bg-primary"
                style={{
                  width: `${Math.min((item.current_episode_number / item.total_episodes) * 100, 100)}%`,
                }}
              />
            </div>
            {/* Character avatar overlay */}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full pl-0.5 pr-1.5 py-0.5">
              <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {item.character_avatar_url ? (
                  <img
                    src={item.character_avatar_url}
                    alt={item.character_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[8px] font-medium text-white/80">
                    {item.character_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {item.character_is_user_created && (
                <Sparkles className="h-2.5 w-2.5 text-yellow-400" />
              )}
            </div>
          </Link>

          {/* Content */}
          <Link
            href={`/series/${item.series_slug}`}
            className="flex-1 p-3 flex flex-col justify-between min-w-0"
          >
            <div>
              <h3 className="font-semibold text-sm truncate mb-0.5">
                {item.series_title}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                as {item.character_name}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground line-clamp-1">
                Ep {item.current_episode_number}: {item.current_episode_title}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Play className="h-3 w-3" />
                  {item.current_episode_number}/{item.total_episodes}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(item.last_played_at)}
                </span>
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-start p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Progress
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
