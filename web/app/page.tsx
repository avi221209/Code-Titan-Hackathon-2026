import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground">
            BrandGuardian
          </h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-base leading-relaxed text-muted-foreground">
            Evidence-backed brand compliance workspace with workspace-isolated
            knowledge (rules, facts, terminology) and draft persistence under
            Row-Level Security. Automated compliance review runs and decision
            workflows arrive in M2–M3.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
