// Delta change tracking

export type Delta = {
  delta_id: string;
  basket_id: string;
  summary: string;
  status?: string;
  changes?: unknown[];
  metadata?: Record<string, any>;
  created_at: string;
};