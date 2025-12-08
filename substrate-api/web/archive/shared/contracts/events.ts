// Event system types (canonical events table)

export type Event = {
  id: string;
  basket_id: string;
  workspace_id: string;
  kind: string;
  payload: Record<string, any>;
  origin: "user" | "system" | "agent";
  actor_id?: string;
  agent_type?: string;
  block_id?: string;
  ts: string;
};

// Pagination types
export type EventsPage = {
  events: Event[];
  last_cursor: {
    ts: string;
    id: string;
  };
  has_more: boolean;
};