/**
 * Mock adapter for API client
 * Provides realistic mock data for development and CI without requiring live services
 */

import {
  type Basket,
  type Block,
  type Delta,
  type Suggestion,
  type RawDump,
  type Paginated
} from '../contracts';
import type { DocumentDTO } from '@/shared/contracts/documents';

// Generate consistent IDs based on input
function mockId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + '-mock-' + seed.slice(0, 4);
}

function mockTimestamp(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString();
}

// Mock workspace ID
const MOCK_WORKSPACE_ID = mockId('workspace');

// Mock data generators
export function generateMockBasket(basketId: string): Basket {
  return {
    id: basketId,
    name: `Mock Project ${basketId.slice(0, 8)}`,
    status: 'ACTIVE',
    workspace_id: MOCK_WORKSPACE_ID,
    raw_dump_id: mockId(`dump-${basketId}`),
    origin_template: 'strategic-analysis',
    tags: ['mock', 'development'],
    created_at: mockTimestamp(Math.floor(Math.random() * 7)),
    // Add dashboard metrics
    blocks: Math.floor(Math.random() * 12) + 3, // 3-15 blocks
    raw_dumps: Math.floor(Math.random() * 5) + 1, // 1-6 dumps
    documents: Math.floor(Math.random() * 8) + 2, // 2-10 docs
  };
}

export function generateMockBlocks(basketId: string, count = 3): Block[] {
  return Array.from({ length: count }, (_, i) => ({
    id: mockId(`block-${basketId}-${i}`),
    basket_id: basketId,
    raw_dump_id: mockId(`dump-${basketId}`),
    title: `Mock Block ${i + 1}`,
    body_md: `# Mock Block Content ${i + 1}\n\nThis is a mock block generated for development purposes. It contains sample markdown content to test the UI.\n\n- Point 1\n- Point 2\n- Point 3`,
    status: i === 0 ? 'proposed' : 'accepted',
    confidence_score: 0.8 + (Math.random() * 0.2),
    processing_agent: 'mock_agent',
    metadata: {
      mock: true,
      generated_at: new Date().toISOString(),
    },
    created_at: mockTimestamp(i),
    updated_at: mockTimestamp(Math.max(0, i - 1)),
  }));
}

export function generateMockDocuments(basketId: string, count = 2): DocumentDTO[] {
  return Array.from({ length: count }, (_, i) => ({
    id: mockId(`doc-${basketId}-${i}`),
    basket_id: basketId,
    title: `Mock Document ${i + 1}`,
    doc_type: i === 0 ? 'document_canon' : 'artifact_other',
    current_version_hash: null,
    latest_version_created_at: mockTimestamp(i),
    metadata: {
      mock: true,
      preview: 'Mock preview text for development fixtures.',
      structured_outline: {
        summary: 'This is a mock outline summary.',
        themes: ['Mock theme A', 'Mock theme B'],
      },
    },
    updated_at: mockTimestamp(i),
  }));
}

export function generateMockDeltas(basketId: string, count = 2): Delta[] {
  return Array.from({ length: count }, (_, i) => ({
    delta_id: mockId(`delta-${basketId}-${i}`),
    basket_id: basketId,
    summary: `Mock change ${i + 1}: Updated content and structure`,
    status: 'pending',
    changes: [
      { type: 'block_added', id: mockId(`block-new-${i}`) },
      { type: 'document_updated', id: mockId(`doc-${basketId}-0`) },
    ],
    metadata: {
      mock: true,
      changeCount: 2,
    },
    created_at: mockTimestamp(i / 2),
  }));
}

export function generateMockSuggestions(basketId: string, count = 4): Suggestion[] {
  const suggestionTypes = ['question', 'insight', 'action', 'resource'] as const;
  const suggestions = [
    'Analyze patterns in recent blocks',
    'Create summary document',
    'Review pending changes',
    'Export knowledge base',
  ];
  
  return Array.from({ length: count }, (_, i) => ({
    id: mockId(`suggestion-${basketId}-${i}`),
    basket_id: basketId,
    type: suggestionTypes[i % suggestionTypes.length],
    title: suggestions[i] || `Mock suggestion ${i + 1}`,
    description: `This is a mock suggestion for development. It represents the type of intelligent recommendations the system would provide.`,
    confidence: 0.7 + (Math.random() * 0.3),
    metadata: {
      mock: true,
      source: 'mock_intelligence',
    },
    created_at: mockTimestamp(i / 4),
  }));
}

