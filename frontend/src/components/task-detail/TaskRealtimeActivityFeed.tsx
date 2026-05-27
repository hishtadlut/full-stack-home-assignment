import type { TaskRealtimeNotification } from '../../hooks/useTaskRealtime';
import { formatShortDateTime } from '../../utils/taskFormatting';

interface TaskRealtimeActivityFeedProps {
  notifications: TaskRealtimeNotification[];
}

export const TaskRealtimeActivityFeed = ({ notifications }: TaskRealtimeActivityFeedProps) => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4" aria-labelledby="realtime-updates-title">
      <h2 id="realtime-updates-title" className="text-sm font-bold text-cyan-950">Live activity</h2>
      <ul className="mt-3 grid gap-2">
        {notifications.map((notification) => (
          <li key={notification.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-cyan-950">{notification.message}</span>
            <time className="text-xs font-medium text-cyan-800" dateTime={notification.occurredAt}>
              {formatShortDateTime(notification.occurredAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
};
