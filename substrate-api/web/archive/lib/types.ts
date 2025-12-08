export interface AgentMessage {
  id: string;
  task_id: string;
  user_id: string;
  agent_type: string;
  message_type: 'text' | 'clarification' | 'structured';
  message_content: {
    type: string;
    content: string;
  };
  created_at: string;
}

export interface AppEvent {
  id: string;
  v: number;
  type: 'job_update' | 'system_alert' | 'action_result' | 'collab_activity' | 'validation';
  name: string;
  phase?: 'started' | 'progress' | 'succeeded' | 'failed';
  severity: 'info' | 'success' | 'warning' | 'error';
  message: string;
  workspace_id: string;
  basket_id?: string;
  entity_id?: string;
  correlation_id?: string;
  dedupe_key?: string;
  ttl_ms?: number;
  payload?: any;
  created_at: string;
}

export interface Toast {
  id: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  dedupe_key?: string;
  created_at: number;
}
