'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ImmersiveLayoutWrapperProps {
  children: ReactNode
  sidebar: ReactNode
}

/**
 * Layout wrapper that detects immersive routes (like chat) and adapts the layout accordingly.
 * - Normal routes: Standard dashboard layout with max-width container and padding
 * - Immersive routes: Full-bleed layout with floating glass sidebar
 */
export function ImmersiveLayoutWrapper({ children, sidebar }: ImmersiveLayoutWrapperProps) {
  const pathname = usePathname()

  // Routes that should use immersive full-bleed layout
  const isImmersive = pathname.startsWith('/chat/')

  if (isImmersive) {
    return (
      <div className="relative flex min-h-screen bg-background text-foreground">
        {/* Sidebar with glass effect in immersive mode */}
        <div className="relative z-20">
          {sidebar}
        </div>
        {/* Full-bleed main content */}
        <main className="flex-1 relative">
          {children}
        </main>
      </div>
    )
  }

  // Standard dashboard layout
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {sidebar}
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-8">{children}</div>
      </main>
    </div>
  )
}
