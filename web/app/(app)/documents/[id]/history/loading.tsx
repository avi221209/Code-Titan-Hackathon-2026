import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentHistoryLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <span className="sr-only">Loading document audit history…</span>
      <Skeleton className="h-5 w-36" />

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </header>

      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
