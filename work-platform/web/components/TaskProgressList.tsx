"use client";

import { useTaskTracking } from "@/hooks/useTaskTracking";
import type { TaskUpdate } from "@/hooks/useTaskTracking";

interface TaskProgressListProps {
  workTicketId: string | null | undefined;
  enabled?: boolean;
  className?: string;
}

/**
 * Task Progress List Component
 *
 * Displays real-time agent task progress using SSE streaming.
 * Shows TodoWrite updates from the agent execution (like Claude Code).
 *
 * Usage:
 * ```tsx
 * <TaskProgressList workTicketId={ticketId} />
 * ```
 */
export function TaskProgressList({
  workTicketId,
  enabled = true,
  className = "",
}: TaskProgressListProps) {
  const { tasks, isConnected, error, completionStatus } = useTaskTracking(
    workTicketId,
    enabled
  );

  // Don't render if no ticket ID
  if (!workTicketId) {
    return null;
  }

  return (
    <div className={`task-progress-list ${className}`}>
      {/* Connection status */}
      {isConnected && (
        <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Connected
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-xs text-red-500 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
          {error}
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task, index) => (
            <TaskItem key={index} task={task} index={index} />
          ))}
        </div>
      )}

      {/* Completion status */}
      {completionStatus && (
        <div className="text-xs text-gray-500 mt-2">
          {completionStatus === "completed" ? "✅" : "❌"} Task {completionStatus}
        </div>
      )}

      {/* Empty state (while connected but no tasks yet) */}
      {isConnected && tasks.length === 0 && !completionStatus && (
        <div className="text-xs text-gray-400 italic">
          Agent is working...
        </div>
      )}
    </div>
  );
}

interface TaskItemProps {
  task: TaskUpdate;
  index: number;
}

function TaskItem({ task, index }: TaskItemProps) {
  const statusIcon = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
  }[task.status];

  const statusColor = {
    pending: "text-gray-400",
    in_progress: "text-blue-500",
    completed: "text-green-600",
  }[task.status];

  return (
    <div className={`flex items-start gap-2 text-sm ${statusColor}`}>
      <span className="flex-shrink-0 text-base">{statusIcon}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate" title={task.activeForm}>
          {task.activeForm}
        </p>
      </div>
    </div>
  );
}

/**
 * Compact inline task progress (for headers/status bars)
 */
export function TaskProgressInline({
  workTicketId,
  enabled = true,
}: {
  workTicketId: string | null | undefined;
  enabled?: boolean;
}) {
  const { tasks, isConnected } = useTaskTracking(workTicketId, enabled);

  if (!workTicketId || tasks.length === 0) {
    return null;
  }

  const currentTask = tasks.find((t) => t.status === "in_progress") || tasks[tasks.length - 1];
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {isConnected && (
        <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      )}
      <span className="truncate max-w-xs" title={currentTask?.activeForm}>
        {currentTask?.activeForm}
      </span>
      <span className="text-gray-400">
        ({completedCount}/{tasks.length})
      </span>
    </div>
  );
}