export function generateMockRawDump(basketId: string): RawDump {
  return {
    id: mockId(`dump-${basketId}`),
    basket_id: basketId,
    workspace_id: MOCK_WORKSPACE_ID,
    body_md: `# Mock Raw Dump\n\nThis is mock content that was ingested into the system.\n\n## Key Points\n\n- Important observation 1\n- Critical insight 2\n- Strategic direction 3`,
    file_url: null,
    processing_status: 'processed',
    metadata: {
      mock: true,
      source: 'development',
    },
    created_at: mockTimestamp(1),
    processed_at: mockTimestamp(0.5),
  };
}

/**
 * Mock API adapter implementation
 */
export class MockApiAdapter {
  async request<T>(endpoint: string, options: any = {}): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const { method = 'GET' } = options;
    const url = new URL(endpoint, 'http://localhost:3000');
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.debug('[mock-api]', method, endpoint);
    
    // Route to appropriate mock handler
    if (pathParts[0] === 'api') {
      return this.handleApiRoute(pathParts.slice(1), method, options) as T;
    }
    
    throw new Error(`Mock adapter: Unhandled endpoint ${endpoint}`);
  }
  
  private handleApiRoute(pathParts: string[], method: string, options: any): any {
    const [resource, ...rest] = pathParts;
    
    switch (resource) {
      case 'baskets':
        return this.handleBaskets(rest, method, options);
      case 'blocks':
        return this.handleBlocks(rest, method, options);
      case 'documents':
        return this.handleDocuments(rest, method, options);
      case 'dumps':
        return this.handleDumps(rest, method, options);
      case 'intelligence':
        return this.handleIntelligence(rest, method, options);
      default:
        throw new Error(`Mock adapter: Unknown resource ${resource}`);
    }
  }
  
  private handleBaskets(pathParts: string[], method: string, options: any): any {
    if (method === 'GET' && pathParts.length === 0) {
      // List baskets
      const baskets = Array.from({ length: 3 }, (_, i) => 
        generateMockBasket(mockId(`basket-${i}`))
      );
      return { items: baskets, has_more: false };
    }
    
    if (method === 'GET' && pathParts.length === 1) {
      // Get single basket
      const basketId = pathParts[0];
      return generateMockBasket(basketId);
    }
    
    if (method === 'GET' && pathParts[1] === 'deltas') {
      // Get basket deltas
      const basketId = pathParts[0];
      return generateMockDeltas(basketId);
    }
    
    if (method === 'POST' && pathParts[1] === 'work') {
      // Process basket work
      const basketId = pathParts[0];
      return {
        delta_id: mockId(`delta-${basketId}-new`),
        status: 'success',
        changes: [{ type: 'mock_change' }],
      };
    }
    
    throw new Error(`Mock adapter: Unhandled basket route ${pathParts.join('/')}`);
  }
  
  private handleBlocks(pathParts: string[], method: string, options: any): any {
    const basketId = new URLSearchParams(options.url?.split('?')[1] || '').get('basket_id');
    
    if (method === 'GET' && basketId) {
      return { items: generateMockBlocks(basketId), has_more: false };
    }
    
    throw new Error(`Mock adapter: Unhandled blocks route ${pathParts.join('/')}`);
  }
  
  private handleDocuments(pathParts: string[], method: string, options: any): any {
    const basketId = new URLSearchParams(options.url?.split('?')[1] || '').get('basket_id');
    
    if (method === 'GET' && basketId) {
      return { items: generateMockDocuments(basketId), has_more: false };
    }
    
    throw new Error(`Mock adapter: Unhandled documents route ${pathParts.join('/')}`);
  }
  
  private handleDumps(pathParts: string[], method: string, options: any): any {
    if (method === 'POST' && pathParts[0] === 'new') {
      // Create new dump
      const basketId = options.body?.basket_id || mockId('basket-default');
      return {
        id: mockId(`dump-${basketId}-new`),
        status: 'created',
        processing: 'triggered',
      };
    }
    
    throw new Error(`Mock adapter: Unhandled dumps route ${pathParts.join('/')}`);
  }
  
  private handleIntelligence(pathParts: string[], method: string, options: any): any {
    if (pathParts[0] === 'basket' && pathParts[2] === 'comprehensive') {
      // Get suggestions
      const basketId = pathParts[1];
      return generateMockSuggestions(basketId);
    }
    
    throw new Error(`Mock adapter: Unhandled intelligence route ${pathParts.join('/')}`);
  }
}
