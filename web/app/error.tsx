'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred while rendering this view.'}
          </p>
          <div>
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
