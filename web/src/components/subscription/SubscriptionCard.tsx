"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";

const PREMIUM_FEATURES = [
  "Unlimited AI companion chat",
  "100 Sparks per month for AI scenes",
  "Priority response times",
  "Early access to new features",
];

const FREE_FEATURES = [
  "Basic chat with companions",
  "5 Sparks to start",
  "Pre-generated scene library",
];

export function SubscriptionCard() {
  const { isPremium, expiresAt, upgrade, manageSubscription, isLoading } = useSubscription();

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isPremium) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
          <CardTitle>ep-0 Premium</CardTitle>
            </div>
            <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0">
              Active
            </Badge>
          </div>
          <CardDescription>
            {expiresAt && `Renews on ${formatDate(expiresAt)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="w-full"
            onClick={manageSubscription}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Free Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Free</CardTitle>
          <CardDescription>Get started with ep-0</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">$0</div>
          <ul className="space-y-2">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        </CardContent>
      </Card>

      {/* Premium Plan */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
          Recommended
        </div>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Premium</CardTitle>
          </div>
          <CardDescription>Unlock the full experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">$19.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-2">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
            onClick={upgrade}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
