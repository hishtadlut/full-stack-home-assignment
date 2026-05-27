import { CheckCircle2, Circle, ClipboardList, ListFilter } from 'lucide-react';

interface TaskStats {
  open: number;
  inProgress: number;
  done: number;
  highPriority: number;
}

export const TaskMetrics = ({ stats }: { stats: TaskStats }) => (
  <section aria-label="Task metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Metric label="Open tasks" value={stats.open} tone="cyan" icon={ClipboardList} />
    <Metric label="In progress" value={stats.inProgress} tone="amber" icon={Circle} />
    <Metric label="Done" value={stats.done} tone="emerald" icon={CheckCircle2} />
    <Metric label="High priority" value={stats.highPriority} tone="rose" icon={ListFilter} />
  </section>
);

interface MetricProps {
  label: string;
  value: number;
  tone: 'cyan' | 'amber' | 'emerald' | 'rose';
  icon: typeof ClipboardList;
}

const Metric = ({ label, value, tone, icon: Icon }: MetricProps) => {
  const toneClass = {
    cyan: 'bg-cyan-50 text-cyan-800 border-cyan-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    rose: 'bg-rose-50 text-rose-800 border-rose-100',
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-normal">{value}</p>
    </div>
  );
};
