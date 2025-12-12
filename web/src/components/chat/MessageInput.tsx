"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (content: string) => void;
  onVisualize?: () => void;
  disabled?: boolean;
  isGeneratingScene?: boolean;
  showVisualizeButton?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onVisualize,
  disabled = false,
  isGeneratingScene = false,
  showVisualizeButton = true,
  placeholder = "Type a message...",
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      {/* Visualize button */}
      {showVisualizeButton && onVisualize && (
        <Button
          onClick={onVisualize}
          disabled={disabled || isGeneratingScene}
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full h-10 w-10 flex-shrink-0",
            "text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10",
            isGeneratingScene && "text-purple-500 bg-purple-500/10"
          )}
          title="Visualize this moment"
        >
          {isGeneratingScene ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="sr-only">Visualize scene</span>
        </Button>
      )}

      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 pr-12",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "max-h-[150px] overflow-y-auto"
          )}
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        size="icon"
        className="rounded-full h-10 w-10 flex-shrink-0"
      >
        <SendIcon className="h-4 w-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </div>
  );
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
