"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, Loader2, Image, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SceneGenerationMode = "t2i" | "kontext";

interface MessageInputProps {
  onSend: (content: string) => void;
  onVisualize?: (mode: SceneGenerationMode) => void;
  disabled?: boolean;
  isGeneratingScene?: boolean;
  showVisualizeButton?: boolean;
  suggestScene?: boolean;
  placeholder?: string;
  hasBackground?: boolean;
  hasAnchorImage?: boolean; // Whether the character has an anchor image for Kontext mode
}

export function MessageInput({
  onSend,
  onVisualize,
  disabled = false,
  isGeneratingScene = false,
  showVisualizeButton = true,
  suggestScene = false,
  placeholder = "Type a message...",
  hasBackground = false,
  hasAnchorImage = false,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleModeSelect = (mode: SceneGenerationMode) => {
    onVisualize?.(mode);
    setShowMobileSheet(false);
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue("");
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <div className="px-3 py-1.5 sm:px-4 sm:py-2">
        <div className={cn(
          "flex w-full items-end gap-1.5 sm:gap-2 rounded-full px-2 py-1.5 sm:px-3 sm:py-2",
          hasBackground
            ? "bg-white/10"
            : "bg-muted border border-border"
        )}>
          {/* Visualize button - simplified for mobile, full dropdown for desktop */}
          {showVisualizeButton && onVisualize && (
            <>
              {/* Mobile: Simple button that opens bottom sheet */}
              <Button
                disabled={disabled || isGeneratingScene}
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileSheet(true)}
                className={cn(
                  "h-8 w-8 rounded-full transition-all flex-shrink-0 sm:hidden",
                  hasBackground
                    ? "text-white/70 hover:text-white hover:bg-white/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isGeneratingScene && (hasBackground ? "bg-white/20" : "bg-muted"),
                  suggestScene && "animate-pulse text-primary"
                )}
              >
                {isGeneratingScene ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clapperboard className="h-4 w-4" />
                )}
                <span className="sr-only">Create scene</span>
              </Button>

              {/* Desktop: Full dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={disabled || isGeneratingScene}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-full transition-all flex-shrink-0 hidden sm:flex",
                      hasBackground
                        ? "text-white/90 hover:text-white hover:bg-white/20"
                        : "text-primary hover:text-primary bg-primary/10 hover:bg-primary/20",
                      isGeneratingScene && (hasBackground ? "bg-white/20" : "bg-primary/20"),
                      suggestScene && "animate-pulse"
                    )}
                    title={suggestScene ? "Capture this moment" : "Create scene"}
                  >
                    {isGeneratingScene ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clapperboard className="h-4 w-4" />
                    )}
                    <span className="sr-only">Create scene</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-64"
                  side="top"
                  align="start"
                >
                  <DropdownMenuLabel>
                    Choose generation mode
                  </DropdownMenuLabel>
                  <button
                    onClick={() => handleModeSelect("t2i")}
                    className={cn(
                      "w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors",
                      "hover:bg-muted"
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Image className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Quick Scene</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          1 ✦
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Text-to-image generation
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleModeSelect("kontext")}
                    disabled={!hasAnchorImage}
                    className={cn(
                      "w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors",
                      hasAnchorImage
                        ? "hover:bg-muted"
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Wand2 className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Character Scene</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          3 ✦
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hasAnchorImage
                          ? "Uses character reference for consistency"
                          : "Character reference not available"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              enterKeyHint="send"
              inputMode="text"
              className={cn(
                "w-full resize-none border-none bg-transparent px-2 py-1.5 text-[16px] sm:text-sm shadow-none",
                hasBackground
                  ? "text-white placeholder:text-white/50"
                  : "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-0",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "max-h-[120px] overflow-y-auto"
              )}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            size="icon"
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 rounded-full transition-all",
              hasBackground
                ? "bg-white/90 text-gray-900 hover:bg-white shadow-sm"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            <SendIcon className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>

      {/* Mobile bottom sheet for scene generation */}
      {showMobileSheet && (
        <MobileSceneSheet
          onSelect={handleModeSelect}
          onClose={() => setShowMobileSheet(false)}
          hasAnchorImage={hasAnchorImage}
          hasBackground={hasBackground}
        />
      )}
    </>
  );
}

/* Mobile bottom sheet for scene generation options */
interface MobileSceneSheetProps {
  onSelect: (mode: SceneGenerationMode) => void;
  onClose: () => void;
  hasAnchorImage: boolean;
  hasBackground: boolean;
}

function MobileSceneSheet({ onSelect, onClose, hasAnchorImage, hasBackground }: MobileSceneSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when sheet is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const content = (
    <div className="fixed inset-0 z-[9999] sm:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-200",
          hasBackground
            ? "bg-gray-900/95 backdrop-blur-xl"
            : "bg-card"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className={cn(
            "w-10 h-1 rounded-full",
            hasBackground ? "bg-white/30" : "bg-muted-foreground/30"
          )} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className={cn(
            "font-semibold",
            hasBackground ? "text-white" : "text-foreground"
          )}>
            Create Scene
          </h3>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              hasBackground
                ? "text-white/60 hover:text-white hover:bg-white/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="px-4 pb-6 space-y-2">
          <button
            onClick={() => onSelect("t2i")}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors",
              hasBackground
                ? "bg-white/10 hover:bg-white/15 active:bg-white/20"
                : "bg-muted hover:bg-muted/80 active:bg-muted/60"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              "bg-blue-500/20"
            )}>
              <Image className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium",
                  hasBackground ? "text-white" : "text-foreground"
                )}>
                  Quick Scene
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  1 ✦
                </span>
              </div>
              <p className={cn(
                "text-sm mt-0.5",
                hasBackground ? "text-white/60" : "text-muted-foreground"
              )}>
                Generate from conversation context
              </p>
            </div>
          </button>

          <button
            onClick={() => onSelect("kontext")}
            disabled={!hasAnchorImage}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors",
              hasAnchorImage
                ? hasBackground
                  ? "bg-white/10 hover:bg-white/15 active:bg-white/20"
                  : "bg-muted hover:bg-muted/80 active:bg-muted/60"
                : "opacity-40 cursor-not-allowed",
              hasBackground
                ? ""
                : ""
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              "bg-purple-500/20"
            )}>
              <Wand2 className="h-6 w-6 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium",
                  hasBackground ? "text-white" : "text-foreground"
                )}>
                  Character Scene
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                  3 ✦
                </span>
              </div>
              <p className={cn(
                "text-sm mt-0.5",
                hasBackground ? "text-white/60" : "text-muted-foreground"
              )}>
                {hasAnchorImage
                  ? "Consistent character appearance"
                  : "Character reference not available"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
