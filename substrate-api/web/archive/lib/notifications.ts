// Governed by: /docs/YARNNN_ALERTS_NOTIFICATIONS_CANON.md (v1.0)

import { create } from 'zustand';
import type { AppEvent, Toast } from './types';

interface NotificationStore {
  toasts: Toast[];
  eventHistory: AppEvent[];
  
  // Actions
  addToast: (toast: Omit<Toast, 'id' | 'created_at'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  addEvent: (event: AppEvent) => void;
  
  // Internal
  _processAppEvent: (event: AppEvent) => void;
}

const TOAST_DURATION_MAP = {
  info: 4000,
  success: 3000,
  warning: 6000,
  error: 8000
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],
  eventHistory: [],
  
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duration = toast.duration || TOAST_DURATION_MAP[toast.severity];
    const created_at = Date.now();
    
    const newToast: Toast = {
      ...toast,
      id,
      duration,
      created_at
    };
    
    set((state) => {
      // Dedupe logic - remove existing toast with same dedupe_key
      const filteredToasts = toast.dedupe_key 
        ? state.toasts.filter(t => t.dedupe_key !== toast.dedupe_key)
        : state.toasts;
      
      return {
        toasts: [...filteredToasts, newToast]
      };
    });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },
  
  clearToasts: () => {
    set({ toasts: [] });
  },
  
  addEvent: (event) => {
    if (!event || typeof event.type !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[NotificationStore] Ignoring malformed event payload', event);
      }
      return;
    }
    set((state) => ({
      eventHistory: [event, ...state.eventHistory.slice(0, 99)] // Keep last 100
    }));
    
    // Process for UI display
    get()._processAppEvent(event);
  },
  
  _processAppEvent: (event) => {
    // Apply UI Policy Matrix from Canon
    const shouldShowToast = (() => {
      // Job updates: show start/end phases only
      if (event.type === 'job_update') {
        return event.phase === 'started' || event.phase === 'succeeded' || event.phase === 'failed';
      }
      
      // System alerts: always show
      if (event.type === 'system_alert') {
        return true;
      }
      
      // Action results: show success, warnings, and errors (not just info)
      if (event.type === 'action_result') {
        return event.severity !== 'info';
      }
      
      // Collaboration: show if not info
      if (event.type === 'collab_activity') {
        return event.severity !== 'info';
      }
      
      // Validation: show warnings/errors only
      if (event.type === 'validation') {
        return event.severity === 'warning' || event.severity === 'error';
      }
      
      return false;
    })();
    
    if (event && typeof event.message === 'string' && shouldShowToast) {
      get().addToast({
        message: event.message,
        severity: event.severity,
        dedupe_key: event.dedupe_key,
        duration: event.ttl_ms
      });
    }
  }
}));
