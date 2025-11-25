/**
 * Live Work Ticket Tracking Page
 *
 * Shows real-time execution progress for a work ticket:
 * - Ticket metadata (recipe, parameters, agent)
 * - Real-time status updates (Supabase Realtime)
 * - TodoWrite task progress (SSE)
 * - Output preview when completed
 * - Actions (view output, retry, download)
 */

import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import { getAuthenticatedUser } from "@/lib/auth/getAuthenticatedUser";
import { notFound } from "next/navigation";
import TicketTrackingClient from "./TicketTrackingClient";

interface PageProps {
  params: Promise<{ id: string; ticketId: string }>;
}

export default async function TicketTrackingPage({ params }: PageProps) {
  const { id: projectId, ticketId } = await params;

  const supabase = createServerComponentClient({ cookies });
  const { userId } = await getAuthenticatedUser(supabase);

  // Fetch project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, basket_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  // Fetch work ticket with outputs
  const { data: ticket } = await supabase
    .from('work_tickets')
    .select(`
      id,
      status,
      agent_type,
      created_at,
      started_at,
      completed_at,
      error_message,
      metadata,
      basket_id,
      work_outputs (
        id,
        title,
        body,
        output_type,
        agent_type,
        file_id,
        file_format,
        generation_method,
        created_at
      )
    `)
    .eq('id', ticketId)
    .eq('basket_id', project.basket_id)
    .maybeSingle();

  if (!ticket) {
    notFound();
  }

  // Extract recipe info from metadata
  const recipeName = ticket.metadata?.recipe_slug || 'Work Request';
  const recipeParams = ticket.metadata?.recipe_parameters || {};
  const taskDescription = ticket.metadata?.task_description || '';

  return (
    <TicketTrackingClient
      projectId={projectId}
      projectName={project.name}
      ticket={ticket}
      recipeName={recipeName}
      recipeParams={recipeParams}
      taskDescription={taskDescription}
    />
  );
}
