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
        "relative flex shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-72"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleCollapsed}
        className={cn(
          "absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full",
          "border border-border bg-background shadow-sm hover:bg-muted transition-colors"
        )}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 text-white text-lg shrink-0">
            F
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold leading-tight bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                Fantazy
              </h1>
              <p className="text-xs text-muted-foreground">Cozy Companions</p>
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
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
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
