'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { BookOpen, Compass, Heart, Images, LayoutDashboard, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { UserMenu } from "@/components/UserMenu"
import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Discover", href: "/discover", icon: Compass },
  { name: "My Series", href: "/dashboard/series", icon: BookOpen },
  { name: "My Chats", href: "/dashboard/chats", icon: MessageCircle },
  { name: "Our Story", href: "/dashboard/story", icon: Images },
  { name: "Memories", href: "/dashboard/memories", icon: Heart },
]

export function Sidebar({ user, variant = "default" }: { user: User; variant?: "default" | "immersive" }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Persist collapsed state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored !== null) {
      setIsCollapsed(stored === "true")
    } else if (variant === "immersive") {
      setIsCollapsed(true)
      localStorage.setItem("sidebar-collapsed", "true")
    }
  }, [variant])

  const toggleCollapsed = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem("sidebar-collapsed", String(newValue))
  }

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r border-border transition-all duration-300",
        isCollapsed ? "w-[56px]" : "w-72",
        variant === "immersive" && "hidden md:flex md:h-[100dvh] md:border-white/10 md:bg-black/20 md:backdrop-blur-xl"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-border py-5",
        isCollapsed ? "justify-center px-3" : "justify-between px-6"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden p-1.5">
            <Logo variant="icon" size="full" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold leading-tight text-foreground">
                episode-0
              </h1>
              <p className="text-xs text-muted-foreground">3, 2, 1... action</p>
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
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!isCollapsed && item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Menu (includes sparks, settings, sign out) */}
      <div className={cn(
        "border-t border-border py-3",
        isCollapsed ? "px-2 flex justify-center" : "px-3"
      )}>
        <UserMenu user={user} collapsed={isCollapsed} />
      </div>
    </aside>
  )
}
