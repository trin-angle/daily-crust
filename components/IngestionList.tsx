import type { Task } from "@/lib/types";

interface IngestionListProps {
  tasks: Task[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function IngestionList({ tasks }: IngestionListProps) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text-secondary mb-3">
        Active Ingestions
      </h2>
      {tasks.length === 0 ? (
        <div className="bg-surface-card rounded-card p-6 text-center text-text-secondary text-sm">
          No active ingestions
        </div>
      ) : (
        <div className="bg-surface-card rounded-card divide-y divide-surface-base">
          {tasks.map((task) => (
            <div key={task.taskId} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-hover transition-colors">
              <span className="text-sm font-medium text-text-primary w-32 truncate">
                {task.datasource}
              </span>
              <div className="flex-1 h-2 bg-surface-base rounded-full overflow-hidden">
                <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${task.progressPercent}%` }} />
              </div>
              <span className="text-sm font-medium text-text-primary w-10 text-right">
                {task.progressPercent}%
              </span>
              <span className="text-xs text-text-secondary w-16 text-right">
                {formatDuration(task.duration)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
