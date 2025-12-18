import Link from "next/link";
import { cn } from "@/lib/utils";

interface SeriesCardProps {
  title: string;
  tagline: string | null;
  episodeCount: number;
  coverUrl: string | null;
  href: string;
  genre?: string | null;
}

export function SeriesCard({
  title,
  tagline,
  episodeCount,
  coverUrl,
  href,
  genre,
}: SeriesCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Cover image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <span className="text-4xl font-bold text-primary/30">{title[0]}</span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Episode count badge */}
        <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          {episodeCount} episode{episodeCount !== 1 ? "s" : ""}
        </div>

        {/* Genre badge */}
        {genre && (
          <div className="absolute top-2 right-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {formatGenre(genre)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        {tagline && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {tagline}
          </p>
        )}
      </div>
    </Link>
  );
}

function formatGenre(genre: string): string {
  // Convert snake_case to Title Case
  return genre
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
