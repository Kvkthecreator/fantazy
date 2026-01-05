"use client";

import { useState } from "react";
import { FileText, Camera, Package, Mic, Smartphone, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionProp, PropType } from "@/types";

interface PropCardProps {
  prop: SessionProp;
  onReveal?: () => void;
}

/**
 * PropCard - Renders canonical story objects in chat
 *
 * ADR-005: Props are canonical story objects with exact, immutable content.
 * They solve the "details don't stick" problem where LLMs improvise
 * inconsistent details for key story elements.
 *
 * Design philosophy:
 * - Evidence/document feel for mystery genre
 * - Muted, noir-inspired colors
 * - Clear visual hierarchy: name → description → content
 * - Key evidence highlighted with subtle warning styling
 */
export function PropCard({ prop, onReveal }: PropCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const Icon = getPropIcon(prop.prop_type);
  const hasImage = !!prop.image_url;
  const hasContent = !!prop.content;

  // Toggle expanded state for content
  const handleClick = () => {
    if (hasContent) {
      setExpanded(!expanded);
    }
    onReveal?.();
  };

  return (
    <div className="my-6 w-full">
      <div
        onClick={handleClick}
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-2xl cursor-pointer",
          "ring-1 transition-all duration-300",
          prop.is_key_evidence
            ? "ring-amber-500/40 hover:ring-amber-500/60"
            : "ring-white/20 hover:ring-white/40",
          // Noir/evidence aesthetic
          "bg-gradient-to-br from-slate-900/95 via-gray-900/95 to-slate-950/95"
        )}
      >
        {/* Key evidence indicator */}
        {prop.is_key_evidence && (
          <div className="absolute top-3 right-3 z-10">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400">
                Key Evidence
              </span>
            </div>
          </div>
        )}

        {/* Image section (if available) */}
        {hasImage && (
          <div className="relative aspect-[16/9]">
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            )}

            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Icon className="h-12 w-12 text-white/30" />
              </div>
            ) : (
              <img
                src={prop.image_url!}
                alt={prop.name}
                className={cn(
                  "h-full w-full object-cover transition-all duration-500",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
        )}

        {/* Content section */}
        <div className={cn(
          "relative px-5 py-5",
          hasImage && "pt-0 -mt-12"
        )}>
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              prop.is_key_evidence
                ? "bg-amber-500/20 border border-amber-500/30"
                : "bg-white/10 border border-white/20"
            )}>
              <Icon className={cn(
                "w-5 h-5",
                prop.is_key_evidence ? "text-amber-400" : "text-white/70"
              )} />
            </div>

            {/* Name and type */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white leading-tight">
                {prop.name}
              </h3>
              <p className="text-xs text-white/50 uppercase tracking-wider mt-0.5">
                {formatPropType(prop.prop_type)}
                {prop.content_format && ` • ${prop.content_format}`}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            {prop.description}
          </p>

          {/* Canonical content (expandable) */}
          {hasContent && (
            <div className={cn(
              "mt-4 overflow-hidden transition-all duration-300",
              expanded ? "max-h-96" : "max-h-0"
            )}>
              <div className={cn(
                "p-4 rounded-xl border",
                prop.is_key_evidence
                  ? "bg-amber-950/30 border-amber-500/20"
                  : "bg-black/30 border-white/10"
              )}>
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">
                  Content
                </p>
                <p className={cn(
                  "text-sm text-white/90 leading-relaxed whitespace-pre-wrap",
                  prop.content_format === "handwritten" && "font-serif italic"
                )}>
                  {prop.content}
                </p>
              </div>
            </div>
          )}

          {/* Expand hint */}
          {hasContent && (
            <div className="mt-3 flex justify-center">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                {expanded ? "Tap to collapse" : "Tap to read"}
              </span>
            </div>
          )}

          {/* Evidence tags */}
          {prop.evidence_tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {prop.evidence_tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/40 border border-white/10"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get icon component for prop type
 */
function getPropIcon(type: PropType) {
  switch (type) {
    case "document":
      return FileText;
    case "photo":
      return Camera;
    case "object":
      return Package;
    case "recording":
      return Mic;
    case "digital":
      return Smartphone;
    default:
      return FileText;
  }
}

/**
 * Format prop type for display
 */
function formatPropType(type: PropType): string {
  switch (type) {
    case "document":
      return "Document";
    case "photo":
      return "Photograph";
    case "object":
      return "Physical Object";
    case "recording":
      return "Recording";
    case "digital":
      return "Digital";
    default:
      return type;
  }
}

/**
 * PropCardSkeleton - Loading placeholder
 */
export function PropCardSkeleton() {
  return (
    <div className="my-6 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-2xl",
        "ring-1 ring-white/20",
        "bg-gradient-to-br from-slate-900/95 via-gray-900/95 to-slate-950/95"
      )}>
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
            <div className="flex-1">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-20 bg-white/5 rounded mt-2 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
