import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentDetailLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <span className="sr-only">Loading document draft…</span>
      <Skeleton className="h-5 w-36" />

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      <Skeleton className="h-16 w-full rounded-lg" />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
