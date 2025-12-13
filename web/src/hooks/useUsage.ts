"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { UsageResponse } from "@/types";

export function useUsage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.usage();
      setUsage(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Computed values for convenience
  const fluxUsed = usage?.flux.used ?? 0;
  const fluxQuota = usage?.flux.quota ?? 0;
  const fluxRemaining = usage?.flux.remaining ?? 0;
  const fluxPercentage = fluxQuota > 0 ? (fluxUsed / fluxQuota) * 100 : 0;
  const fluxResetsAt = usage?.flux.resets_at ? new Date(usage.flux.resets_at) : null;

  const isLowFlux = fluxRemaining <= 5 && fluxRemaining > 0;
  const isOutOfFlux = fluxRemaining === 0;

  const messagesSent = usage?.messages.sent ?? 0;
  const messagesResetsAt = usage?.messages.resets_at
    ? new Date(usage.messages.resets_at)
    : null;

  const subscriptionStatus = usage?.subscription_status ?? "free";
  const isPremium = subscriptionStatus === "premium";

  return {
    // Raw data
    usage,
    isLoading,
    error,

    // Flux stats
    fluxUsed,
    fluxQuota,
    fluxRemaining,
    fluxPercentage,
    fluxResetsAt,
    isLowFlux,
    isOutOfFlux,

    // Message stats
    messagesSent,
    messagesResetsAt,

    // Subscription
    subscriptionStatus,
    isPremium,

    // Actions
    reload: fetchUsage,
  };
}
