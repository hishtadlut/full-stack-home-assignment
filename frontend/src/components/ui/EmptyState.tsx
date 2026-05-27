import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const EmptyState = ({ icon: Icon, title, body }: EmptyStateProps) => (
  <section className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-14 text-center">
    <Icon className="mx-auto h-10 w-10 text-zinc-400" aria-hidden="true" />
    <h2 className="mt-3 text-lg font-bold text-zinc-950">{title}</h2>
    <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600">{body}</p>
  </section>
);
