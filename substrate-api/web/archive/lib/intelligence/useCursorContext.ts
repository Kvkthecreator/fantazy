"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CursorPosition {
  position: number;
  line: number;
  column: number;
}

interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export function useCursorContext(elementRef: React.RefObject<HTMLElement | null>) {
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const updateCursorPosition = useCallback(() => {
    if (!elementRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const element = elementRef.current;
    
    if (!element.contains(range.commonAncestorContainer)) return;

    const position = range.startOffset;
    const textContent = element.textContent || "";
    
    const linesBeforeCursor = textContent.substring(0, position).split('\n');
    const line = linesBeforeCursor.length;
    const column = linesBeforeCursor[linesBeforeCursor.length - 1].length;

    setCursorPosition({ position, line, column });

    if (range.collapsed) {
      setTextSelection(null);
    } else {
      const selectedText = range.toString();
      setTextSelection({
        start: range.startOffset,
        end: range.endOffset,
        text: selectedText
      });
    }
  }, [elementRef]);

  const debouncedUpdateCursor = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      updateCursorPosition();
    }, 500);
  }, [updateCursorPosition]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleSelectionChange = () => {
      debouncedUpdateCursor();
    };

    const handleKeyUp = () => {
      debouncedUpdateCursor();
    };

    const handleMouseUp = () => {
      debouncedUpdateCursor();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    element.addEventListener('keyup', handleKeyUp);
    element.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      element.removeEventListener('keyup', handleKeyUp);
      element.removeEventListener('mouseup', handleMouseUp);
      
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [elementRef, debouncedUpdateCursor]);

  return {
    cursorPosition,
    textSelection,
    hasCursor: cursorPosition !== null,
    hasSelection: textSelection !== null && textSelection.text.length > 0
  };
}