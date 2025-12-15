"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionCard } from "@/components/subscription";
import { SparkBalance, TopupPacks } from "@/components/sparks";
import { useUser } from "@/hooks/useUser";
import { useSparks } from "@/hooks/useSparks";
import { CheckCircle2, Sparkles, CreditCard, User } from "lucide-react";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { reload } = useUser();
  const { reload: reloadSparks, sparkBalance, lifetimeEarned, lifetimeSpent } = useSparks();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTopupSuccess, setShowTopupSuccess] = useState(false);

  // Get initial tab from URL
  const initialTab = searchParams.get("tab") || "subscription";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.replace(`/settings?tab=${value}`, { scroll: false });
  };

  // Handle success redirect from Lemon Squeezy
  useEffect(() => {
    const subscription = searchParams.get("subscription");
    const topup = searchParams.get("topup");

    if (subscription === "success") {
      setShowSuccess(true);
      reload();
      reloadSparks();
      window.history.replaceState({}, "", "/settings?tab=subscription");
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }

    if (topup === "success") {
      setShowTopupSuccess(true);
      setActiveTab("sparks");
      reloadSparks();
      window.history.replaceState({}, "", "/settings?tab=sparks");
      const timer = setTimeout(() => setShowTopupSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, reload, reloadSparks]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, subscription, and Sparks</p>
      </div>

      {/* Success Banners */}
      {showSuccess && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">
                Welcome to Fantazy Premium!
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                Your subscription is now active. Enjoy unlimited chat and AI scene generation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showTopupSuccess && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Sparks Added!
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Your Spark pack has been credited to your account.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="sparks" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Sparks
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                Manage your Fantazy subscription plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionCard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sparks Tab */}
        <TabsContent value="sparks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Your Spark Balance
              </CardTitle>
              <CardDescription>
                Sparks are used for premium features like AI image generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-amber-500" />
                    <span className="text-3xl font-bold">{sparkBalance}</span>
                    <span className="text-muted-foreground">Sparks</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">Lifetime Stats</p>
                  <p className="text-sm">
                    <span className="text-green-500">+{lifetimeEarned}</span> earned
                    {" / "}
                    <span className="text-red-400">-{lifetimeSpent}</span> spent
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">What costs Sparks?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-20 font-medium text-foreground">1 Spark</span>
                    AI Image Generation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-20 font-medium text-foreground">FREE</span>
                    Chat messages (unlimited)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get More Sparks</CardTitle>
              <CardDescription>
                Purchase Spark packs to unlock more premium features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopupPacks />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Account management coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
