import type { SubstrateIntelligence } from '@/lib/substrate/types';

export interface IntelligenceChange {
  field: 'themes' | 'insights' | 'recommendations' | 'understanding';
  changeType: 'added' | 'modified' | 'removed' | 'reordered';
  previous: any;
  current: any;
  confidence: number;
  significance: 'minor' | 'moderate' | 'major';
}

export interface ContentHash {
  documentsHash: string;
  rawDumpsHash: string;
  basketHash: string;
  timestamp: string;
}

export interface IntelligenceEvent {
  id: string;
  basketId: string;
  workspaceId: string;
  kind: 'intelligence_generation' | 'intelligence_approval' | 'intelligence_rejection';
  intelligence: SubstrateIntelligence;
  contentHash: ContentHash;
  changes: IntelligenceChange[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'partial';
  approvedSections: string[];
  actorId: string;
  origin: 'manual' | 'automatic' | 'background';
  timestamp: string;
}

/**
 * Generate SHA-256 hash of basket content for change detection
 * Canon v3.0: Uses 'content' field (from document versions) instead of 'content_raw'
 */
export async function generateContentHash(basketData: {
  documents: Array<{ id: string; content: string; updated_at: string }>;
  rawDumps: Array<{ id: string; body_md: string; created_at: string }>;
  basketId: string;
}): Promise<ContentHash> {
  // Sort documents by ID for consistent hashing
  const sortedDocs = basketData.documents
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(doc => `${doc.id}:${doc.content}:${doc.updated_at}`)
    .join('|');

  // Sort raw dumps by creation time
  const sortedDumps = basketData.rawDumps
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(dump => `${dump.id}:${dump.body_md}:${dump.created_at}`)
    .join('|');

  // Use a simple hash function that works in both browser and Node.js
  const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  return {
    documentsHash: simpleHash(sortedDocs),
    rawDumpsHash: simpleHash(sortedDumps),
    basketHash: simpleHash(`${basketData.basketId}:${sortedDocs}:${sortedDumps}`),
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect changes between two intelligence objects
 */
export function detectIntelligenceChanges(
  previous: SubstrateIntelligence,
  current: SubstrateIntelligence
): IntelligenceChange[] {
  const changes: IntelligenceChange[] = [];

  // Compare themes
  const themeChanges = detectArrayChanges(
    previous.contextUnderstanding.themes,
    current.contextUnderstanding.themes,
    'themes'
  );
  changes.push(...themeChanges);

  // Compare insights
  const insightChanges = detectObjectArrayChanges(
    previous.intelligence.insights,
    current.intelligence.insights,
    'insights',
    'id'
  );
  changes.push(...insightChanges);

  // Compare recommendations
  const recChanges = detectObjectArrayChanges(
    previous.intelligence.recommendations,
    current.intelligence.recommendations,
    'recommendations',
    'id'
  );
  changes.push(...recChanges);

  // Compare understanding intent
  if (previous.contextUnderstanding.intent !== current.contextUnderstanding.intent) {
    changes.push({
      field: 'understanding',
      changeType: 'modified',
      previous: previous.contextUnderstanding.intent,
      current: current.contextUnderstanding.intent,
      confidence: 0.9,
      significance: 'moderate'
    });
  }

  return changes;
}

/**
 * Detect changes in simple string arrays (themes)
 */
function detectArrayChanges(
  previous: string[],
  current: string[],
  field: IntelligenceChange['field']
): IntelligenceChange[] {
  const changes: IntelligenceChange[] = [];

  // Added items
  const added = current.filter(item => !previous.includes(item));
  added.forEach(item => {
    changes.push({
      field,
      changeType: 'added',
      previous: null,
      current: item,
      confidence: 0.95,
      significance: 'moderate'
    });
  });

  // Removed items
  const removed = previous.filter(item => !current.includes(item));
  removed.forEach(item => {
    changes.push({
      field,
      changeType: 'removed',
      previous: item,
      current: null,
      confidence: 0.95,
      significance: 'moderate'
    });
  });

  // Check for reordering (if content same but order different)
  if (previous.length === current.length && 
      previous.every(item => current.includes(item)) &&
      current.every(item => previous.includes(item)) &&
      JSON.stringify(previous) !== JSON.stringify(current)) {
    
    // Only flag as significant if the order change is substantial
    const orderSignificance = calculateOrderSignificance(previous, current);
    if (orderSignificance > 0.3) {
      changes.push({
        field,
        changeType: 'reordered',
        previous: previous,
        current: current,
        confidence: 0.8,
        significance: orderSignificance > 0.6 ? 'moderate' : 'minor'
      });
    }
  }

  return changes;
}

/**
 * Detect changes in object arrays (insights, recommendations)
 */
function detectObjectArrayChanges(
  previous: any[],
  current: any[],
  field: IntelligenceChange['field'],
  idField: string
): IntelligenceChange[] {
  const changes: IntelligenceChange[] = [];

  // Create maps for easier comparison
  const prevMap = new Map(previous.map(item => [item[idField], item]));
  const currMap = new Map(current.map(item => [item[idField], item]));

  // Added items
  current.forEach(item => {
    if (!prevMap.has(item[idField])) {
      changes.push({
        field,
        changeType: 'added',
        previous: null,
        current: item,
        confidence: 0.9,
        significance: 'moderate'
      });
    }
  });

  // Removed items
  previous.forEach(item => {
    if (!currMap.has(item[idField])) {
      changes.push({
        field,
        changeType: 'removed',
        previous: item,
        current: null,
        confidence: 0.9,
        significance: 'moderate'
      });
    }
  });

  // Modified items
  current.forEach(item => {
    const prevItem = prevMap.get(item[idField]);
    if (prevItem && !deepEqual(prevItem, item)) {
      // Check if it's just a minor confidence change
      const confidenceDiff = Math.abs((item.confidence || 0) - (prevItem.confidence || 0));
      if (confidenceDiff < 0.1 && deepEqual({...prevItem, confidence: item.confidence}, item)) {
        return; // Skip minor confidence changes
      }

      changes.push({
        field,
        changeType: 'modified',
        previous: prevItem,
        current: item,
        confidence: 0.85,
        significance: calculateModificationSignificance(prevItem, item)
      });
    }
  });

  return changes;
}

/**
 * Calculate significance of order changes
 */
function calculateOrderSignificance(previous: string[], current: string[]): number {
  if (previous.length !== current.length) return 1.0;
  
  let changes = 0;
  for (let i = 0; i < previous.length; i++) {
    if (previous[i] !== current[i]) changes++;
  }
  
  return changes / previous.length;
}

/**
 * Calculate significance of object modifications
 */
function calculateModificationSignificance(previous: any, current: any): IntelligenceChange['significance'] {
  // Key fields that indicate major changes
  const keyFields = ['title', 'description', 'priority', 'type'];
  let keyChanges = 0;
  let totalChanges = 0;

  for (const [key, value] of Object.entries(current)) {
    if (previous[key] !== value) {
      totalChanges++;
      if (keyFields.includes(key)) keyChanges++;
    }
  }

  if (keyChanges > 0) return 'major';
  if (totalChanges > 2) return 'moderate';
  return 'minor';
}

/**
 * Deep equality check for objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}

/**
 * Check if content hash indicates significant changes
 */
export function hasContentChanged(previous: ContentHash, current: ContentHash): {
  documentsChanged: boolean;
  rawDumpsChanged: boolean;
  anyChanged: boolean;
} {
  return {
    documentsChanged: previous.documentsHash !== current.documentsHash,
    rawDumpsChanged: previous.rawDumpsHash !== current.rawDumpsHash,
    anyChanged: previous.basketHash !== current.basketHash
  };
}

/**
 * Filter changes by significance level
 */
export function filterSignificantChanges(
  changes: IntelligenceChange[],
  minSignificance: 'minor' | 'moderate' | 'major' = 'moderate'
): IntelligenceChange[] {
  const significanceOrder = { minor: 0, moderate: 1, major: 2 };
  const threshold = significanceOrder[minSignificance];
  
  return changes.filter(change => 
    significanceOrder[change.significance] >= threshold
  );
}

/**
 * Group changes by field for display
 */
export function groupChangesByField(changes: IntelligenceChange[]): Record<string, IntelligenceChange[]> {
  return changes.reduce((groups, change) => {
    if (!groups[change.field]) {
      groups[change.field] = [];
    }
    groups[change.field].push(change);
    return groups;
  }, {} as Record<string, IntelligenceChange[]>);
}