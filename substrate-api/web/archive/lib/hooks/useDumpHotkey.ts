"use client";
import { useEffect } from "react";
import { useBasket } from "@/lib/context/BasketContext";
import { openDumpModal } from "@/components/DumpModal";
import { notificationService } from '@/lib/notifications/service';

export default function useDumpHotkey() {
  const { currentBasketId } = useBasket();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v";
      const target = e.target as HTMLElement;
      if (!isCombo) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      if (!currentBasketId) {
        notificationService.notify({
          type: 'system.user.action_required',
          title: 'Basket Required',
          message: 'Open a basket first to dump',
          severity: 'info'
        });
      } else {
        openDumpModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentBasketId]);
}
