// @ts-nocheck
// SYSTEMATIC REBUILD - Single service for ALL substrate operations
// Direct Supabase, no abstractions, simple async/await patterns

import { createBrowserClient } from '@/lib/supabase/clients';
import { authHelper } from '@/lib/supabase/auth-helper';
import { createDump } from '@/lib/api/dumps';
import { apiClient } from '@/lib/api/client';
import type { ContextItem } from '@/shared/contracts/context';

export interface RawDump {
  id: string;
  basket_id: string;
  workspace_id: string;
  body_md: string;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  basket_id: string;
  raw_dump_id: string;
  title: string;
  body_md: string;
  status: 'proposed' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  basket_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SubstrateData {
  rawDumps: RawDump[];
  blocks: Block[];
  contextItems: ContextItem[];
  documents: Document[];
}

export class SubstrateService {
  private supabase = createBrowserClient();

  // ==========================================
  // RAW DUMPS - Primary input mechanism
  // ==========================================

  async getRawDumps(basketId: string): Promise<RawDump[]> {
    const { data, error } = await this.supabase
      .from('raw_dumps')
      .select('*')
      .eq('basket_id', basketId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch raw dumps: ${error.message}`);
    return data || [];
  }

  async addRawDump(basketId: string, content: string, workspaceId?: string): Promise<RawDump> {
    try {
      // If workspace not provided, fetch from basket
      let actualWorkspaceId = workspaceId;
      
      if (!actualWorkspaceId) {
        const { data: basket, error: basketError } = await this.supabase
          .from('baskets')
          .select('workspace_id')
          .eq('id', basketId)
          .single();
          
        if (basketError || !basket) {
          throw new Error(`Failed to fetch basket workspace: ${basketError?.message || 'Basket not found'}`);
        }
        
        actualWorkspaceId = basket.workspace_id;
      }
      
      // Use API route instead of direct Supabase insert
      // This ensures events are fired and proper processing happens
      const { dump_id } = await createDump({
        basket_id: basketId,
        dump_request_id: crypto.randomUUID(),
        text_dump: content,
      });

      // Fetch the created dump to return full data
      const { data, error } = await this.supabase
        .from('raw_dumps')
        .select('*')
        .eq('id', dump_id)
        .single();
      
      if (error) throw new Error(`Failed to fetch created dump: ${error.message}`);
      return data;
    } catch (error) {
      throw new Error(`Failed to add raw dump: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRawDump(id: string, content: string): Promise<RawDump> {
    const { data, error } = await this.supabase
      .from('raw_dumps')
      .update({ body_md: content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update raw dump: ${error.message}`);
    return data;
  }

  async deleteRawDump(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('raw_dumps')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete raw dump: ${error.message}`);
  }

  // ==========================================
  // BLOCKS - AI-generated from raw dumps
  // ==========================================

  async getBlocks(basketId: string): Promise<Block[]> {
    try {
      const { data, error } = await this.supabase
        .from('blocks')
        .select('*')
        .eq('basket_id', basketId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Blocks table not accessible:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Blocks not available:', err);
      return [];
    }
  }



  // ==========================================
  // CONTEXT ITEMS - Connections & themes
  // ==========================================

  async getContextItems(basketId: string): Promise<ContextItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('context_items')
        .select('*')
        .eq('basket_id', basketId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Context items table not accessible:', error.message);
        return []; // Return empty array instead of throwing
      }
      return data || [];
    } catch (err) {
      console.warn('Context items not available:', err);
      return [];
    }
  }

  async addContextItem(
    basketId: string, 
    title: string, 
    description: string, 
    type: ContextItem['type']
  ): Promise<ContextItem> {
    try {
      const { data, error } = await this.supabase
        .from('context_items')
        .insert({
          basket_id: basketId,
          title,
          description,
          type
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to add context item: ${error.message}`);
      return data;
    } catch (err) {
      console.warn('Cannot add context item - table not accessible:', err);
      throw new Error('Context items feature not available');
    }
  }

  // ==========================================
  // DOCUMENTS - Final compositions
  // ==========================================

  async getDocuments(basketId: string): Promise<Document[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('basket_id', basketId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Documents table not accessible:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Documents not available:', err);
      return [];
    }
  }

  async createDocument(basketId: string, title: string, content: string): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .insert({
        basket_id: basketId,
        title,
        content
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create document: ${error.message}`);
    return data;
  }

  async updateDocument(id: string, title: string, content: string): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .update({ 
        title, 
        content, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update document: ${error.message}`);
    return data;
  }

  // ==========================================
  // UNIFIED OPERATIONS - Load everything
  // ==========================================

  async getAllSubstrate(basketId: string): Promise<SubstrateData> {
    const [rawDumps, blocks, contextItems, documents] = await Promise.all([
      this.getRawDumps(basketId),
      this.getBlocks(basketId),
      this.getContextItems(basketId),
      this.getDocuments(basketId)
    ]);

    return {
      rawDumps,
      blocks,
      contextItems,
      documents
    };
  }

  // ==========================================
  // REAL-TIME SUBSCRIPTIONS (POLLING IMPLEMENTATION)
  // ==========================================

  /**
   * CURRENT IMPLEMENTATION: Polling-based subscription
   * 
   * Due to Supabase WebSocket authentication issues, this method now uses
   * polling instead of WebSocket subscriptions. Returns a polling interval
   * that can be cleared for cleanup.
   * 
   * WebSocket implementation preserved in comments below.
   */
  subscribeToBasket(basketId: string, callback: (data: any) => void) {
    console.log(`📊 Starting polling subscription for basket: ${basketId}`);

    // Track last seen timestamps for each table
    let lastBlockTimestamp = new Date().toISOString();
    let lastDumpTimestamp = new Date().toISOString();

    const pollForChanges = async () => {
      try {
        // Poll for blocks changes
        const { data: blocks, error: blocksError } = await this.supabase
          .from('blocks')
          .select('*')
          .eq('basket_id', basketId)
          .gt('created_at', lastBlockTimestamp)
          .order('created_at', { ascending: false });

        if (blocksError) {
          console.error('Polling error for blocks:', blocksError);
        } else if (blocks && blocks.length > 0) {
          blocks.forEach(block => {
            console.log('📊 Block changed via polling:', block.id);
            callback({
              eventType: 'UPDATE',
              new: block,
              old: null,
              schema: 'public',
              table: 'blocks'
            });
          });
          lastBlockTimestamp = blocks[0].created_at;
        }

        // Poll for raw_dumps changes
        const { data: rawDumps, error: rawDumpsError } = await this.supabase
          .from('raw_dumps')
          .select('*')
          .eq('basket_id', basketId)
          .gt('created_at', lastDumpTimestamp)
          .order('created_at', { ascending: false });

        if (rawDumpsError) {
          console.error('Polling error for raw_dumps:', rawDumpsError);
        } else if (rawDumps && rawDumps.length > 0) {
          rawDumps.forEach(dump => {
            console.log('📊 Raw dump changed via polling:', dump.id);
            callback({
              eventType: 'UPDATE',
              new: dump,
              old: null,
              schema: 'public',
              table: 'raw_dumps'
            });
          });
          lastDumpTimestamp = rawDumps[0].created_at;
        }

      } catch (error) {
        console.error('📊 Polling failed:', error);
      }
    };

    // Initial poll
    pollForChanges();

    // Set up polling interval (3 seconds)
    const interval = setInterval(pollForChanges, 3000);

    console.log(`📊 Polling interval started for basket: ${basketId}`);

    // Return interval for cleanup (same interface as WebSocket channel)
    return {
      unsubscribe: () => {
        clearInterval(interval);
        console.log(`📊 Polling stopped for basket: ${basketId}`);
      }
    };
  }

  /*
  // FUTURE: WebSocket implementation (commented out due to SDK auth issues)
  async subscribeToBasketWebSocket(basketId: string, callback: (data: any) => void) {
    try {
      // Ensure authenticated with secure helper
      const user = await authHelper.getAuthenticatedUser();
      if (!user) {
        console.error('No authenticated user for realtime subscription');
        return null;
      }

      // Verify basket access via workspace membership
      const hasAccess = await authHelper.checkBasketAccess(basketId);
      if (!hasAccess) {
        console.error('No basket access for basket subscription');
        return null;
      }

      // Get authenticated client for realtime connections
      const authenticatedClient = await authHelper.getAuthenticatedClient();
      if (!authenticatedClient) {
        console.error('Failed to get authenticated client for realtime');
        return null;
      }

      console.log(`📡 Setting up realtime for basket: ${basketId}`);

      // Single channel for all changes
      const channel = authenticatedClient
        .channel(`basket-changes-${basketId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocks',
            filter: `basket_id=eq.${basketId}`
          },
          (payload) => {
            console.log('Block changed:', payload);
            callback(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'raw_dumps',
            filter: `basket_id=eq.${basketId}`
          },
          (payload) => {
            console.log('Raw dump changed:', payload);
            callback(payload);
          }
        );

      // Subscribe
      const subscription = channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscribed for basket:', basketId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error - check browser console for details');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Subscription timeout - will retry');
        } else {
          console.log('📡 Subscription status:', status);
        }
      });

      return channel;
    } catch (error) {
      console.error('Failed to setup realtime:', error);
      return null;
    }
  }
  
  // End of WebSocket implementation - uncomment when SDK auth issues are resolved
  */
}

// Singleton instance
export const substrateService = new SubstrateService();