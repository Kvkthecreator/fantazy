// Shared contracts - all types used across frontend and backend

// Core domain entities
export * from './baskets';
export * from './blocks';
export * from './documents';
export * from './dumps';
export * from './context';
export * from './events';
export * from './memory';
export * from './suggestions';
export * from './deltas';
export * from './workspaces';

// API operations
export * from './ingest';
export * from './onboarding';

// Common pagination and utility types
export type Paginated<T> = {
  items: T[];
  cursor?: {
    after_created_at?: string;
    after_id?: string;
  };
  has_more: boolean;
  total_count?: number;
};

export type ApiError = {
  error: string;
  details?: string;
  code?: string;
  status: number;
};