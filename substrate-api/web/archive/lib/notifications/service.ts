/**
 * Legacy Notification Service Stub - Canon v3.0
 * Governed by: /docs/YARNNN_ALERTS_NOTIFICATIONS_CANON.md (v1.0)
 * 
 * Maintains compatibility for existing code that uses notificationService
 * Real notifications are now routed to new notification system via ToastHost
 */

// Legacy notification types for compatibility
export interface LegacyNotification {
  id?: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'system.user.action_required' | string;
  severity?: 'info' | 'success' | 'warning' | 'error' | string;
  duration?: number;
  persistent?: boolean;
  channels?: string[];
  related_entities?: Record<string, any>;
  persistence?: {
    auto_dismiss?: boolean | number;
    cross_page?: boolean;
  };
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

/**
 * Legacy notification service - now no-op stubs
 * Real notification functionality is handled by ActionCenter
 */
class NotificationServiceStub {
  private static instance: NotificationServiceStub;

  static getInstance(): NotificationServiceStub {
    if (!NotificationServiceStub.instance) {
      NotificationServiceStub.instance = new NotificationServiceStub();
    }
    return NotificationServiceStub.instance;
  }
  // Stub methods for backward compatibility - now route to new notification system
  async show(notification: LegacyNotification): Promise<void> {
    const { notificationAPI } = await import('@/lib/api/notifications');
    const severity = this._mapLegacySeverity(notification.type || notification.severity || 'info');
    
    await notificationAPI.emitActionResult(
      'legacy.notification',
      `${notification.title}${notification.message ? ': ' + notification.message : ''}`,
      { severity }
    );
  }

  async showSuccess(title: string, message?: string): Promise<void> {
    const { notificationAPI } = await import('@/lib/api/notifications');
    await notificationAPI.emitActionResult(
      'legacy.success',
      `${title}${message ? ': ' + message : ''}`,
      { severity: 'success' }
    );
  }

  async showError(title: string, message?: string): Promise<void> {
    const { notificationAPI } = await import('@/lib/api/notifications');
    await notificationAPI.emitActionResult(
      'legacy.error',
      `${title}${message ? ': ' + message : ''}`,
      { severity: 'error' }
    );
  }

  async showInfo(title: string, message?: string): Promise<void> {
    const { notificationAPI } = await import('@/lib/api/notifications');
    await notificationAPI.emitActionResult(
      'legacy.info',
      `${title}${message ? ': ' + message : ''}`,
      { severity: 'info' }
    );
  }

  async showWarning(title: string, message?: string): Promise<void> {
    const { notificationAPI } = await import('@/lib/api/notifications');
    await notificationAPI.emitActionResult(
      'legacy.warning',
      `${title}${message ? ': ' + message : ''}`,
      { severity: 'warning' }
    );
  }

  private _mapLegacySeverity(type: string): 'info' | 'success' | 'warning' | 'error' {
    if (type.includes('success')) return 'success';
    if (type.includes('error') || type.includes('failed')) return 'error';
    if (type.includes('warning') || type.includes('warn')) return 'warning';
    return 'info';
  }

  async dismiss(id: string): Promise<void> {
    // No-op
  }

  async clear(): Promise<void> {
    // No-op
  }

  // Legacy work integration stubs
  async showWorkStarted(workType: string, description?: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Work Started Stub]:', workType, description);
    }
  }

  async showWorkCompleted(workType: string, description?: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Work Completed Stub]:', workType, description);
    }
  }

  async showWorkFailed(workType: string, error?: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Work Failed Stub]:', workType, error);
    }
  }

  // Legacy governance integration stubs
  async showGovernanceUpdate(message: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Governance Stub]:', message);
    }
  }

  async showProposalReady(proposalId: string, description: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Proposal Stub]:', proposalId, description);
    }
  }

  // Legacy specific method stubs for backward compatibility
  notify(notification: LegacyNotification): string {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Notify Stub]:', notification.title, notification.message);
    }
    return 'stub-id';
  }

  async substrateApproved(title: string, description: string, substrateId: string | string[], basketId: string): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Substrate Approved Stub]:', title, description, substrateId, basketId);
    }
    return 'stub-id';
  }

  async substrateRejected(title: string, description: string, substrateId?: string | string[], basketId?: string): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Substrate Rejected Stub]:', title, description, substrateId, basketId);
    }
    return 'stub-id';
  }

  async substrateCreated(title: string, description: string, substrateId?: string | string[], basketId?: string): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Substrate Created Stub]:', title, description, substrateId, basketId);
    }
    return 'stub-id';
  }

  async approvalRequired(title: string, description: string, proposalIdOrBasketId: string | string[], basketId?: string): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Approval Required Stub]:', title, description, proposalIdOrBasketId, basketId);
    }
    return 'stub-id';
  }

  async documentComposed(title: string, description: string, documentId: string | string[], basketIdOrSubstrateCount?: string | number): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Document Composed Stub]:', title, description, documentId, basketIdOrSubstrateCount);
    }
    return 'stub-id';
  }

  async documentCompositionFailed(title: string, description: string, documentId?: string | string[], basketIdOrError?: string | number): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Document Composition Failed Stub]:', title, description, documentId, basketIdOrError);
    }
    return 'stub-id';
  }

  async reflectionComputed(title: string, description: string, reflectionIdOrData?: string | string[] | Record<string, any>, basketId?: string): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Legacy Reflection Computed Stub]:', title, description, reflectionIdOrData, basketId);
    }
    return 'stub-id';
  }
}

// Export singleton instance for compatibility
export const notificationService = new NotificationServiceStub();

// Default export for compatibility with different import styles
export default NotificationServiceStub;

// Legacy class export for compatibility
export { NotificationServiceStub as UnifiedNotificationService };

// Legacy types export for compatibility
export type { LegacyNotification as Notification };
export type NotificationService = NotificationServiceStub;