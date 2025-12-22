"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Clock, ChevronRight, MoreVertical, RotateCcw } from "lucide-react";
import { ResetSeriesModal } from "@/components/series/ResetSeriesModal";
import type { ContinueWatchingItem } from "@/types";

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

  const handleResetComplete = () => {
    // Remove the reset series from the list
    setItems((prev) => prev.filter((item) => item.series_id !== resetModal.seriesId));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Series</h1>
        <p className="text-muted-foreground">
          Continue your episode progress.
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
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.series_id}
              className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="flex">
                  {/* Series cover image - clickable */}
                  <Link
                    href={`/series/${item.series_slug}`}
                    className="relative h-24 w-32 sm:w-40 shrink-0 overflow-hidden"
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
                  </Link>

                  {/* Content - clickable */}
                  <Link
                    href={`/series/${item.series_slug}`}
                    className="flex-1 p-4 flex items-center gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="truncate text-base font-semibold">
                          {item.series_title}
                        </h3>
                        {item.series_genre && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-primary/10 text-primary"
                          >
                            {GENRE_LABELS[item.series_genre] || item.series_genre}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-1">
                        Up next: Episode {item.current_episode_number} - {item.current_episode_title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {item.current_episode_number} of {item.total_episodes} episodes
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(item.last_played_at)}
                        </span>
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>

                  {/* Actions menu */}
                  <div className="flex items-center pr-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
                            setResetModal({
                              open: true,
                              seriesId: item.series_id,
                              seriesTitle: item.series_title,
                            });
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
          ))}
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
