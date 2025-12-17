'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Compass, Heart, Images, LayoutDashboard, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { UserMenu } from "@/components/UserMenu"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Discover", href: "/discover", icon: Compass },
  { name: "My Chats", href: "/dashboard/chats", icon: MessageCircle },
  { name: "Our Story", href: "/dashboard/story", icon: Images },
  { name: "Memories", href: "/dashboard/memories", icon: Heart },
]

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Detect if we're in an immersive route (like chat)
  const isImmersive = pathname.startsWith('/chat/')

  // Persist collapsed state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored !== null) {
      setIsCollapsed(stored === "true")
    }
  }, [])

  const toggleCollapsed = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem("sidebar-collapsed", String(newValue))
  }

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-72",
        isImmersive
          ? "bg-black/40 backdrop-blur-xl backdrop-saturate-150 border-r border-white/10"
          : "bg-card/60 backdrop-blur border-r border-border"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleCollapsed}
        className={cn(
          "absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full",
          "shadow-sm transition-colors",
          isImmersive
            ? "border border-white/20 bg-black/50 hover:bg-black/70"
            : "border border-border bg-background hover:bg-muted"
        )}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className={cn("h-3.5 w-3.5", isImmersive ? "text-white/70" : "text-muted-foreground")} />
        ) : (
          <ChevronLeft className={cn("h-3.5 w-3.5", isImmersive ? "text-white/70" : "text-muted-foreground")} />
        )}
      </button>

      {/* Header */}
      <div className={cn(
        "flex items-center py-5",
        isCollapsed ? "justify-center px-3" : "justify-between px-6",
        isImmersive ? "border-b border-white/10" : "border-b border-border"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm shrink-0 overflow-hidden",
            isImmersive
              ? "border border-white/20 bg-white/10"
              : "border border-border/60 bg-muted/60"
          )}>
            <img
              src="/branding/ep0-mark.svg"
              alt="ep-0"
              className="h-full w-full object-cover"
            />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className={cn(
                "text-xl font-bold leading-tight",
                isImmersive ? "text-white" : "text-foreground"
              )}>
                episode-0
              </h1>
              <p className={cn(
                "text-xs",
                isImmersive ? "text-white/60" : "text-muted-foreground"
              )}>Interactive episodes</p>
            </div>
          )}
        </Link>
        {!isCollapsed && <ModeToggle />}
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-1 py-4",
        isCollapsed ? "px-2" : "px-4"
      )}>
        {navigation.map((item) => {
          const isExactMatch = pathname === item.href
          // Only treat nested routes as active for non-root items to avoid double-highlighting Dashboard on subpages.
          const isNested = item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)
          const isActive = isExactMatch || isNested
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "group flex items-center rounded-xl text-sm font-medium transition-colors",
                isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                isImmersive
                  ? isActive
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  : isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isImmersive
                    ? isActive ? "text-white" : "text-white/70 group-hover:text-white"
                    : isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!isCollapsed && item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Menu (includes sparks, settings, sign out) */}
      <div className={cn(
        "py-3",
        isCollapsed ? "px-2 flex justify-center" : "px-3",
        isImmersive ? "border-t border-white/10" : "border-t border-border"
      )}>
        <UserMenu user={user} collapsed={isCollapsed} />
      </div>
    </aside>
  )
}
