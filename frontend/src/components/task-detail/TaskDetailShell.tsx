import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AssistantPanel } from '../AssistantPanel';
import { buttonStyles } from '../ui/buttonStyles';

interface TaskDetailShellProps {
  children: ReactNode;
  onTasksChanged: () => Promise<void> | void;
}

export const TaskDetailShell = ({ children, onTasksChanged }: TaskDetailShellProps) => (
  <div className="min-h-screen bg-zinc-50 text-zinc-950">
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-cyan-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
        <Link to="/assistant" className={buttonStyles('cyan')}>
          Open assistant
        </Link>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    <AssistantPanel onTasksChanged={onTasksChanged} />
  </div>
);
