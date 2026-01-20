"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileSearch, ScrollText, Briefcase } from "lucide-react";
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

type TabType = "context" | "items";

/**
 * StoryBriefDrawer - Tabbed drawer for story context and collected items
 *
 * Two distinct data types, two tabs:
 * - Context: Static story brief (scene setup, backstory) - reference material
 * - Items: Dynamic prop collection that grows during play - progression/rewards
 *
 * Design philosophy:
 * - Clear separation between "what you know" and "what you've found"
 * - Bottom sheet on mobile, side panel on desktop
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
  const [activeTab, setActiveTab] = useState<TabType>("context");

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
          "absolute animate-in duration-300 flex flex-col",
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

        {/* Header with close button */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="font-semibold text-lg text-white">Brief</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("context")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
              activeTab === "context"
                ? "text-blue-400"
                : "text-white/50 hover:text-white/70"
            )}
          >
            <ScrollText className="w-4 h-4" />
            <span>Context</span>
            {activeTab === "context" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
              activeTab === "items"
                ? "text-amber-400"
                : "text-white/50 hover:text-white/70"
            )}
          >
            <Briefcase className="w-4 h-4" />
            <span>Items</span>
            {props.length > 0 && (
              <span className={cn(
                "ml-1 px-1.5 py-0.5 text-[10px] rounded-full",
                activeTab === "items"
                  ? "bg-amber-400/20 text-amber-400"
                  : "bg-white/10 text-white/50"
              )}>
                {props.length}
              </span>
            )}
            {activeTab === "items" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
          {activeTab === "context" ? (
            /* Context Tab */
            <div className="py-4">
              {hasStoryBrief ? (
                <div className="space-y-4">
                  {storyBrief.episodeTitle && (
                    <p className="text-xs text-blue-400 uppercase tracking-wide font-medium">
                      {storyBrief.episodeTitle}
                    </p>
                  )}
                  {storyBrief.situation && (
                    <div>
                      <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">The Scene</p>
                      <p className="text-sm text-white/80 leading-relaxed">
                        {storyBrief.situation}
                      </p>
                    </div>
                  )}
                  {storyBrief.backstory && (
                    <div>
                      <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">What You Know</p>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                        {storyBrief.backstory}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <ScrollText className="w-7 h-7 text-white/30" />
                  </div>
                  <p className="text-white/50 text-sm">No story context</p>
                  <p className="text-white/30 text-xs mt-1 max-w-[200px]">
                    Context will appear when you start an episode
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Items Tab */
            <div className="py-4">
              {props.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <FileSearch className="w-7 h-7 text-white/30" />
                  </div>
                  <p className="text-white/50 text-sm">No items collected</p>
                  <p className="text-white/30 text-xs mt-1 max-w-[200px]">
                    Keep talking with {characterName || "them"} to discover items
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {keyEvidenceCount > 0 && (
                    <p className="text-xs text-amber-400">
                      {keyEvidenceCount} key item{keyEvidenceCount !== 1 ? "s" : ""}
                    </p>
                  )}
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
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
