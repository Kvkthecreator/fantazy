"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { LogOut, Settings, Sparkles, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useSparks } from "@/hooks/useSparks"
import { useSubscription } from "@/hooks/useSubscription"
import { cn } from "@/lib/utils"

interface UserMenuProps {
  user: User
  collapsed?: boolean
}

export function UserMenu({ user, collapsed = false }: UserMenuProps) {
  const router = useRouter()
  const supabase = createClient()
  const { sparkBalance, isLow, isEmpty, isLoading } = useSparks()
  const { isPremium } = useSubscription()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const initial = user.email?.[0].toUpperCase() || "?"
  const displayEmail = user.email || "User"
  const truncatedEmail = displayEmail.length > 18
    ? displayEmail.slice(0, 18) + "..."
    : displayEmail

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
            title={displayEmail}
          >
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-48">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{displayEmail}</p>
            <p className={cn(
              "mt-1 text-xs font-medium",
              isPremium ? "text-amber-500" : "text-muted-foreground"
            )}>
              {isPremium ? "Premium plan" : "Free plan"}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings?tab=billing")}>
            <Sparkles className={cn(
              "h-4 w-4",
              isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-amber-500"
            )} />
            <span className="flex-1">{sparkBalance} Sparks</span>
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              isPremium ? "text-amber-500" : "text-muted-foreground"
            )}>
              {isPremium ? "Premium" : "Free"}
            </span>
            {(isLow || isEmpty) && (
              <span className="ml-auto text-xs text-muted-foreground">Low</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-muted/60 transition-colors">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{truncatedEmail}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className={cn(
                "h-3 w-3",
                isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-amber-500"
              )} />
              <span className={cn(
                isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-muted-foreground"
              )}>
                {isLoading ? "..." : sparkBalance}
              </span>
              <span className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isPremium ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
              )}>
                {isPremium ? "Premium" : "Free"}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="right"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
        className="w-56"
      >
        <DropdownMenuItem onClick={() => router.push("/settings?tab=billing")}>
          <Sparkles className={cn(
            "h-4 w-4",
            isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-amber-500"
          )} />
          <span className="flex-1">{sparkBalance} Sparks</span>
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isPremium ? "text-amber-500" : "text-muted-foreground"
          )}>
            {isPremium ? "Premium" : "Free"}
          </span>
          <span className="text-xs text-primary hover:underline">Buy</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
