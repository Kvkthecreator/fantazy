import { useEffect, useState } from "react";

export function useFileDrag() {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.items?.[0]?.kind === "file") {
        dragCounter++;
        setIsDraggingFile(true);
      }
    }

    function onDragLeave() {
      dragCounter--;
      if (dragCounter === 0) setIsDraggingFile(false);
    }

    function onDrop() {
      dragCounter = 0;
      setIsDraggingFile(false);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return { isDraggingFile };
}
