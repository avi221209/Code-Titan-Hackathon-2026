import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Page not found</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The requested BrandGuardian route does not exist.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Return to Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
