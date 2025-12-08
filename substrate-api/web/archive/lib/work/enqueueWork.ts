import { fetchWithToken } from '@/lib/fetchWithToken';
import UnifiedNotificationService from '@/lib/notifications/service';
import { useNotificationStore } from '@/lib/notifications/store';

export type WorkType =
  | 'P0_CAPTURE'
  | 'P1_SUBSTRATE'
  | 'P2_GRAPH'
  | 'P3_REFLECTION'
  | 'P4_COMPOSE'
  | 'MANUAL_EDIT'
  | 'PROPOSAL_REVIEW'
  | 'TIMELINE_RESTORE';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface EnqueueWorkOptions {
  workType: WorkType;
  workPayload: Record<string, any>;
  priority?: Priority;
  pendingTitle?: string;
  pendingMessage?: string;
  successTitle?: string;
  successMessage?: (status: any) => string;
  failureTitle?: string;
  failureMessage?: (error: string) => string;
}

interface WorkStatusResult {
  status: 'completed' | 'failed';
  response: any;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export async function enqueueWork({
  workType,
  workPayload,
  priority = 'normal',
  pendingTitle = 'Work queued',
  pendingMessage = 'We\'ll keep you updated as it progresses.',
  successTitle = 'Work completed',
  successMessage,
  failureTitle = 'Work failed',
  failureMessage,
}: EnqueueWorkOptions): Promise<WorkStatusResult> {
  const notificationService = UnifiedNotificationService.getInstance();
  const store = useNotificationStore.getState();

  const pendingNotificationId = notificationService.notify({
    type: 'work.queued',
    title: pendingTitle,
    message: pendingMessage,
    severity: 'info',
    channels: ['toast', 'badge'],
    related_entities: { basket_id: workPayload.basket_id },
    persistence: { auto_dismiss: false, cross_page: false },
  });

  try {
    const response = await fetchWithToken('/api/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_type: workType,
        work_payload: workPayload,
        priority,
      }),
    });

    if (!response.ok) {
      const errorBody = await safeJson(response);
      const message = errorBody?.error || response.statusText;
      store.updateNotification(pendingNotificationId, {
        type: 'work.failed',
        message: failureMessage ? failureMessage(message) : message,
        severity: 'error',
        status: 'unread',
      });
      return { status: 'failed', response: errorBody };
    }

    const workResponse = await response.json();
    const { work_id: workId, status_url: statusUrl, message } = workResponse;

    store.updateNotification(pendingNotificationId, {
      type: 'work.processing',
      message: message || 'Work is processing…',
      severity: 'info',
      related_entities: {
        ...store.notifications.find(n => n.id === pendingNotificationId)?.related_entities,
        work_id: workId,
      },
    });

    const statusResult = await pollWorkStatus(statusUrl, workType, pendingNotificationId, {
      successTitle,
      successMessage,
      failureTitle,
      failureMessage,
    });

    return statusResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    store.updateNotification(pendingNotificationId, {
      type: 'work.failed',
      message: failureMessage ? failureMessage(message) : message,
      severity: 'error',
      status: 'unread',
    });
    return { status: 'failed', response: { error: message } };
  }
}

async function pollWorkStatus(
  statusUrl: string,
  workType: string,
  notificationId: string,
  messages: {
    successTitle: string;
    successMessage?: (status: any) => string;
    failureTitle: string;
    failureMessage?: (error: string) => string;
  }
): Promise<WorkStatusResult> {
  const store = useNotificationStore.getState();
  const notificationService = UnifiedNotificationService.getInstance();

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const statusResponse = await fetchWithToken(statusUrl);
      if (!statusResponse.ok) {
        continue;
      }
      const statusJson = await statusResponse.json();
      const status = statusJson.status as 'pending' | 'claimed' | 'processing' | 'cascading' | 'completed' | 'failed';

      if (status === 'pending' || status === 'claimed' || status === 'processing' || status === 'cascading') {
        store.updateNotification(notificationId, {
          type: status === 'processing' ? 'work.processing' : 'work.queued',
          message: statusJson.estimated_completion
            ? `Processing… ${statusJson.estimated_completion}`
            : 'Processing…',
          severity: 'info',
        });
        continue;
      }

      if (status === 'completed') {
        const substrateImpact = statusJson.substrate_impact || {};
        const created = substrateImpact.substrate_created || {};
        const blocks = created.blocks || 0;
        const contextItems = created.context_items || 0;
        const relationships = substrateImpact.relationships_mapped || 0;

        const summaryParts: string[] = [];
        if (blocks) summaryParts.push(`${blocks} blocks`);
        if (contextItems) summaryParts.push(`${contextItems} context items`);
        if (relationships) summaryParts.push(`${relationships} relationships`);
        const defaultMessage = summaryParts.length
          ? `Created ${summaryParts.join(', ')}`
          : `${workType} completed successfully.`;

        store.updateNotification(notificationId, {
          type: 'work.completed',
          message: messages.successMessage ? messages.successMessage(statusJson) : defaultMessage,
          severity: 'success',
          status: 'unread',
        });

        notificationService.notify({
          type: 'work.completed',
          title: messages.successTitle,
          message: messages.successMessage ? messages.successMessage(statusJson) : defaultMessage,
          severity: 'success',
          channels: ['toast'],
          related_entities: { work_id: statusJson.work_id },
          persistence: { auto_dismiss: 5, cross_page: false },
        });

        return { status: 'completed', response: statusJson };
      }

      if (status === 'failed') {
        const errorMessage = statusJson.error?.message || 'Work failed';

        store.updateNotification(notificationId, {
          type: 'work.failed',
          message: messages.failureMessage ? messages.failureMessage(errorMessage) : errorMessage,
          severity: 'error',
          status: 'unread',
        });

        notificationService.notify({
          type: 'work.failed',
          title: messages.failureTitle,
          message: messages.failureMessage ? messages.failureMessage(errorMessage) : errorMessage,
          severity: 'error',
          channels: ['toast', 'persistent'],
          related_entities: { work_id: statusJson.work_id },
          persistence: { auto_dismiss: false, cross_page: true },
        });

        return { status: 'failed', response: statusJson };
      }
    } catch (error) {
      continue;
    }
  }

  const timeoutMessage = 'Work status timeout';
  store.updateNotification(notificationId, {
    type: 'work.failed',
    message: messages.failureMessage ? messages.failureMessage(timeoutMessage) : timeoutMessage,
    severity: 'error',
    status: 'unread',
  });

  notificationService.notify({
    type: 'work.failed',
    title: messages.failureTitle,
    message: messages.failureMessage ? messages.failureMessage(timeoutMessage) : timeoutMessage,
    severity: 'error',
    channels: ['toast', 'persistent'],
    persistence: { auto_dismiss: false, cross_page: true },
  });

  return { status: 'failed', response: { error: timeoutMessage } };
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
