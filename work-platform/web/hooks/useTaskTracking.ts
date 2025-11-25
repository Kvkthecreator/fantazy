"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Task progress update from TodoWrite tool
 */
export interface TaskUpdate {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

/**
 * SSE event from task streaming endpoint
 */
export interface TaskStreamEvent {
  type: "connected" | "todo_update" | "completed" | "timeout";
  ticket_id?: string;
  todos?: TaskUpdate[];
  status?: string;
  timestamp?: string;
  source?: string;
}

/**
 * Hook return value
 */
export interface UseTaskTrackingResult {
  tasks: TaskUpdate[];
  isConnected: boolean;
  error: string | null;
  completionStatus: string | null;
}

/**
 * Real-time Task Tracking Hook
 *
 * Subscribes to SSE stream for agent task progress updates (TodoWrite tool).
 * Displays real-time visibility into what the agent is doing during execution.
 *
 * Usage:
 * ```tsx
 * const { tasks, isConnected, error } = useTaskTracking(workTicketId);
 *
 * return (
 *   <div>
 *     {tasks.map((task, i) => (
 *       <div key={i}>
 *         {task.status === "in_progress" && "🔄"}
 *         {task.status === "completed" && "✅"}
 *         {task.status === "pending" && "⏳"}
 *         {task.activeForm}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @param workTicketId - Work ticket UUID to track
 * @param enabled - Whether to enable the SSE connection (default: true)
 */
export function useTaskTracking(
  workTicketId: string | null | undefined,
  enabled: boolean = true
): UseTaskTrackingResult {
  const [tasks, setTasks] = useState<TaskUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    // Skip if not enabled or no ticket ID
    if (!enabled || !workTicketId) {
      disconnect();
      return;
    }

    // Create SSE connection
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://yarnnn-app-fullstack.onrender.com";
    const eventSource = new EventSource(`${apiUrl}/api/work/tickets/${workTicketId}/stream`, {
      withCredentials: true,
    });

    eventSourceRef.current = eventSource;

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data: TaskStreamEvent = JSON.parse(event.data);

        if (data.type === "connected") {
          setIsConnected(true);
          setError(null);
        } else if (data.type === "todo_update" && data.todos) {
          setTasks(data.todos);
        } else if (data.type === "completed") {
          setCompletionStatus(data.status || "completed");
          disconnect();
        } else if (data.type === "timeout") {
          setError("Stream timeout - task may still be running");
          disconnect();
        }
      } catch (err) {
        console.error("[useTaskTracking] Failed to parse SSE event:", err);
        setError("Failed to parse task update");
      }
    };

    // Handle errors
    eventSource.onerror = (err) => {
      console.error("[useTaskTracking] SSE error:", err);
      setError("Connection error - retrying...");
      setIsConnected(false);
      // EventSource will automatically retry connection
    };

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [workTicketId, enabled, disconnect]);

  return {
    tasks,
    isConnected,
    error,
    completionStatus,
  };
}
