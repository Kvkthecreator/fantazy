"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error("DropdownMenu components must be used within a DropdownMenu")
  }
  return context
}

interface DropdownMenuProps {
  children: React.ReactNode
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close on click outside (check both container and portal content)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      // Check if click is inside the container or any dropdown-portal content
      const portalContent = document.querySelector('[data-dropdown-portal]')
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!portalContent || !portalContent.contains(target))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  asChild?: boolean
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ className, children, asChild, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdownMenu()
    const internalRef = React.useRef<HTMLButtonElement>(null)

    // Combine refs and store in context
    React.useEffect(() => {
      const element = internalRef.current
      if (element) {
        triggerRef.current = element
      }
    })

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: (node: HTMLElement) => {
          internalRef.current = node as HTMLButtonElement
          triggerRef.current = node
          if (typeof ref === 'function') ref(node as HTMLButtonElement)
          else if (ref) ref.current = node as HTMLButtonElement
        },
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          setOpen(!open)
        },
        "aria-expanded": open,
      })
    }

    return (
      <button
        ref={(node) => {
          internalRef.current = node
          triggerRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="button"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        aria-expanded={open}
        {...props}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "bottom"
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, children, align = "end", side = "bottom", ...props }, ref) => {
    const { open, triggerRef } = useDropdownMenu()
    const [position, setPosition] = React.useState({ top: 0, left: 0 })
    const [mounted, setMounted] = React.useState(false)
    const contentRef = React.useRef<HTMLDivElement>(null)

    // Handle SSR - only render portal on client
    React.useEffect(() => {
      setMounted(true)
    }, [])

    // Calculate position based on trigger element
    React.useEffect(() => {
      if (!open || !triggerRef.current) return

      const updatePosition = () => {
        const trigger = triggerRef.current
        if (!trigger) return

        const rect = trigger.getBoundingClientRect()
        const contentEl = contentRef.current
        const contentWidth = contentEl?.offsetWidth || 180
        const contentHeight = contentEl?.offsetHeight || 100

        let top: number
        let left: number

        // Calculate vertical position
        if (side === "bottom") {
          top = rect.bottom + 8 // 8px gap
        } else {
          top = rect.top - contentHeight - 8
        }

        // Calculate horizontal position
        if (align === "end") {
          left = rect.right - contentWidth
        } else if (align === "center") {
          left = rect.left + (rect.width / 2) - (contentWidth / 2)
        } else {
          left = rect.left
        }

        // Ensure dropdown stays within viewport
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Prevent going off right edge
        if (left + contentWidth > viewportWidth - 8) {
          left = viewportWidth - contentWidth - 8
        }
        // Prevent going off left edge
        if (left < 8) {
          left = 8
        }
        // Flip to top if going off bottom
        if (top + contentHeight > viewportHeight - 8 && side === "bottom") {
          top = rect.top - contentHeight - 8
        }
        // Flip to bottom if going off top
        if (top < 8 && side === "top") {
          top = rect.bottom + 8
        }

        setPosition({ top, left })
      }

      updatePosition()

      // Recalculate on scroll/resize
      window.addEventListener("scroll", updatePosition, true)
      window.addEventListener("resize", updatePosition)

      return () => {
        window.removeEventListener("scroll", updatePosition, true)
        window.removeEventListener("resize", updatePosition)
      }
    }, [open, triggerRef, align, side])

    if (!open || !mounted) return null

    return createPortal(
      <div
        ref={(node) => {
          contentRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        data-dropdown-portal
        className={cn(
          "fixed z-[9999] min-w-[180px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownMenu()

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground",
          "hover:bg-muted focus:bg-muted focus:outline-none transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        onClick={(e) => {
          onClick?.(e)
          setOpen(false)
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
