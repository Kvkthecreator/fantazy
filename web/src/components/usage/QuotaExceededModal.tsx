"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UpgradeButton } from "@/components/subscription/UpgradeButton";
import { UsageMeter } from "./UsageMeter";
import { useUsage } from "@/hooks/useUsage";
import { ImageOff } from "lucide-react";

interface QuotaExceededModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuotaExceededModal({ open, onClose }: QuotaExceededModalProps) {
  const { isPremium, fluxResetsAt } = useUsage();

  const resetDateStr = fluxResetsAt
    ? fluxResetsAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "next month";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <ImageOff className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>
              {isPremium ? "Monthly Limit Reached" : "Upgrade to Continue"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isPremium ? (
              <>
                You&apos;ve used all your image generations for this month. Your
                quota will reset on {resetDateStr}.
              </>
            ) : (
              <>
                You&apos;ve used all your free image generations this month.
                Upgrade to Premium for 50 generations per month.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <UsageMeter showLabel={false} />
        </div>

        {!isPremium && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">
                Premium includes:
              </p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>50 image generations per month</li>
                <li>Priority support</li>
                <li>Early access to new features</li>
              </ul>
            </div>
            <UpgradeButton className="w-full" />
          </div>
        )}

        {isPremium && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            Thank you for being a Premium member!
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
