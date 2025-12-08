import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import { ensureWorkspaceServer } from "@/lib/workspaces/ensureWorkspaceServer";
import { getBasketServer } from "@/lib/server/baskets";
import { getDocumentsServer } from "@/lib/server/documents";
import type { DocumentDTO } from "@/shared/contracts/documents";

// Clean data fetching utilities for baskets work
export async function getBasketData(basketId: string) {
  try {
    const supabase = createServerComponentClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('No user found, using mock basket data for development');
        return getMockBasketData(basketId);
      }
      return null;
    }

    const workspace = await ensureWorkspaceServer(supabase);
    const workspaceId = workspace?.id;

    if (!workspaceId) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('No workspace found, using mock basket data for development');
        return getMockBasketData(basketId);
      }
      return null;
    }

    const basket = await getBasketServer(basketId, workspaceId);

    if (!basket) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('Basket not found, using mock basket data for development');
        return getMockBasketData(basketId);
      }
      return null;
    }

    return {
      id: basketId,
      name: basket.name ?? "Untitled",
      status: basket.status ?? "ACTIVE",
      createdAt: basket.created_at || new Date().toISOString(),
      workspace: { id: workspaceId }
    };
  } catch (error) {
    console.error('Error fetching basket data:', error);
    // In development, provide mock data as fallback
    if (process.env.NODE_ENV === 'development') {
      console.warn('API error, using mock basket data for development');
      return getMockBasketData(basketId);
    }
    return null;
  }
}

export async function getBasketDocuments(basketId: string) {
  try {
    const supabase = createServerComponentClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('No user found, using mock documents for development');
        return getMockDocuments();
      }
      return [];
    }

    const workspace = await ensureWorkspaceServer(supabase);
    const workspaceId = workspace?.id;

    if (!workspaceId) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('No workspace found, using mock documents for development');
        return getMockDocuments();
      }
      return [];
    }

    const docs: DocumentDTO[] = await getDocumentsServer(workspaceId);

    // Filter documents by basketId to ensure consistency with dashboard metrics
    const basketDocs = docs.filter(doc => doc.basket_id === basketId);

    console.log(`📊 Filtered documents for basket ${basketId}:`, {
      totalWorkspaceDocs: docs.length,
      basketSpecificDocs: basketDocs.length
    });

    return basketDocs;
  } catch (error) {
    console.error('Error fetching documents:', error);
    // In development, provide mock data as fallback
    if (process.env.NODE_ENV === 'development') {
      console.warn('API error, using mock documents for development');
      return getMockDocuments();
    }
    return [];
  }
}

export async function getDocument(basketId: string, documentId: string) {
  try {
    const documents = await getBasketDocuments(basketId);
    return documents.find((doc: any) => doc.id === documentId) || null;
  } catch (error) {
    console.error('Error fetching document:', error);
    return null;
  }
}

export async function getUserAndWorkspace() {
  try {
    const supabase = createServerComponentClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, workspace: null };
    }

    const workspace = await ensureWorkspaceServer(supabase);

    return { user, workspace };
  } catch (error) {
    console.error('Error fetching user and workspace:', error);
    return { user: null, workspace: null };
  }
}

// Helper for development/fallback data
export function getMockBasketData(basketId: string) {
  return {
    id: basketId,
    name: 'Strategic Planning Project',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    workspace: { id: 'mock-workspace-id' }
  };
}

export function getMockDocuments(): DocumentDTO[] {
  return [
    {
      id: 'doc-1',
      title: 'Project Strategy Overview',
      basket_id: 'mock-basket-id',
      doc_type: 'document_canon',
      current_version_hash: null,
      latest_version_created_at: new Date(Date.now() - 86400000).toISOString(),
      metadata: {
        wordCount: 1247,
        document_type: 'strategic-analysis',
        content_raw: '# Project Strategy\n\nThis document outlines our strategic approach...',
        structured_outline: {
          summary: 'Strategic overview of project goals and approach.',
          themes: ['Vision alignment', 'Execution readiness']
        }
      },
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'doc-2',
      title: 'Market Research Findings',
      basket_id: 'mock-basket-id',
      doc_type: 'starter_prompt',
      current_version_hash: null,
      latest_version_created_at: new Date(Date.now() - 172800000).toISOString(),
      metadata: {
        wordCount: 892,
        document_type: 'research-notes',
        content_raw: '# Market Research\n\nKey findings from our market analysis...',
        structured_prompt: {
          opening: 'You are Yarnnn, helping with market analysis.',
          context: 'User is evaluating market positioning for Q4.',
          instructions: 'Summarize recent research and identify opportunities.',
          call_to_action: 'Highlight top three action items.',
        }
      },
      updated_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'doc-3',
      title: 'Implementation Plan',
      basket_id: 'mock-basket-id',
      doc_type: 'artifact_other',
      current_version_hash: null,
      latest_version_created_at: new Date(Date.now() - 259200000).toISOString(),
      metadata: {
        wordCount: 1563,
        document_type: 'project-plan',
        content_raw: '# Implementation\n\nDetailed plan for executing our strategy...',
      },
      updated_at: new Date(Date.now() - 259200000).toISOString(),
    }
  ];
}
