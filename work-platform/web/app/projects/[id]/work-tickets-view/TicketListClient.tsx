"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { WorkTicketCard } from "@/components/WorkTicketCard";

interface Ticket {
  id: string;
  status: string;
  agent_type: string;
  created_at: string;
  completed_at?: string;
  metadata?: any;
  work_outputs?: any[];
}

interface TicketListClientProps {
  initialTickets: Ticket[];
  basketId: string;
  projectId: string;
}

export function TicketListClient({ initialTickets, basketId, projectId }: TicketListClientProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);

  // Create Supabase client for Realtime
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Subscribe to real-time ticket updates
  useEffect(() => {
    const channel = supabase
      .channel(`basket_tickets_${basketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'work_tickets',
          filter: `basket_id=eq.${basketId}`,
        },
        (payload) => {
          console.log('[Realtime] Ticket updated:', payload.new);
          setTickets((prev) =>
            prev.map((t) => (t.id === payload.new.id ? { ...t, ...(payload.new as any) } : t))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'work_tickets',
          filter: `basket_id=eq.${basketId}`,
        },
        (payload) => {
          console.log('[Realtime] New ticket:', payload.new);
          setTickets((prev) => [payload.new as any, ...prev]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [basketId, supabase]);

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <WorkTicketCard key={ticket.id} ticket={ticket} projectId={projectId} />
      ))}
    </div>
  );
}
