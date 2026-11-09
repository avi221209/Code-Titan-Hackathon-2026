import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-8"
    >
      <span className="sr-only">Loading workspace dashboard…</span>
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-9 w-56 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.38fr_0.62fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-40" />
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-7 w-8" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-44" />
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-52 max-w-full" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
