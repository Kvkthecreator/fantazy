"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "icon" | "text";
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  full: "h-full w-full",
};

/**
 * Logo component with automatic light/dark mode support.
 * - `icon` variant: Play button with "ep-0" inside
 * - `text` variant: Text-only "ep-0" logo
 */
export function Logo({ variant = "icon", size = "md", className }: LogoProps) {
  const src = variant === "icon"
    ? "/branding/ep0-icon.png"
    : "/branding/ep0-logo.png";

  return (
    <img
      src={src}
      alt="ep-0"
      className={cn(
        sizeMap[size],
        "object-contain dark:invert",
        className
      )}
    />
  );
}
