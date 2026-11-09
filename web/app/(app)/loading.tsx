import { Skeleton } from '@/components/ui/skeleton';

export default function AppSegmentLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading workspace view…</span>
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
