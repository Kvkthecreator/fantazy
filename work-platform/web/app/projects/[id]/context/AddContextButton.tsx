"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Plus,
  ChevronDown,
  FileText,
  FileBox,
  Image,
  Clipboard,
} from "lucide-react";
import { AddContextModal } from "@/components/context/AddContextModal";
import AddEntryModal from "./AddEntryModal";
import UploadAssetModal from "./UploadAssetModal";

type ModalType = "entry" | "document" | "image" | "paste" | null;

interface AddContextButtonProps {
  projectId: string;
  basketId: string;
  onSuccess?: () => void;
}

export default function AddContextButton({
  projectId,
  basketId,
  onSuccess,
}: AddContextButtonProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const handleSuccess = () => {
    setActiveModal(null);
    onSuccess?.();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Context
            <ChevronDown className="h-4 w-4 ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setActiveModal("entry")}>
            <FileText className="h-4 w-4 mr-2" />
            Add Text Entry
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModal("document")}>
            <FileBox className="h-4 w-4 mr-2" />
            Upload Document
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModal("image")}>
            <Image className="h-4 w-4 mr-2" />
            Upload Image
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveModal("paste")}>
            <Clipboard className="h-4 w-4 mr-2" />
            Paste Context (text + files)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Entry Modal */}
      <AddEntryModal
        open={activeModal === "entry"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onSuccess={handleSuccess}
      />

      {/* Upload Document Modal */}
      <UploadAssetModal
        open={activeModal === "document"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onUploadSuccess={handleSuccess}
      />

      {/* Upload Image Modal */}
      <UploadAssetModal
        open={activeModal === "image"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onUploadSuccess={handleSuccess}
      />

      {/* Legacy Paste Context Modal (text + files combined) */}
      <AddContextModal
        isOpen={activeModal === "paste"}
        onClose={() => setActiveModal(null)}
        projectId={projectId}
        basketId={basketId}
        onSuccess={handleSuccess}
        onStartPolling={() => {
          // Context blocks client handles its own polling
        }}
      />
    </>
  );
}
