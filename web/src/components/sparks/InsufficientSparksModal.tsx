"use client";

import { Sparkles, ShoppingCart, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSparks } from "@/hooks/useSparks";
import { useSubscription } from "@/hooks/useSubscription";

interface InsufficientSparksModalProps {
  open: boolean;
  onClose: () => void;
  cost: number;
  featureName?: string;
}

export function InsufficientSparksModal({
  open,
  onClose,
  cost,
  featureName = "this feature",
}: InsufficientSparksModalProps) {
  const { sparkBalance } = useSparks();
  const { isPremium, upgrade, isLoading } = useSubscription();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Not Enough Sparks
          </DialogTitle>
          <DialogDescription>
            You need {cost} Spark{cost > 1 ? "s" : ""} for {featureName}, but
            you only have {sparkBalance}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {!isPremium && (
            <Button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={() => {
                upgrade();
                onClose();
              }}
              disabled={isLoading}
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium (100 Sparks/month)
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = "/settings?tab=sparks";
              onClose();
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Buy Spark Packs
          </Button>

          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
