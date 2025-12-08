"use client";

import { useRouter } from "next/navigation";
import { useBasket } from "@/contexts/BasketContext";
import { useAuth } from "@/lib/useAuth";
import { createDocumentWithPrompt } from "@/lib/documents/createDocument";
import { createDump } from "@/lib/api/dumps";
import { uploadFile } from "@/lib/storage/upload";
import { sanitizeFilename } from "@/lib/utils/sanitizeFilename";
import { notificationService } from "@/lib/notifications/service";

/**
 * Encapsulates creation actions for the basket sidebar popover.
 * Provides handlers for quick dumps, blank documents and file uploads.
 */
export function useCreateActions() {
  const router = useRouter();
  const { basket } = useBasket();
  const { user } = useAuth();

  const basketId = basket?.id;

  return {
    quickDump: () => {
      if (!basketId) return;
      const el = document.getElementById(
        "thinking-partner-input"
      ) as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      console.debug("quickDump invoked", { basketId });
      notificationService.substrateCreated("Quick dump ready", "Ready to capture your thoughts");
    },

    newBlankDocument: async () => {
      if (!basketId) return;
      try {
        const doc = await createDocumentWithPrompt(basketId);
        router.push(`/baskets/${basketId}/documents/${doc.id}`);
      } catch (e) {
        console.warn("newBlankDocument failed", e);
        notificationService.documentCompositionFailed("Creation failed", "Couldn't create document");
      }
    },

    uploadFiles: () => {
      const input = document.getElementById(
        "leftnav-upload-hidden"
      ) as HTMLInputElement | null;
      if (input) {
        input.value = "";
        input.click();
      }
    },

    handleSelectedFiles: async (files: FileList) => {
      if (!basketId || !user?.id || !files.length) return;
      try {
        for (const file of Array.from(files)) {
          const sanitized = sanitizeFilename(file.name);
          const filename = `${Date.now()}-${sanitized}`;
          const url = await uploadFile(file, `dump_${user.id}/${filename}`);
          await createDump({
            basket_id: basketId,
            dump_request_id: crypto.randomUUID(),
            file_url: url,
          });
        }
        notificationService.substrateCreated(`Files captured`, `Captured ${files.length} file(s) as raw dumps`, undefined, basketId);
      } catch (e) {
        console.warn("uploadFiles failed", e);
        notificationService.substrateRejected("Upload failed", "Failed to upload files", undefined, basketId);
      }
    },
  };
}

