"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileSearch, ScrollText, ChevronDown, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropCard } from "./PropCard";
import { cn } from "@/lib/utils";
import type { RevealedProp } from "@/hooks/useChat";

interface StoryBrief {
  episodeTitle?: string;
  situation?: string;
  backstory?: string;
}

interface StoryBriefDrawerProps {
  props: RevealedProp[];
  isOpen: boolean;
  onClose: () => void;
  hasBackground?: boolean;
  characterName?: string;
  storyBrief?: StoryBrief;
}

/**
 * StoryBriefDrawer - Contextual drawer for story brief and collected items
 *
 * Primary purpose: Give players the context they need to engage with the story
 * - Story Brief: Scene setup, backstory, what you know
 * - Items: Props collected during the episode (evidence, keepsakes, etc.)
 *
 * Design philosophy:
 * - "Brief" as in intelligence briefing - fits mystery, thriller, romance alike
 * - Bottom sheet on mobile, side panel on desktop
 * - Story context first, items second
 * - Dark, immersive aesthetic
 */
export function StoryBriefDrawer({
  props,
  isOpen,
  onClose,
  hasBackground = false,
  characterName,
  storyBrief,
}: StoryBriefDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const hasStoryBrief = storyBrief && (storyBrief.situation || storyBrief.backstory);
  const keyEvidenceCount = props.filter(p => p.is_key_evidence || p.badge_label).length;

  // Build dynamic subtitle
  const subtitleParts: string[] = [];
  if (hasStoryBrief) subtitleParts.push("Context");
  if (props.length > 0) {
    subtitleParts.push(`${props.length} item${props.length !== 1 ? "s" : ""}`);
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" • ") : "Story context";

  const content = (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet - bottom on mobile, right side on desktop */}
      <div
        className={cn(
          "absolute animate-in duration-300",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl",
          // Desktop: side panel
          "sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-[420px] sm:max-h-full sm:rounded-t-none sm:rounded-l-2xl",
          "slide-in-from-bottom sm:slide-in-from-right",
          // Dark immersive aesthetic
          "bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950 border-l border-white/10"
        )}
      >
        {/* Handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">
                Brief
              </h2>
              <p className="text-xs text-white/50">
                {subtitle}
                {keyEvidenceCount > 0 && (
                  <span className="text-amber-400 ml-1">
                    • {keyEvidenceCount} key
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] sm:max-h-[calc(100vh-80px)] px-3 pb-[env(safe-area-inset-bottom)]">
          {/* Story Brief Section */}
          {hasStoryBrief && (
            <div className="py-3 border-b border-white/10">
              <button
                onClick={() => setBriefExpanded(!briefExpanded)}
                className="w-full flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white/90">Story Brief</span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-white/50 transition-transform",
                    briefExpanded && "rotate-180"
                  )}
                />
              </button>

              {briefExpanded && (
                <div className="mt-3 space-y-3">
                  {storyBrief.episodeTitle && (
                    <p className="text-xs text-blue-400 uppercase tracking-wide">
                      {storyBrief.episodeTitle}
                    </p>
                  )}
                  {storyBrief.situation && (
                    <div>
                      <p className="text-xs text-white/40 mb-1">The Scene</p>
                      <p className="text-sm text-white/80 leading-relaxed">
                        {storyBrief.situation}
                      </p>
                    </div>
                  )}
                  {storyBrief.backstory && (
                    <div>
                      <p className="text-xs text-white/40 mb-1">What You Know</p>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                        {storyBrief.backstory}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Items Section */}
          {props.length === 0 ? (
            // Empty state - only show if there's no story brief either
            !hasStoryBrief && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <FileSearch className="w-8 h-8 text-white/30" />
                </div>
                <p className="text-white/50 text-sm">No context yet</p>
                <p className="text-white/30 text-xs mt-1 max-w-[200px]">
                  Story details will appear as you progress
                </p>
              </div>
            )
          ) : (
            <div className="py-3">
              <button
                onClick={() => setItemsExpanded(!itemsExpanded)}
                className="w-full flex items-center justify-between text-left group mb-2"
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white/90">
                    Items Collected
                  </span>
                  <span className="text-xs text-white/40">
                    {props.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-white/50 transition-transform",
                    itemsExpanded && "rotate-180"
                  )}
                />
              </button>

              {itemsExpanded && (
                <div className="space-y-2">
                  {props.map((prop) => (
                    <PropCard
                      key={prop.id}
                      prop={prop}
                      hasBackground={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hint when story brief exists but no items */}
          {hasStoryBrief && props.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-white/30 text-xs">
                Items will appear here as you discover them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
