"use client";

import { Button } from "@/components/ui/button";
import { memo } from "react";

interface GuestBannerProps {
  messagesRemaining: number;
  onSignup: () => void;
}

export const GuestBanner = memo(function GuestBanner({ messagesRemaining, onSignup }: GuestBannerProps) {
  return (
    <div className="flex items-center justify-center gap-3 bg-gradient-to-b from-amber-50/50 to-transparent px-4 py-1.5 text-xs border-b border-amber-100/50 dark:from-amber-950/30 dark:border-amber-900/30">
      <span className="text-amber-700 dark:text-amber-400">
        Trial: {messagesRemaining} {messagesRemaining === 1 ? "message" : "messages"} left
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onSignup}
        className="h-6 px-2 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/30"
      >
        Sign up free →
      </Button>
    </div>
  );
});
