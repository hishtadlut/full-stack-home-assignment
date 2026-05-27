import { Link } from 'react-router-dom';
import { Bot, Columns3, LayoutDashboard, LogOut, Plus, Table2 } from 'lucide-react';
import { buttonStyles } from '../ui/buttonStyles';
import type { User } from '../../types';
import type { DashboardView } from '../../hooks/useTaskFilters';

const dashboardViews: Array<{ id: DashboardView; label: string; icon: typeof Columns3 }> = [
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'table', label: 'Table', icon: Table2 },
];

interface DashboardHeaderProps {
  user: User | null;
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onNewTask: () => void;
  onLogout: () => void;
}

export const DashboardHeader = ({
  user,
  view,
  onViewChange,
  onNewTask,
  onLogout,
}: DashboardHeaderProps) => (
  <header className="border-b border-zinc-200 bg-white">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Team task command center
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-zinc-950">Dashboard</h1>
          {user && (
            <p className="mt-1 text-sm text-zinc-600">
              Welcome, {user.name || user.username}!
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/assistant" className={buttonStyles('cyan')}>
            <Bot className="h-4 w-4" aria-hidden="true" />
            Assistant
          </Link>
          <button type="button" onClick={onNewTask} className={buttonStyles('primary')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Task
          </button>
          <button type="button" onClick={onLogout} className={buttonStyles('secondary')}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>

      <nav aria-label="Dashboard views" className="flex flex-wrap gap-2">
        {dashboardViews.map((item) => {
          const Icon = item.icon;
          const selected = view === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-semibold transition ${
                selected
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  </header>
);
