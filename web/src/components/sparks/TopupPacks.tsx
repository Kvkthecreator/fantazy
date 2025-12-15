"use client";

import { Sparkles, Zap, Crown, Loader2 } from "lucide-react";
import { useSparks } from "@/hooks/useSparks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PACK_ICONS: Record<string, typeof Sparkles> = {
  starter: Sparkles,
  popular: Zap,
  best_value: Crown,
};

export function TopupPacks() {
  const { topupPacks, purchaseTopup, isCheckoutLoading } = useSparks();

  if (!topupPacks.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Spark packs coming soon!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {topupPacks.map((pack) => {
        const Icon = PACK_ICONS[pack.pack_name] || Sparkles;
        const isPopular = pack.pack_name === "popular";
        const isBestValue = pack.pack_name === "best_value";

        return (
          <Card
            key={pack.pack_name}
            className={cn(
              "relative overflow-hidden transition-all hover:shadow-lg",
              isPopular && "border-purple-500 shadow-purple-500/20",
              isBestValue && "border-amber-500 shadow-amber-500/20"
            )}
          >
            {isPopular && (
              <Badge className="absolute top-2 right-2 bg-purple-500">
                Most Popular
              </Badge>
            )}
            {isBestValue && (
              <Badge className="absolute top-2 right-2 bg-amber-500">
                Best Value
              </Badge>
            )}

            <CardHeader className="text-center pb-2">
              <Icon
                className={cn(
                  "h-8 w-8 mx-auto mb-2",
                  isPopular
                    ? "text-purple-500"
                    : isBestValue
                    ? "text-amber-500"
                    : "text-muted-foreground"
                )}
              />
              <CardTitle className="capitalize">
                {pack.pack_name.replace("_", " ")}
              </CardTitle>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <div>
                <span className="text-4xl font-bold">{pack.sparks}</span>
                <span className="text-muted-foreground ml-1">Sparks</span>
              </div>

              {pack.bonus_percent > 0 && (
                <Badge variant="secondary" className="text-green-600">
                  +{pack.bonus_percent}% bonus
                </Badge>
              )}

              <div className="text-sm text-muted-foreground">
                ${(pack.per_spark_cents / 100).toFixed(2)} per Spark
              </div>

              <Button
                className="w-full"
                variant={isPopular ? "default" : "outline"}
                onClick={() => purchaseTopup(pack.pack_name)}
                disabled={isCheckoutLoading}
              >
                {isCheckoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  pack.price_display
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
