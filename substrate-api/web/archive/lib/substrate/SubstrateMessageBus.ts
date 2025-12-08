// TRUE CONTEXT OS - The ONLY Communication Layer
// Single message bus for all substrate operations

import type { SubstrateOperation, SubstrateResponse, SubstrateElement } from './SubstrateTypes';
import { apiClient } from '@/lib/api/client';

export interface SubstrateMessage {
  id: string;
  type: 'substrate.operation' | 'substrate.update' | 'substrate.error';
  operation?: SubstrateOperation;
  data?: any;
  basketId: string;
  workspaceId: string;
  timestamp: Date;
}

export interface SubstrateEvent extends SubstrateMessage {
  type: 'substrate.update';
  eventType: 'created' | 'updated' | 'deleted' | 'linked';
  substrate: SubstrateElement;
}

type SubstrateEventCallback = (event: SubstrateEvent) => void;

export class SubstrateMessageBus {
  private static instance: SubstrateMessageBus;
  private eventListeners: Map<string, Set<SubstrateEventCallback>> = new Map();
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  private constructor() {}

  public static getInstance(): SubstrateMessageBus {
    if (!SubstrateMessageBus.instance) {
      SubstrateMessageBus.instance = new SubstrateMessageBus();
    }
    return SubstrateMessageBus.instance;
  }

  // DISPATCH OPERATIONS - Central hub for all substrate operations

  async dispatch(message: SubstrateMessage): Promise<SubstrateResponse> {
    try {
      // Send via REST API
      const response = await this.sendToAPI(message);
      
      // Emit success event
      if (response.success && response.data) {
        this.emitEvent({
          ...message,
          type: 'substrate.update',
          eventType: 'created', // or updated based on operation
          substrate: response.data as SubstrateElement
        } as SubstrateEvent);
      }

      return response;
    } catch (error) {
      // Emit error event
      // Emit error via message bus - TODO: implement proper error event type

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispatch message'
      };
    }
  }

  // BATCH OPERATIONS - Handle multiple operations atomically

  async batchDispatch(messages: SubstrateMessage[]): Promise<SubstrateResponse[]> {
    const results: SubstrateResponse[] = [];
    
    // Process messages in order
    for (const message of messages) {
      const result = await this.dispatch(message);
      results.push(result);
      
      // If any operation fails, we might want to rollback previous ones
      if (!result.success) {
        // For now, continue processing, but log the error
        console.error('Batch operation failed:', message.type, result.error);
      }
    }

    return results;
  }

  // REAL-TIME SUBSCRIPTIONS - WebSocket + Event system

  subscribeToSubstrate(basketId: string, callback: SubstrateEventCallback): () => void {
    // Add to local event listeners
    if (!this.eventListeners.has(basketId)) {
      this.eventListeners.set(basketId, new Set());
    }
    this.eventListeners.get(basketId)!.add(callback);

    // Ensure WebSocket connection for real-time updates
    this.ensureWebSocketConnection(basketId);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(basketId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(basketId);
        }
      }
    };
  }

  // WEBSOCKET MANAGEMENT

  private async ensureWebSocketConnection(basketId: string): Promise<void> {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
        (process.env.NODE_ENV === 'production' 
          ? `wss://${typeof window !== 'undefined' ? window.location.hostname : 'api.yarnnn.com'}/ws`
          : 'ws://localhost:3001/ws');
      
      this.websocket = new WebSocket(`${wsUrl}?basketId=${basketId}`);
      
      this.websocket.onopen = () => {
        console.log('SubstrateMessageBus: WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        try {
          const message: SubstrateEvent = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('SubstrateMessageBus: WebSocket disconnected');
        this.handleWebSocketDisconnect(basketId);
      };

      this.websocket.onerror = (error) => {
        console.error('SubstrateMessageBus: WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }
  }

  private handleWebSocketMessage(message: SubstrateEvent): void {
    // Emit to local listeners
    this.emitEvent(message);
  }

  private handleWebSocketDisconnect(basketId: string): void {
    // Attempt to reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.ensureWebSocketConnection(basketId);
      }, delay);
    }
  }

  // EVENT EMISSION

  private emitEvent(event: SubstrateEvent): void {
    const listeners = this.eventListeners.get(event.basketId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in substrate event callback:', error);
        }
      });
    }
  }

  // API COMMUNICATION

  private async sendToAPI(message: SubstrateMessage): Promise<SubstrateResponse> {
    if (!message.operation) {
      throw new Error('Operation is required');
    }

    const response = await apiClient.request('/api/substrate/compose', {
      method: 'POST',
      body: JSON.stringify({
        operation: this.mapOperationType(message.operation.type),
        data: message.operation.substrate,
        agentType: message.operation.agentType,
        basketId: message.basketId,
        workspaceId: message.workspaceId,
        ...message.data
      })
    });

    if (!response || (response as any)?.error) {
      throw new Error(`API request failed: ${(response as any)?.error || 'Unknown error'}`);
    }

    return response as SubstrateResponse;
  }

  private mapOperationType(type: SubstrateOperation['type']): string {
    const operationMap: Record<SubstrateOperation['type'], string> = {
      'add': 'add_raw_dump', // Default, will be overridden based on substrate type
      'update': 'update_substrate',
      'delete': 'delete_substrate',
      'compose': 'compose_document',
      'link': 'link_substrate',
      'process': 'process_with_agent'
    };

    return operationMap[type] || type;
  }

  // UTILITY METHODS

  createMessage(
    operation: SubstrateOperation,
    basketId: string,
    workspaceId: string,
    additionalData?: any
  ): SubstrateMessage {
    return {
      id: this.generateMessageId(),
      type: 'substrate.operation',
      operation,
      data: additionalData,
      basketId,
      workspaceId,
      timestamp: new Date()
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // CLEANUP

  destroy(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.eventListeners.clear();
  }
}