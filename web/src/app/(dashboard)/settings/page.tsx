"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubscriptionCard } from "@/components/subscription";
import { TopupPacks, TransactionHistory } from "@/components/sparks";
import { useUser } from "@/hooks/useUser";
import { useSparks } from "@/hooks/useSparks";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Sparkles, CreditCard, User, Mail, Clock, Loader2, History } from "lucide-react";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, reload, updateUser, isLoading: userLoading } = useUser();
  const { reload: reloadSparks, sparkBalance, lifetimeEarned, lifetimeSpent } = useSparks();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTopupSuccess, setShowTopupSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Get email from Supabase auth
  useEffect(() => {
    async function getEmail() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setEmail(authUser?.email || null);
    }
    getEmail();
  }, []);

  // Sync display name from user data
  useEffect(() => {
    if (user?.display_name) {
      setDisplayName(user.display_name);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateUser({ display_name: displayName || undefined });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get initial tab from URL (support legacy "subscription" and "sparks" params)
  const urlTab = searchParams.get("tab");
  const initialTab = urlTab === "sparks" || urlTab === "subscription" ? "billing" : (urlTab || "billing");
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "sparks" || tab === "subscription") {
      setActiveTab("billing");
    } else if (tab && tab !== activeTab) {
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
      window.history.replaceState({}, "", "/settings?tab=billing");
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }

    if (topup === "success") {
      setShowTopupSuccess(true);
      reloadSparks();
      window.history.replaceState({}, "", "/settings?tab=billing");
      const timer = setTimeout(() => setShowTopupSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, reload, reloadSparks]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and billing</p>
      </div>

      {/* Success Banners */}
      {showSuccess && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">
                Welcome to ep-0 Premium!
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                Your subscription is now active. 100 Sparks have been added to your account.
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
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          {/* Spark Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Your Sparks
              </CardTitle>
              <CardDescription>
                Sparks are used for AI image generation (1 Spark = 1 image)
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                  <p className="text-sm text-muted-foreground">Lifetime</p>
                  <p className="text-sm">
                    <span className="text-green-500">+{lifetimeEarned}</span> earned
                    {" / "}
                    <span className="text-red-400">-{lifetimeSpent}</span> spent
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Your Plan</CardTitle>
              <CardDescription>
                Premium members get 100 Sparks per month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionCard />
            </CardContent>
          </Card>

          {/* Top-up Packs */}
          <Card>
            <CardHeader>
              <CardTitle>Buy More Sparks</CardTitle>
              <CardDescription>
                One-time purchase, no subscription required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopupPacks />
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Your recent spark activity and purchases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionHistory />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Profile
              </CardTitle>
              <CardDescription>
                Your public profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Enter your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
                {saveSuccess && (
                  <span className="text-sm text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member since</span>
                <span>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subscription</span>
                <span className="capitalize">
                  {user?.subscription_status || "Free"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Timezone</span>
                <span>{user?.timezone || "Auto"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
