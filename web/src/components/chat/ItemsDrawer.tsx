"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileSearch, Briefcase, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropCard } from "./PropCard";
import { cn } from "@/lib/utils";
import type { RevealedProp } from "@/hooks/useChat";

interface StoryBrief {
  episodeTitle?: string;
  situation?: string;
  backstory?: string;
}

interface ItemsDrawerProps {
  props: RevealedProp[];
  isOpen: boolean;
  onClose: () => void;
  hasBackground?: boolean;
  characterName?: string;
  storyBrief?: StoryBrief;
}

/**
 * ItemsDrawer - Collapsible drawer for story brief and collected props
 *
 * ADR-006: Props as Progression System
 * Instead of showing props inline at bottom of chat, we collect them
 * into an items drawer - like an inventory in a game.
 *
 * Story Brief section added for supplemental context - helps users
 * understand the scene, their role, and key background info without
 * needing to visit the series page first.
 *
 * Design philosophy:
 * - Bottom sheet on mobile, side panel on desktop
 * - Genre-agnostic naming (works for mystery evidence, survival gear, romance keepsakes)
 * - Scrollable gallery of collected props
 * - Game-like "collection" feeling
 */
export function ItemsDrawer({
  props,
  isOpen,
  onClose,
  hasBackground = false,
  characterName,
  storyBrief,
}: ItemsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(true);

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

  const keyEvidenceCount = props.filter(p => p.is_key_evidence || p.badge_label).length;

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
          // Noir/evidence aesthetic
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">
                Items
              </h2>
              <p className="text-xs text-white/50">
                {props.length} collected
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
          {storyBrief && (storyBrief.situation || storyBrief.backstory) && (
            <div className="py-3 border-b border-white/10">
              <button
                onClick={() => setBriefExpanded(!briefExpanded)}
                className="w-full flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
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

          {/* Props/Items Section */}
          {props.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <FileSearch className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/50 text-sm">No items collected yet</p>
              <p className="text-white/30 text-xs mt-1 max-w-[200px]">
                Keep talking with {characterName || "them"} to discover items
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-3">
              <p className="text-xs text-white/40 px-1 mb-2">Items Collected</p>
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
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// Note: Trigger button moved to ChatHeader for better UX (ADR-006)
