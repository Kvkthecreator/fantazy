"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { SparkBalance, TopupPack, SparkCheck } from "@/types";

export function useSparks() {
  const [balance, setBalance] = useState<SparkBalance | null>(null);
  const [topupPacks, setTopupPacks] = useState<TopupPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await api.credits.getBalance();
      setBalance(data);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const fetchTopupPacks = useCallback(async () => {
    try {
      const data = await api.topup.getPacks();
      setTopupPacks(data);
    } catch (err) {
      // Non-critical, packs may not be configured yet
      console.warn("Failed to fetch topup packs:", err);
    }
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([fetchBalance(), fetchTopupPacks()]);
    setIsLoading(false);
  }, [fetchBalance, fetchTopupPacks]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * Check if user can afford a feature
   */
  const checkBalance = async (featureKey: string): Promise<SparkCheck> => {
    return api.credits.check(featureKey);
  };

  /**
   * Purchase a top-up pack (redirects to checkout)
   */
  const purchaseTopup = async (packName: string): Promise<void> => {
    setIsCheckoutLoading(true);
    try {
      const { checkout_url } = await api.topup.checkout(packName);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err as Error);
      setIsCheckoutLoading(false);
      throw err;
    }
    // Don't set loading false - we're redirecting
  };

  // Computed values
  const sparkBalance = balance?.balance ?? 0;
  const lifetimeEarned = balance?.lifetime_earned ?? 0;
  const lifetimeSpent = balance?.lifetime_spent ?? 0;
  const subscriptionStatus = balance?.subscription_status ?? "free";
  const isPremium = subscriptionStatus === "premium";

  const isLow = sparkBalance <= 5 && sparkBalance > 0;
  const isEmpty = sparkBalance === 0;

  return {
    // Raw data
    balance,
    topupPacks,
    isLoading,
    isCheckoutLoading,
    error,

    // Computed
    sparkBalance,
    lifetimeEarned,
    lifetimeSpent,
    subscriptionStatus,
    isPremium,
    isLow,
    isEmpty,

    // Actions
    reload,
    checkBalance,
    purchaseTopup,
  };
}
