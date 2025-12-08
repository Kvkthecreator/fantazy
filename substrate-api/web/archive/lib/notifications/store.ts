/**
 * Legacy Notification Store Stub - Canon v3.0
 * Governed by: /docs/YARNNN_ALERTS_NOTIFICATIONS_CANON.md (v1.0)
 * 
 * Compatibility store for legacy notification system
 * Real notifications are now handled by new notification system with ToastHost
 */

import { create } from 'zustand';
import type { UnifiedNotification, GovernanceSettings } from './types';

interface NotificationStore {
  // State
  notifications: UnifiedNotification[];
  workspace_id: string | null;
  user_id: string | null;
  connection_status: 'connected' | 'disconnected' | 'reconnecting';
  governance: GovernanceSettings;

  // Actions (all no-ops for compatibility)
  setWorkspace: (workspaceId: string, userId: string) => void;
  addNotification: (notification: Omit<UnifiedNotification, 'id' | 'created_at' | 'updated_at'>) => void;
  updateNotification: (id: string, updates: Partial<UnifiedNotification>) => void;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  acknowledgeNotification: (id: string) => void;
  clearAll: () => void;
  updateGovernance: (settings: Partial<GovernanceSettings>) => void;

  // Queries (all return empty/default values)
  getNotificationsByCategory: (category: string) => UnifiedNotification[];
  getUnreadCount: () => number;
  getBadgeCount: (channel: string) => number;
  hasPendingWork: () => boolean;
}

/**
 * Legacy notification store - now no-op stubs
 */
export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // Default state
  notifications: [],
  workspace_id: null,
  user_id: null,
  connection_status: 'connected',
  governance: {
    auto_approve: false,
    confidence_threshold: 0.8
  },

  // No-op actions for compatibility
  setWorkspace: (workspaceId: string, userId: string) => {
    set({ workspace_id: workspaceId, user_id: userId });
  },

  addNotification: (notification) => {
    // No-op - ActionCenter handles notifications now
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Store Stub] Add notification:', notification.title);
    }
  },

  updateNotification: (id: string, updates: Partial<UnifiedNotification>) => {
    // No-op - ActionCenter handles notifications now
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Store Stub] Update notification:', id, updates);
    }
  },

  dismissNotification: (id: string) => {
    // No-op
  },

  markAsRead: (id: string) => {
    // No-op
  },

  acknowledgeNotification: (id: string) => {
    // No-op
  },

  clearAll: () => {
    // No-op
  },

  updateGovernance: (settings: Partial<GovernanceSettings>) => {
    set({ governance: { ...get().governance, ...settings } });
  },

  // Stub queries that return empty/default values
  getNotificationsByCategory: (category: string) => [],
  getUnreadCount: () => 0,
  getBadgeCount: (channel: string) => 0,
  hasPendingWork: () => false
}));

// Export store instance for compatibility
export default useNotificationStore;