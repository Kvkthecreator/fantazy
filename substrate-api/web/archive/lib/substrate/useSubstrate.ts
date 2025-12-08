// TRUE CONTEXT OS - The ONE Hook to Rule Them All
// Replaces all fragmented intelligence hooks

import { useState, useEffect, useCallback } from 'react';
import { UnifiedSubstrateComposer } from './UnifiedSubstrateComposer';
import type { SubstrateElement, SubstrateType, SubstrateResponse } from './SubstrateTypes';
import type { Fragment } from './FragmentTypes';

export function useSubstrate(basketId: string, workspaceId: string) {
  const [composer] = useState(() => UnifiedSubstrateComposer.getInstance());
  const [substrate, setSubstrate] = useState<{
    rawDumps: SubstrateElement[];
    blocks: SubstrateElement[];
    contextItems: SubstrateElement[];
    timelineEvents: SubstrateElement[];  // v2.0 substrate type
    // Note: narrative and documents are artifacts in v2.0, not substrate
  }>({
    rawDumps: [],
    blocks: [],
    contextItems: [],
    timelineEvents: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load substrate from composer
  const refreshSubstrate = useCallback(() => {
    setSubstrate({
      rawDumps: composer.getSubstrateByType('dump', basketId),  // v2.0 substrate type
      blocks: composer.getSubstrateByType('block', basketId),
      contextItems: composer.getSubstrateByType('context_item', basketId),
      timelineEvents: composer.getSubstrateByType('timeline_event', basketId),  // v2.0 substrate type
      // Note: narrative and documents are artifacts in v2.0, not substrate
    });
  }, [composer, basketId]);

  useEffect(() => {
    refreshSubstrate();
  }, [refreshSubstrate]);

  // UNIFIED OPERATIONS - All substrate operations through here

  const addRawDump = useCallback(async (fragments: Fragment[]): Promise<SubstrateResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await composer.addRawDump(fragments, basketId, workspaceId);
      if (response.success) {
        refreshSubstrate();
      } else {
        setError(response.error || 'Failed to add raw dump');
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add raw dump';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [composer, basketId, workspaceId, refreshSubstrate]);

  // Convenience method for simple text input (backward compatibility)
  const addTextRawDump = useCallback(async (content: string): Promise<SubstrateResponse> => {
    const fragments: Fragment[] = [{
      id: `fragment-${Date.now()}`,
      type: content.length > 1000 ? 'text-dump' : 'text',
      content,
      position: 0,
      metadata: {
        processing: 'complete'
      }
    }];
    
    return addRawDump(fragments);
  }, [addRawDump]);

  const proposeBlocks = useCallback(async (rawDumpId: string): Promise<SubstrateResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await composer.proposeBlocks(rawDumpId);
      if (response.success) {
        refreshSubstrate();
      } else {
        setError(response.error || 'Failed to propose blocks');
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to propose blocks';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [composer, refreshSubstrate]);

  const createContextItem = useCallback(async (
    title: string,
    semanticType: 'entity' | 'topic' | 'intent' | 'source_ref' | 'cue' | 'task',
    references: { id: string; type: SubstrateType; basketId: string }[],
    description?: string
  ): Promise<SubstrateResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await composer.createContextItem(
        title, 
        semanticType, 
        references, 
        basketId, 
        workspaceId, 
        description
      );
      if (response.success) {
        refreshSubstrate();
      } else {
        setError(response.error || 'Failed to create context item');
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create context item';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [composer, basketId, workspaceId, refreshSubstrate]);

  const composeDocument = useCallback(async (
    title: string,
    composition: { type: SubstrateType; id: string; order: number; excerpt?: string }[]
  ): Promise<SubstrateResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await composer.composeDocument(title, composition, basketId, workspaceId);
      if (response.success) {
        refreshSubstrate();
      } else {
        setError(response.error || 'Failed to compose document');
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to compose document';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [composer, basketId, workspaceId, refreshSubstrate]);

  const processWithAgent = useCallback(async (
    agentType: string,
    operation: string,
    data: any
  ): Promise<SubstrateResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await composer.processWithAgent(agentType, operation, {
        ...data,
        basketId,
        workspaceId
      });
      if (response.success) {
        refreshSubstrate();
      } else {
        setError(response.error || `Failed to process with agent ${agentType}`);
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to process with agent ${agentType}`;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [composer, basketId, workspaceId, refreshSubstrate]);

  const findConnections = useCallback((elementId: string) => {
    return composer.findConnections(elementId);
  }, [composer]);

  const getRelationships = useCallback((substrateId: string) => {
    return composer.getRelationships(substrateId);
  }, [composer]);

  // Computed values
  const proposedBlocksCount = substrate.blocks.filter(block => 
    'status' in block && block.status === 'proposed'
  ).length;

  const acceptedBlocksCount = substrate.blocks.filter(block => 
    'status' in block && block.status === 'accepted'
  ).length;

  const totalSubstrateCount = Object.values(substrate).reduce((sum, arr) => sum + arr.length, 0);

  return {
    // State
    substrate,
    loading,
    error,
    
    // Operations
    addRawDump, // Now takes Fragment[] for unified context
    addTextRawDump, // Convenience method for simple text
    proposeBlocks,
    createContextItem,
    composeDocument,
    processWithAgent,
    
    // Queries
    findConnections,
    getRelationships,
    refreshSubstrate,
    
    // Computed
    proposedBlocksCount,
    acceptedBlocksCount,
    totalSubstrateCount,
  };
}