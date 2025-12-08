"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetchWithToken } from "@/lib/fetchWithToken";
import { useUniversalChanges } from "@/lib/hooks/useUniversalChanges";
import type { DocumentDTO } from "@/shared/contracts/documents";

interface Document {
  id: string;
  title: string;
  content_raw: string;
  updatedAt: string;
  wordCount: number;
  basketId: string;
}

export function useBasketDocuments(basketId: string) {
  // Keep legacy SWR fetching for GET operations (not migrated yet)
  const { data, error, isLoading, mutate } = useSWR(
    basketId && basketId.trim() ? `/api/documents?basketId=${basketId}` : null,
    async (url: string) => {
      const response = await fetchWithToken(url);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const result = await response.json();
      // API returns { documents: [...] }
      return result.documents || [];
    }
  );

  // Use Universal Changes for CRUD operations
  const changeManager = useUniversalChanges(basketId);

  const createDocument = async (title: string, content_raw: string = '') => {
    try {
      console.log('🔄 Creating document via Universal Change System:', { title, basketId });
      
      const result = await changeManager.createDocument(title, content_raw);
      
      if (result.success) {
        mutate(); // Refresh the list
        console.log('✅ Document created successfully via Universal Changes');
        return result.appliedData;
      } else {
        throw new Error(result.errors?.[0] || 'Failed to create document');
      }
    } catch (error) {
      console.error('❌ Error creating document via Universal Changes:', error);
      throw error;
    }
  };

  const updateDocument = async (documentId: string, updates: Partial<DocumentDTO>) => {
    try {
      console.log('🔄 Updating document via Universal Change System:', { documentId, updates });
      
      const result = await changeManager.updateDocument(documentId, updates);
      
      if (result.success) {
        mutate(); // Refresh the list
        console.log('✅ Document updated successfully via Universal Changes');
        return result.appliedData;
      } else {
        throw new Error(result.errors?.[0] || 'Failed to update document');
      }
    } catch (error) {
      console.error('❌ Error updating document via Universal Changes:', error);
      throw error;
    }
  };

  return {
    documents: data || [],
    isLoading,
    error,
    createDocument,
    updateDocument,
    refresh: mutate
  };
}