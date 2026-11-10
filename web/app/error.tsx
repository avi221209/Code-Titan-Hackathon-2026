'use client';

import Link from 'next/link';
import { SkipLink } from '@/components/skip-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <SkipLink />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-[100dvh] max-w-2xl items-center px-6 py-12 focus:outline-none"
      >
        <Card className="w-full">
          <CardHeader>
            <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-foreground">
              Something went wrong
            </h1>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              An unexpected error occurred while rendering this view. Please try again or return to the dashboard.
            </p>
            {error.digest ? (
              <p className="font-mono text-xs text-muted-foreground">
                Reference: {error.digest}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={reset} variant="outline">
                Try again
              </Button>
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Return to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
