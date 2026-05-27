import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { buttonStyles } from '../ui/buttonStyles';

interface TaskNotFoundProps {
  error: string | null;
}

export const TaskNotFound = ({ error }: TaskNotFoundProps) => (
  <section className="rounded-lg border border-zinc-200 bg-white px-4 py-16 text-center">
    <h1 className="text-2xl font-bold text-zinc-950">Task not found</h1>
    <p className="mt-2 text-sm text-zinc-600">{error || 'The task may have been removed.'}</p>
    <Link to="/dashboard" className={`mt-4 ${buttonStyles('primary')}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to dashboard
    </Link>
  </section>
);
