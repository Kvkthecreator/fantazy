"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  guestSessionId: string | null;
  trigger: "message_limit" | "memory_snapshot";
}

export function SignupModal({
  open,
  onClose,
  guestSessionId,
  trigger,
}: SignupModalProps) {
  const handleSignup = () => {
    // Guest session ID stays in localStorage - GuestSessionConverter handles conversion after login
    // Redirect to login with return URL so user comes back to the chat page
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center">
          <DialogTitle>Sign up to continue</DialogTitle>
          <DialogDescription>
            Your conversation will be saved.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col pt-2">
          <Button onClick={handleSignup} className="w-full">
            Sign up free
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
