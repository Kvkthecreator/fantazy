"use client";

import { useMemo } from "react";
import { useNotificationStore } from "@/lib/notifications";
import type { AppEvent } from "@/lib/types";

export interface BasketReadinessSummary {
  status: "idle" | "processing" | "ready" | "failed";
  activeJobs: number;
  lastSuccessEvent?: AppEvent;
  lastFailureEvent?: AppEvent;
}

function isJobEvent(event: AppEvent): boolean {
  return event.type === "job_update" && !!event.phase;
}

function eventDate(event?: AppEvent): number {
  return event ? new Date(event.created_at).getTime() : 0;
}

/**
 * Summarize realtime job events for a basket using the unified app_events stream.
 */
export function useBasketReadiness(basketId: string): BasketReadinessSummary {
  const eventHistory = useNotificationStore((state) => state.eventHistory);

  return useMemo(() => {
    if (!basketId) {
      return { status: "idle", activeJobs: 0 };
    }

    const activeJobs = new Map<string, AppEvent>();
    let lastSuccess: AppEvent | undefined;
    let lastFailure: AppEvent | undefined;

    for (const event of eventHistory) {
      if (!event || event.basket_id !== basketId || !isJobEvent(event)) {
        continue;
      }

      const correlationKey = event.correlation_id || `${event.name}-${event.entity_id ?? ""}`;
      if (!correlationKey) continue;

      switch (event.phase) {
        case "started":
        case "progress":
          if (!activeJobs.has(correlationKey)) {
            activeJobs.set(correlationKey, event);
          }
          break;
        case "succeeded":
          activeJobs.delete(correlationKey);
          if (!lastSuccess || eventDate(event) > eventDate(lastSuccess)) {
            lastSuccess = event;
          }
          break;
        case "failed":
          activeJobs.delete(correlationKey);
          if (!lastFailure || eventDate(event) > eventDate(lastFailure)) {
            lastFailure = event;
          }
          break;
        default:
          break;
      }
    }

    let status: BasketReadinessSummary["status"] = "idle";
    if (activeJobs.size > 0) {
      status = "processing";
    } else if (lastFailure && (!lastSuccess || eventDate(lastFailure) > eventDate(lastSuccess))) {
      status = "failed";
    } else if (lastSuccess) {
      status = "ready";
    }

    return {
      status,
      activeJobs: activeJobs.size,
      lastSuccessEvent: lastSuccess,
      lastFailureEvent: lastFailure,
    };
  }, [basketId, eventHistory]);
}

