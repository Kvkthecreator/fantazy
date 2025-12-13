"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionCard } from "@/components/subscription";
import { UsageMeter } from "@/components/usage";
import { useUser } from "@/hooks/useUser";
import { useUsage } from "@/hooks/useUsage";
import { CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { reload } = useUser();
  const { reload: reloadUsage } = useUsage();
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle success redirect from Lemon Squeezy
  useEffect(() => {
    const subscription = searchParams.get("subscription");
    if (subscription === "success") {
      setShowSuccess(true);
      // Reload user data to get updated subscription status
      reload();
      // Reload usage data (quota resets on subscription change)
      reloadUsage();
      // Clear the URL param without reload
      window.history.replaceState({}, "", "/settings");
      // Hide success message after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, reload, reloadUsage]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      {/* Success Banner */}
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

      {/* Usage Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>
              Track your image generation usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMeter />
          </CardContent>
        </Card>
      </section>

      {/* Subscription Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage your Fantazy subscription plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubscriptionCard />
          </CardContent>
        </Card>
      </section>

      {/* Account Section - placeholder for future */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Account management coming soon.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
