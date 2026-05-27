export const LoadingState = ({ label }: { label: string }) => (
  <div role="status" className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center text-sm font-medium text-zinc-600">
    {label}
  </div>
);
