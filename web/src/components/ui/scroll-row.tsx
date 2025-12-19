"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface ScrollRowProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showArrows?: boolean;
}

/**
 * Netflix-style horizontal scroll row.
 * Shows items in a horizontally scrollable container with optional navigation arrows.
 */
export function ScrollRow({ title, icon, children, className, showArrows = true }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <div className="group/row relative">
        {/* Left arrow */}
        {showArrows && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 z-10",
              "h-12 w-8 rounded-r-lg rounded-l-none",
              "bg-black/60 hover:bg-black/80 text-white",
              "opacity-0 group-hover/row:opacity-100 transition-opacity",
              "hidden md:flex"
            )}
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto scrollbar-hide",
            "scroll-smooth snap-x snap-mandatory",
            "-mx-4 px-4 md:mx-0 md:px-0" // Full bleed on mobile
          )}
        >
          {children}
        </div>

        {/* Right arrow */}
        {showArrows && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 z-10",
              "h-12 w-8 rounded-l-lg rounded-r-none",
              "bg-black/60 hover:bg-black/80 text-white",
              "opacity-0 group-hover/row:opacity-100 transition-opacity",
              "hidden md:flex"
            )}
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>
    </section>
  );
}
