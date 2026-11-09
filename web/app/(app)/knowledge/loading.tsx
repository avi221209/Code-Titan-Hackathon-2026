import { Skeleton } from '@/components/ui/skeleton';

export default function KnowledgeLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-8"
    >
      <span className="sr-only">Loading approved brand knowledge…</span>
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-40" />
      </header>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex flex-col gap-3 px-6 py-5">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
