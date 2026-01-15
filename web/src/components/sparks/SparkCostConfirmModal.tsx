"use client";

import { Sparkles, Play, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSparks } from "@/hooks/useSparks";
import { useSubscription } from "@/hooks/useSubscription";

interface SparkCostConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cost: number;
  episodeTitle: string;
  isLoading?: boolean;
}

export function SparkCostConfirmModal({
  open,
  onClose,
  onConfirm,
  cost,
  episodeTitle,
  isLoading = false,
}: SparkCostConfirmModalProps) {
  const { sparkBalance, isLoading: sparksLoading } = useSparks();
  const { isPremium } = useSubscription();

  const canAfford = sparkBalance >= cost;
  const balanceAfter = sparkBalance - cost;

  // Premium users bypass spark costs
  if (isPremium) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Start Episode
            </DialogTitle>
            <DialogDescription>
              As a Premium member, you can start &quot;{episodeTitle}&quot; for free!
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isLoading}>
              {isLoading ? "Starting..." : "Start Episode"}
              <Play className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Spend Sparks?
          </DialogTitle>
          <DialogDescription>
            Starting &quot;{episodeTitle}&quot; costs {cost} Spark{cost > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-medium flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {sparksLoading ? "..." : sparkBalance}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Episode cost</span>
            <span className="font-medium text-amber-600">-{cost}</span>
          </div>
          <div className="border-t pt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">After starting</span>
            <span className={`font-medium ${canAfford ? "text-foreground" : "text-destructive"}`}>
              {sparksLoading ? "..." : balanceAfter}
            </span>
          </div>
        </div>

        {!canAfford && (
          <p className="text-sm text-destructive">
            You don&apos;t have enough Sparks. You need {cost - sparkBalance} more.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !canAfford}
            className={canAfford ? "" : "opacity-50"}
          >
            {isLoading ? "Starting..." : `Spend ${cost} Spark${cost > 1 ? "s" : ""}`}
            <Play className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
