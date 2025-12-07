"use client";

/**
 * ThinkingAgentClient - Dedicated TP Page
 *
 * Desktop UI layout for Thinking Partner with floating windows.
 * Refactored to use Desktop UI architecture (chat as wallpaper + floating windows).
 *
 * Layout:
 * - Unified header with agent info + session controls
 * - Chat is always full-width (wallpaper)
 * - Floating windows overlay on top when opened
 *
 * See: /docs/implementation/DESKTOP_UI_IMPLEMENTATION_PLAN.md
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { History, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TPChatInterface } from '@/components/thinking/TPChatInterface';
import { DesktopProvider, Desktop, useDesktop } from '@/components/desktop';
import type { TPPhase, TPContextChange, WorkOutput } from '@/lib/types/thinking-partner';
import { useTPRealtimeEnhanced } from '@/hooks/useTPRealtimeEnhanced';
import { useActiveTPSession } from '@/hooks/useTPSession';
import { AGENT_CONFIG } from '../config';
import { cn } from '@/lib/utils';

interface ThinkingAgentClientProps {
  project: {
    id: string;
    name: string;
  };
  basketId: string;
  workspaceId: string;
}

export function ThinkingAgentClient({
  project,
  basketId,
  workspaceId,
}: ThinkingAgentClientProps) {
  const router = useRouter();
  const config = AGENT_CONFIG.thinking;
  const [showSessionList, setShowSessionList] = useState(false);

  // Realtime updates for header badges
  const {
    isConnected,
    activeTickets,
    pendingOutputs,
  } = useTPRealtimeEnhanced({
    basketId,
  });

  // Session management (for header controls)
  const {
    sessionId,
    session,
    sessions,
    startNewSession,
    switchSession,
  } = useActiveTPSession(basketId);

  const handleNewSession = useCallback(async () => {
    await startNewSession();
    setShowSessionList(false);
  }, [startNewSession]);

  const handleSwitchSession = useCallback((newSessionId: string) => {
    switchSession(newSessionId);
    setShowSessionList(false);
  }, [switchSession]);

  return (
    <DesktopProvider basketId={basketId}>
      <div className="relative flex h-full flex-col">
        {/* Unified Header */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          {/* Left: Agent info */}
          <div className="flex items-center gap-3">
            <config.icon className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">{config.label}</h1>
              <p className="text-xs text-muted-foreground">{project.name}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Interactive
            </Badge>
          </div>

          {/* Right: Status badges + Session controls + Actions */}
          <div className="flex items-center gap-2">
            {/* Status badges */}
            {isConnected && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
            )}
            {activeTickets.length > 0 && (
              <Badge variant="secondary">
                {activeTickets.length} Active
              </Badge>
            )}
            {pendingOutputs.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {pendingOutputs.length} Pending
              </Badge>
            )}

            {/* Separator */}
            <div className="mx-1 h-4 w-px bg-border" />

            {/* Session indicator */}
            {sessionId && (
              <span className="text-xs text-muted-foreground">
                {session?.title || `Session ${sessionId.slice(0, 8)}...`}
              </span>
            )}

            {/* Session history button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSessionList(!showSessionList)}
              className="relative"
              title="Session history"
            >
              <History className="h-4 w-4" />
              {sessions.length > 1 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {sessions.length}
                </span>
              )}
            </Button>

            {/* New session button */}
            <Button variant="ghost" size="sm" onClick={handleNewSession} title="New session">
              <Plus className="h-4 w-4" />
            </Button>

            {/* Separator */}
            <div className="mx-1 h-4 w-px bg-border" />

            {/* View All Tickets */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${project.id}/work-tickets-view`)}
            >
              View All Tickets
            </Button>
          </div>
        </header>

        {/* Session list dropdown */}
        {showSessionList && sessions.length > 0 && (
          <div className="absolute right-4 top-14 z-50 w-64 rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="text-sm font-medium">Recent Sessions</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowSessionList(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSwitchSession(s.id)}
                  className={cn(
                    'flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50',
                    s.id === sessionId && 'bg-muted'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {s.title || `Session ${s.id.slice(0, 8)}...`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.message_count} messages
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desktop UI - Chat as wallpaper with floating windows */}
        <div className="flex-1 overflow-hidden">
          <Desktop>
            <TPChatInterface
              basketId={basketId}
              workspaceId={workspaceId}
              className="h-full"
              hideHeader
            />
          </Desktop>
        </div>
      </div>
    </DesktopProvider>
  );
}

export default ThinkingAgentClient;
