"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, FileBox, Image } from "lucide-react";
import ContextBlocksClient from "./ContextBlocksClient";
import ContextEntriesClient from "./ContextEntriesClient";
import ContextDocumentsClient from "./ContextDocumentsClient";
import ContextImagesClient from "./ContextImagesClient";
import AddEntryModal from "./AddEntryModal";
import UploadAssetModal from "./UploadAssetModal";

type TabValue = "blocks" | "entries" | "documents" | "images";
type ModalType = "entry" | "document" | "image" | null;

interface ContextPageClientProps {
  projectId: string;
  basketId: string;
}

export default function ContextPageClient({ projectId, basketId }: ContextPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("blocks");
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Refresh callbacks for each tab
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-[600px] grid-cols-4">
          <TabsTrigger value="blocks" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Blocks
          </TabsTrigger>
          <TabsTrigger value="entries" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Entries
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileBox className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocks" className="mt-6">
          <ContextBlocksClient projectId={projectId} basketId={basketId} />
        </TabsContent>

        <TabsContent value="entries" className="mt-6">
          <ContextEntriesClient
            key={`entries-${refreshKey}`}
            projectId={projectId}
            basketId={basketId}
            onAddEntry={() => setActiveModal("entry")}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <ContextDocumentsClient
            key={`documents-${refreshKey}`}
            projectId={projectId}
            basketId={basketId}
            onUpload={() => setActiveModal("document")}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ContextImagesClient
            key={`images-${refreshKey}`}
            projectId={projectId}
            basketId={basketId}
            onUpload={() => setActiveModal("image")}
          />
        </TabsContent>
      </Tabs>

      {/* Add Entry Modal */}
      <AddEntryModal
        open={activeModal === "entry"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onSuccess={() => {
          setActiveModal(null);
          triggerRefresh();
        }}
      />

      {/* Upload Asset Modal (for documents) */}
      <UploadAssetModal
        open={activeModal === "document"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onUploadSuccess={() => {
          setActiveModal(null);
          triggerRefresh();
        }}
      />

      {/* Upload Asset Modal (for images) */}
      <UploadAssetModal
        open={activeModal === "image"}
        onClose={() => setActiveModal(null)}
        basketId={basketId}
        onUploadSuccess={() => {
          setActiveModal(null);
          triggerRefresh();
        }}
      />
    </>
  );
}

// Export separate component for Add Context button to be used in header
export { default as AddContextButton } from "./AddContextButton";
