"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionCard } from "@/components/subscription";
import { TopupPacks, TransactionHistory } from "@/components/sparks";
import { useUser } from "@/hooks/useUser";
import { useSparks } from "@/hooks/useSparks";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api/client";
import { CheckCircle2, Sparkles, CreditCard, User, Mail, Clock, Loader2, History, Settings2, Image, AlertCircle, HelpCircle, ExternalLink, Trash2 } from "lucide-react";

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

  // Visual preferences
  const [visualModeOverride, setVisualModeOverride] = useState<string>("episode_default");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSaveSuccess, setPrefsSaveSuccess] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Sync visual preferences from user data
  useEffect(() => {
    if (user?.preferences) {
      const visualOverride = (user.preferences.visual_mode_override as string) || "episode_default";
      setVisualModeOverride(visualOverride);
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

  const handleVisualModeChange = async (value: string) => {
    setIsSavingPrefs(true);
    setPrefsSaveSuccess(false);
    try {
      await updateUser({
        preferences: {
          ...user?.preferences,
          visual_mode_override: value as "always_off" | "always_on" | "episode_default",
        },
      });
      setVisualModeOverride(value);
      setPrefsSaveSuccess(true);
      setTimeout(() => setPrefsSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save visual preferences:", err);
      // Reload user data on error to reset to server state
      await reload();
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Please type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.users.deleteAccount("DELETE", deleteReason || undefined);

      // Sign out and redirect to home
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("Failed to delete account:", err);
      setDeleteError("Failed to delete account. Please try again or contact support.");
      setIsDeleting(false);
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
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Help
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

          {/* Danger Zone */}
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Delete Account
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data.
                      This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteModal(true)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          {/* Visual Experience */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-muted-foreground" />
                Visual Experience
              </CardTitle>
              <CardDescription>
                Control how images appear during episodes (experimental)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-Generated Images Setting */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="visual-mode" className="text-base font-medium">
                    Auto-generated images
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Control when images are automatically generated during episodes.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={visualModeOverride}
                    onValueChange={handleVisualModeChange}
                    disabled={isSavingPrefs}
                  >
                    <SelectTrigger id="visual-mode" className="w-full max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="episode_default">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">Off (Default)</span>
                          <span className="text-xs text-muted-foreground">No auto-generation, manual only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="always_on">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">Enabled (Experimental)</span>
                          <span className="text-xs text-muted-foreground">Auto-generate at 25%, 50%, 75%</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isSavingPrefs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {prefsSaveSuccess && (
                    <span className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                </div>
              </div>

              {/* Warning Banner */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Experimental Feature
                    </p>
                    <div className="text-sm text-amber-600 dark:text-amber-500 space-y-1">
                      <p>
                        <strong>Generation time:</strong> 5-10 seconds per image (may pause conversation flow)
                      </p>
                      <p>
                        <strong>Quality:</strong> Improving but not yet consistent. Some images may not match the moment well.
                      </p>
                      <p className="mt-2">
                        <strong>Alternative:</strong> Manual "Capture Moment" generation (1 Spark) offers higher quality with more control.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info about defaults */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Default behavior:</strong> Auto-generation is disabled for all episodes. This setting applies globally to all characters and episodes when enabled.
                </p>
                <p>
                  <strong>Manual generation:</strong> Always available regardless of this setting. Use the "Capture Moment" button during chat to generate high-quality images on demand.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Help Tab */}
        <TabsContent value="help" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                Contact Us
              </CardTitle>
              <CardDescription>
                Have questions, feedback, or need help? We'd love to hear from you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use our contact form to reach our team. We typically respond within 24-48 hours.
              </p>
              <Button asChild>
                <a
                  href="https://tally.so/r/kd9Xgj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  Open Contact Form
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning */}
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm space-y-2">
              <p className="font-medium text-red-700 dark:text-red-400">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-red-600 dark:text-red-500 space-y-1">
                <li>Your account and profile</li>
                <li>All chat history and messages</li>
                <li>All memories and saved moments</li>
                <li>Your Spark balance and transaction history</li>
                <li>Any active subscription (will be cancelled)</li>
              </ul>
            </div>

            {/* Reason (optional) */}
            <div className="space-y-2">
              <Label htmlFor="delete-reason" className="text-muted-foreground">
                Why are you leaving? (optional)
              </Label>
              <Select value={deleteReason} onValueChange={setDeleteReason}>
                <SelectTrigger id="delete-reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_using">Not using the app anymore</SelectItem>
                  <SelectItem value="found_alternative">Found an alternative</SelectItem>
                  <SelectItem value="privacy">Privacy concerns</SelectItem>
                  <SelectItem value="too_expensive">Too expensive</SelectItem>
                  <SelectItem value="not_satisfied">Not satisfied with the experience</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                type="text"
                placeholder="Type DELETE"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Error message */}
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation("");
                setDeleteReason("");
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
