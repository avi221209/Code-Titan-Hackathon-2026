import { Skeleton } from '@/components/ui/skeleton';

export default function NewDocumentLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex max-w-4xl flex-col gap-8"
    >
      <span className="sr-only">Loading new document editor…</span>
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>

      <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
