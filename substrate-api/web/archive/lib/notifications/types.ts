/**
 * Legacy Notification Types - Canon v3.0
 * 
 * Compatibility types for legacy notification system
 * Real notifications are now handled by ActionCenter component
 */

// Legacy notification types for compatibility
export interface UnifiedNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'work.failed' | 'work.queued' | 'work.completed' | string;
  status: 'unread' | 'read' | 'dismissed';
  channels: NotificationChannel[];
  persistence: {
    auto_dismiss: boolean | number;
    dismiss_delay?: number;
    requires_acknowledgment?: boolean;
    cross_page?: boolean;
  };
  metadata?: Record<string, any>;
  related_entities?: Record<string, any>;
  severity?: string;
  created_at: string;
  updated_at: string;
  workspace_id?: string;
  user_id?: string;
}

export type NotificationChannel = 'toast' | 'badge' | 'drawer' | 'persistent';

export type NotificationCategory = 
  | 'work_progress'
  | 'governance'
  | 'system'
  | 'user_action'
  | 'collaboration';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

// Legacy governance types
export interface GovernanceSettings {
  auto_approve: boolean;
  confidence_threshold: number;
}

// Legacy work integration types
export interface WorkNotification {
  work_id: string;
  work_type: string;
  status: 'started' | 'completed' | 'failed';
  description?: string;
  error?: string;
}

// Export for compatibility
export type { UnifiedNotification as Notification };
export type NotificationStatus = UnifiedNotification['status'];
export type NotificationType = UnifiedNotification['type'];